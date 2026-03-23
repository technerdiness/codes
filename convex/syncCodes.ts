"use node";

import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { scrapeBeebomPage } from "./lib/providers/beebom";
import {
  fetchWordPressArticleActiveCodesHash,
  hashWordPressCodesHtml,
  normalizeWordPressPostId,
  renderWordPressCodesHtml,
  renderWordPressCodesUpdateHtml,
  renderWordPressExpiredCodesHtml,
  updateWordPressArticleCodesSection,
} from "./lib/wordpress";
import type { WordPressSiteKey } from "./lib/types";
import type { ScrapeResult } from "./lib/types";

interface SyncFailure {
  gameName: string;
  reason: string;
}

interface SiteSyncResult {
  siteKey: WordPressSiteKey;
  articleUrl: string | null;
  wordpressPostId: number | null;
  updated: boolean;
  reason:
    | "missing_article_url"
    | "missing_wordpress_post_id"
    | "missing_wordpress_post_type"
    | "no_change"
    | "active_codes_changed"
    | "error";
  error?: string;
}

interface SyncItemResult {
  gameName: string;
  articleId?: string;
  activeCodes: number;
  expiredCodes: number;
  attemptedUpserts?: number;
  wordpress: SiteSyncResult[];
}

interface SyncCodesSummary {
  dryRun: boolean;
  attemptedArticles: number;
  successfulArticles: number;
  failedArticles: number;
  wordpressUpdatedArticles: number;
  wordpressUpdatedSites: number;
  successes: SyncItemResult[];
  failures: SyncFailure[];
}

interface RenderedWordPressCodesPayload {
  activeHtml: string;
  expiredHtml: string;
  activeHash: string;
}

interface StoredSiteState {
  siteKey: WordPressSiteKey;
  articleUrl: string | null;
  wordpressPostId: number | null;
  wordpressPostType: string | null;
  lastWordpressCodesHash: string | null;
  lastWordpressSyncAt: string | null;
  lastWordpressSyncError: string | null;
}

interface StoredArticleSource {
  articleId: string;
  gameName: string;
  sourceBeebomUrl: string;
  lastScrapedAt: string | null;
  siteStates: {
    technerdiness: StoredSiteState;
    gamingwize: StoredSiteState;
  };
}

const SITE_KEYS: WordPressSiteKey[] = ["technerdiness", "gamingwize"];
const SITE_LABELS: Record<WordPressSiteKey, string> = {
  technerdiness: "Tech Nerdiness",
  gamingwize: "Gaming Wize",
};

function parsePositiveInteger(value: number | null | undefined, field: string): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return value;
}

function formatArticleLabel(index: number, total: number, gameName: string): string {
  return `[${index}/${total}] ${gameName}`;
}

function formatSiteLabel(siteKey: WordPressSiteKey): string {
  return SITE_LABELS[siteKey];
}

function logInfo(message: string): void {
  console.log(message);
}

async function buildRenderedPayload(
  article: StoredArticleSource,
  scraped: ScrapeResult
): Promise<RenderedWordPressCodesPayload> {
  const gameName = article.gameName || "this game";
  const activeHtml = renderWordPressCodesHtml(gameName, scraped.codes);
  const expiredHtml = renderWordPressExpiredCodesHtml(gameName, scraped.expiredCodes);

  return {
    activeHtml,
    expiredHtml,
    activeHash: await hashWordPressCodesHtml(activeHtml),
  };
}

async function syncWordPressSite(
  ctx: any,
  article: StoredArticleSource,
  siteState: StoredSiteState,
  rendered: RenderedWordPressCodesPayload,
  label: string
): Promise<SiteSyncResult> {
  const siteLabel = formatSiteLabel(siteState.siteKey);

  if (!siteState.articleUrl) {
    logInfo(`${label} ${siteLabel} skipped: missing article URL`);
    return {
      siteKey: siteState.siteKey,
      articleUrl: null,
      wordpressPostId: null,
      updated: false,
      reason: "missing_article_url",
    };
  }

  const wordpressPostId = normalizeWordPressPostId(siteState.wordpressPostId);
  if (!wordpressPostId) {
    logInfo(`${label} ${siteLabel} skipped: missing post ID`);
    return {
      siteKey: siteState.siteKey,
      articleUrl: siteState.articleUrl,
      wordpressPostId: null,
      updated: false,
      reason: "missing_wordpress_post_id",
    };
  }

  if (!siteState.wordpressPostType) {
    logInfo(`${label} ${siteLabel} skipped: missing post type`);
    return {
      siteKey: siteState.siteKey,
      articleUrl: siteState.articleUrl,
      wordpressPostId,
      updated: false,
      reason: "missing_wordpress_post_type",
    };
  }

  const currentWordPressActiveHash = await fetchWordPressArticleActiveCodesHash({
    siteKey: siteState.siteKey,
    articleUrl: siteState.articleUrl,
    wordpressPostId,
    wordpressPostType: siteState.wordpressPostType,
  });

  if (rendered.activeHash === currentWordPressActiveHash) {
    await ctx.runMutation(internal.wordpressState.updateSyncState, {
      articleId: article.articleId,
      siteKey: siteState.siteKey,
      lastWordpressCodesHash: rendered.activeHash,
      lastWordpressSyncError: undefined,
    });
    logInfo(`${label} ${siteLabel} skipped: active codes unchanged`);
    return {
      siteKey: siteState.siteKey,
      articleUrl: siteState.articleUrl,
      wordpressPostId,
      updated: false,
      reason: "no_change",
    };
  }

  try {
    logInfo(`${label} ${siteLabel} updating WordPress marker sections`);
    await updateWordPressArticleCodesSection({
      siteKey: siteState.siteKey,
      articleUrl: siteState.articleUrl,
      wordpressPostId,
      wordpressPostType: siteState.wordpressPostType,
      activeHtml: rendered.activeHtml,
      expiredHtml: rendered.expiredHtml,
      updateHtml: renderWordPressCodesUpdateHtml(article.gameName || "this game", new Date(), siteState.siteKey),
    });

    await ctx.runMutation(internal.wordpressState.updateSyncState, {
      articleId: article.articleId,
      siteKey: siteState.siteKey,
      lastWordpressCodesHash: rendered.activeHash,
      lastWordpressSyncAt: new Date().toISOString(),
      lastWordpressSyncError: undefined,
    });

    logInfo(`${label} ${siteLabel} updated`);
    return {
      siteKey: siteState.siteKey,
      articleUrl: siteState.articleUrl,
      wordpressPostId,
      updated: true,
      reason: "active_codes_changed",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    try {
      await ctx.runMutation(internal.wordpressState.updateSyncState, {
        articleId: article.articleId,
        siteKey: siteState.siteKey,
        lastWordpressSyncError: message,
      });
    } catch {
      // Preserve the original WordPress sync error.
    }

    return {
      siteKey: siteState.siteKey,
      articleUrl: siteState.articleUrl,
      wordpressPostId,
      updated: false,
      reason: "error",
      error: message,
    };
  }
}

async function syncArticle(
  ctx: any,
  article: StoredArticleSource,
  shouldPersist: boolean,
  label: string
): Promise<SyncItemResult> {
  logInfo(`${label} Scraping ${article.sourceBeebomUrl}`);
  const scraped = await scrapeBeebomPage(article.sourceBeebomUrl);
  const summary: SyncItemResult = {
    gameName: article.gameName,
    articleId: article.articleId,
    activeCodes: scraped.codes.length,
    expiredCodes: scraped.expiredCodes.length,
    wordpress: [],
  };
  logInfo(`${label} Scraped ${summary.activeCodes} active, ${summary.expiredCodes} expired`);

  if (!shouldPersist) {
    logInfo(`${label} Dry run, skipped Convex and WordPress`);
    return summary;
  }

  const allCodes = [
    ...scraped.codes.map((c) => ({
      code: c.code,
      status: c.status as string,
      provider: c.provider as string,
      rewardsText: c.rewardsText,
      isNew: c.isNew ?? false,
    })),
    ...scraped.expiredCodes.map((c) => ({
      code: c.code,
      status: "expired" as string,
      provider: c.provider as string,
      rewardsText: undefined,
      isNew: false,
    })),
  ];

  const saved = await ctx.runMutation(internal.codes.upsertCodes, {
    articleId: article.articleId,
    gameName: article.gameName,
    codes: allCodes,
  });
  summary.attemptedUpserts = saved.attemptedUpserts;
  logInfo(`${label} Convex upserted ${saved.attemptedUpserts} row(s)`);

  await ctx.runMutation(internal.articles.updateLastScrapedAt, {
    articleId: article.articleId,
    lastScrapedAt: new Date().toISOString(),
  });

  const rendered = await buildRenderedPayload(article, scraped);
  const siteResults: SiteSyncResult[] = [];
  const siteErrors: string[] = [];

  for (const siteKey of SITE_KEYS) {
    const result = await syncWordPressSite(ctx, article, article.siteStates[siteKey], rendered, label);
    siteResults.push(result);
    if (result.reason === "error" && result.error) {
      siteErrors.push(`${formatSiteLabel(siteKey)}: ${result.error}`);
    }
  }

  summary.wordpress = siteResults;

  if (siteErrors.length) {
    throw new Error(siteErrors.join(" | "));
  }

  return summary;
}

async function handleSyncCodes(
  ctx: any,
  args: { gameName?: string; dryRun?: boolean; limit?: number }
): Promise<SyncCodesSummary> {
  const limit = parsePositiveInteger(args.limit, "limit");
  const gameName = args.gameName?.trim() || undefined;
  const dryRun = Boolean(args.dryRun);
  const articles: StoredArticleSource[] = await ctx.runQuery(
    internal.articlesInternal.listArticlesForSync,
    {
      limit,
      gameName,
    }
  );

  logInfo(`Sync start: ${articles.length} article(s), mode=${dryRun ? "dry-run" : "write"}`);

  const successes: SyncItemResult[] = [];
  const failures: SyncFailure[] = [];

  for (const [index, article] of articles.entries()) {
    const label = formatArticleLabel(index + 1, articles.length, article.gameName);
    try {
      const summary = await syncArticle(ctx, article, !dryRun, label);
      successes.push(summary);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push({
        gameName: article.gameName,
        reason,
      });
      console.error(`${label} Failed`);
      console.error(`${label} ${reason}`);
    }
  }

  const wordpressUpdatedArticles = successes.filter((item) =>
    item.wordpress.some((siteResult) => siteResult.updated)
  ).length;
  let wordpressUpdatedSites = 0;
  for (const item of successes) {
    for (const siteResult of item.wordpress) {
      if (siteResult.updated) {
        wordpressUpdatedSites += 1;
      }
    }
  }
  logInfo(
    `Sync complete: ${successes.length} succeeded, ${failures.length} failed, ${wordpressUpdatedSites} WordPress site update(s)`
  );

  return {
    dryRun,
    attemptedArticles: articles.length,
    successfulArticles: successes.length,
    failedArticles: failures.length,
    wordpressUpdatedArticles,
    wordpressUpdatedSites,
    successes,
    failures,
  };
}

export const run = internalAction({
  args: {
    gameName: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await handleSyncCodes(ctx, args);
  },
});

export const syncCodes = action({
  args: {
    gameName: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await handleSyncCodes(ctx, args);
  },
});
