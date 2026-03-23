"use node";

import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { scrapeBeebomPage } from "./lib/providers/beebom";
import { scrapeTechwiserPage } from "./lib/providers/techwiser";
import {
  fetchWordPressArticleActiveCodesHash,
  hashWordPressCodesHtml,
  normalizeWordPressPostId,
  renderWordPressCodesHtml,
  renderWordPressCodesUpdateHtml,
  renderWordPressExpiredCodesHtml,
  updateWordPressArticleCodesSection,
} from "./lib/wordpress";
import type { WordPressSiteKey, ScrapedCode, ExpiredCode, ScrapeResult } from "./lib/types";

// ── Interfaces ────────────────────────────────────────────────────────────

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
  sources: { beebom: number | null; techwiser: number | null };
  activeCodes: number;
  expiredCodes: number;
  dbChanges?: { inserted: number; updated: number; removed: number };
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
  sourceBeebomUrl: string | null;
  sourceTechwiserUrl: string | null;
  lastScrapedAt: string | null;
  siteStates: {
    technerdiness: StoredSiteState;
    gamingwize: StoredSiteState;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────

const SITE_KEYS: WordPressSiteKey[] = ["technerdiness", "gamingwize"];
const SITE_LABELS: Record<WordPressSiteKey, string> = {
  technerdiness: "Tech Nerdiness",
  gamingwize: "Gaming Wize",
};

// ── Helpers ───────────────────────────────────────────────────────────────

function parsePositiveInteger(value: number | null | undefined, field: string): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer.`);
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

// ── Source merging ────────────────────────────────────────────────────────
// Beebom is the authority. If both sources have the same code:
//   - Use Beebom's version (provider, rewards, isNew)
//   - If Beebom says expired but TechWiser says active → treat as expired

interface MergedResult {
  activeCodes: { code: string; provider: string; rewardsText?: string; isNew: boolean }[];
  expiredCodes: { code: string; provider: string }[];
}

function mergeScrapeResults(
  beebom: ScrapeResult | null,
  techwiser: ScrapeResult | null
): MergedResult {
  // Build maps for active codes (Beebom first, then TechWiser fills gaps)
  const activeMap = new Map<string, { code: string; provider: string; rewardsText?: string; isNew: boolean }>();
  const expiredSet = new Map<string, { code: string; provider: string }>();

  // Beebom expired codes
  if (beebom) {
    for (const c of beebom.expiredCodes) {
      expiredSet.set(c.code, { code: c.code, provider: c.provider });
    }
  }

  // TechWiser expired codes (only if not already expired from Beebom)
  if (techwiser) {
    for (const c of techwiser.expiredCodes) {
      if (!expiredSet.has(c.code)) {
        expiredSet.set(c.code, { code: c.code, provider: c.provider });
      }
    }
  }

  // Beebom active codes (highest priority)
  if (beebom) {
    for (const c of beebom.codes) {
      activeMap.set(c.code, {
        code: c.code,
        provider: c.provider,
        rewardsText: c.rewardsText,
        isNew: c.isNew ?? false,
      });
      // If it's active in Beebom, remove from expired
      expiredSet.delete(c.code);
    }
  }

  // TechWiser active codes (fill gaps, but respect Beebom expired status)
  if (techwiser) {
    for (const c of techwiser.codes) {
      // If Beebom already has this code (active), skip — Beebom wins
      if (activeMap.has(c.code)) continue;
      // If Beebom says this code is expired, respect that
      if (beebom && expiredSet.has(c.code) &&
          beebom.expiredCodes.some((e) => e.code === c.code)) {
        continue;
      }
      activeMap.set(c.code, {
        code: c.code,
        provider: c.provider,
        rewardsText: c.rewardsText,
        isNew: c.isNew ?? false,
      });
      // Active code should not be in expired
      expiredSet.delete(c.code);
    }
  }

  return {
    activeCodes: Array.from(activeMap.values()),
    expiredCodes: Array.from(expiredSet.values()),
  };
}

// ── WordPress rendering ───────────────────────────────────────────────────

async function buildRenderedPayload(
  gameName: string,
  merged: MergedResult
): Promise<RenderedWordPressCodesPayload> {
  const name = gameName || "this game";
  // Convert merged codes into ScrapedCode/ExpiredCode for rendering
  const activeCodes: ScrapedCode[] = merged.activeCodes.map((c) => ({
    code: c.code,
    status: "active" as const,
    provider: c.provider as ScrapedCode["provider"],
    rewardsText: c.rewardsText,
    isNew: c.isNew,
  }));
  const expiredCodes: ExpiredCode[] = merged.expiredCodes.map((c) => ({
    code: c.code,
    provider: c.provider as ExpiredCode["provider"],
  }));

  const activeHtml = renderWordPressCodesHtml(name, activeCodes);
  const expiredHtml = renderWordPressExpiredCodesHtml(name, expiredCodes);

  return {
    activeHtml,
    expiredHtml,
    activeHash: await hashWordPressCodesHtml(activeHtml),
  };
}

// ── WordPress site sync (unchanged logic) ─────────────────────────────────

async function syncWordPressSite(
  ctx: any,
  articleId: string,
  gameName: string,
  siteState: StoredSiteState,
  rendered: RenderedWordPressCodesPayload,
  label: string
): Promise<SiteSyncResult> {
  const siteLabel = formatSiteLabel(siteState.siteKey);

  if (!siteState.articleUrl) {
    logInfo(`${label} ${siteLabel} skipped: missing article URL`);
    return { siteKey: siteState.siteKey, articleUrl: null, wordpressPostId: null, updated: false, reason: "missing_article_url" };
  }

  const wordpressPostId = normalizeWordPressPostId(siteState.wordpressPostId);
  if (!wordpressPostId) {
    logInfo(`${label} ${siteLabel} skipped: missing post ID`);
    return { siteKey: siteState.siteKey, articleUrl: siteState.articleUrl, wordpressPostId: null, updated: false, reason: "missing_wordpress_post_id" };
  }

  if (!siteState.wordpressPostType) {
    logInfo(`${label} ${siteLabel} skipped: missing post type`);
    return { siteKey: siteState.siteKey, articleUrl: siteState.articleUrl, wordpressPostId, updated: false, reason: "missing_wordpress_post_type" };
  }

  const currentWordPressActiveHash = await fetchWordPressArticleActiveCodesHash({
    siteKey: siteState.siteKey,
    articleUrl: siteState.articleUrl,
    wordpressPostId,
    wordpressPostType: siteState.wordpressPostType,
  });

  if (rendered.activeHash === currentWordPressActiveHash) {
    await ctx.runMutation(internal.wordpressState.updateSyncState, {
      articleId,
      siteKey: siteState.siteKey,
      lastWordpressCodesHash: rendered.activeHash,
      lastWordpressSyncError: undefined,
    });
    logInfo(`${label} ${siteLabel} skipped: active codes unchanged`);
    return { siteKey: siteState.siteKey, articleUrl: siteState.articleUrl, wordpressPostId, updated: false, reason: "no_change" };
  }

  try {
    logInfo(`${label} ${siteLabel} updating WordPress`);
    await updateWordPressArticleCodesSection({
      siteKey: siteState.siteKey,
      articleUrl: siteState.articleUrl,
      wordpressPostId,
      wordpressPostType: siteState.wordpressPostType,
      activeHtml: rendered.activeHtml,
      expiredHtml: rendered.expiredHtml,
      updateHtml: renderWordPressCodesUpdateHtml(gameName || "this game", new Date(), siteState.siteKey),
    });

    await ctx.runMutation(internal.wordpressState.updateSyncState, {
      articleId,
      siteKey: siteState.siteKey,
      lastWordpressCodesHash: rendered.activeHash,
      lastWordpressSyncAt: new Date().toISOString(),
      lastWordpressSyncError: undefined,
    });

    logInfo(`${label} ${siteLabel} updated`);
    return { siteKey: siteState.siteKey, articleUrl: siteState.articleUrl, wordpressPostId, updated: true, reason: "active_codes_changed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await ctx.runMutation(internal.wordpressState.updateSyncState, {
        articleId,
        siteKey: siteState.siteKey,
        lastWordpressSyncError: message,
      });
    } catch { /* preserve original error */ }

    return { siteKey: siteState.siteKey, articleUrl: siteState.articleUrl, wordpressPostId, updated: false, reason: "error", error: message };
  }
}

// ── Per-article sync ──────────────────────────────────────────────────────

async function syncArticle(
  ctx: any,
  article: StoredArticleSource,
  shouldPersist: boolean,
  label: string
): Promise<SyncItemResult> {
  // 1. Scrape both sources (whichever are configured)
  let beebomResult: ScrapeResult | null = null;
  let techwiserResult: ScrapeResult | null = null;

  if (article.sourceBeebomUrl) {
    logInfo(`${label} Scraping Beebom: ${article.sourceBeebomUrl}`);
    beebomResult = await scrapeBeebomPage(article.sourceBeebomUrl);
    logInfo(`${label} Beebom: ${beebomResult.codes.length} active, ${beebomResult.expiredCodes.length} expired`);
  }

  if (article.sourceTechwiserUrl) {
    logInfo(`${label} Scraping TechWiser: ${article.sourceTechwiserUrl}`);
    techwiserResult = await scrapeTechwiserPage(article.sourceTechwiserUrl);
    logInfo(`${label} TechWiser: ${techwiserResult.codes.length} active, ${techwiserResult.expiredCodes.length} expired`);
  }

  // 2. Merge results (Beebom is authority)
  const merged = mergeScrapeResults(beebomResult, techwiserResult);

  const summary: SyncItemResult = {
    gameName: article.gameName,
    articleId: article.articleId,
    sources: {
      beebom: beebomResult ? beebomResult.codes.length : null,
      techwiser: techwiserResult ? techwiserResult.codes.length : null,
    },
    activeCodes: merged.activeCodes.length,
    expiredCodes: merged.expiredCodes.length,
    wordpress: [],
  };

  logInfo(`${label} Merged: ${merged.activeCodes.length} active, ${merged.expiredCodes.length} expired`);

  if (!shouldPersist) {
    logInfo(`${label} Dry run, skipped DB and WordPress`);
    return summary;
  }

  // 3. Sync to database (compare, insert new, remove stale)
  const dbResult = await ctx.runMutation(internal.codes.syncCodesForArticle, {
    articleId: article.articleId,
    gameName: article.gameName,
    activeCodes: merged.activeCodes,
    expiredCodes: merged.expiredCodes,
  });
  summary.dbChanges = dbResult;
  logInfo(`${label} DB: +${dbResult.inserted} ~${dbResult.updated} -${dbResult.removed}`);

  await ctx.runMutation(internal.articles.updateLastScrapedAt, {
    articleId: article.articleId,
    lastScrapedAt: new Date().toISOString(),
  });

  // 4. Render and push to WordPress
  // Order: new codes first, then old codes
  const orderedActive = [
    ...merged.activeCodes.filter((c) => c.isNew),
    ...merged.activeCodes.filter((c) => !c.isNew),
  ];
  const orderedMerged = { activeCodes: orderedActive, expiredCodes: merged.expiredCodes };
  const rendered = await buildRenderedPayload(article.gameName, orderedMerged);

  const siteErrors: string[] = [];
  for (const siteKey of SITE_KEYS) {
    const result = await syncWordPressSite(ctx, article.articleId, article.gameName, article.siteStates[siteKey], rendered, label);
    summary.wordpress.push(result);
    if (result.reason === "error" && result.error) {
      siteErrors.push(`${formatSiteLabel(siteKey)}: ${result.error}`);
    }
  }

  if (siteErrors.length) {
    throw new Error(siteErrors.join(" | "));
  }

  return summary;
}

// ── Main handler ──────────────────────────────────────────────────────────

async function handleSyncCodes(
  ctx: any,
  args: { gameName?: string; dryRun?: boolean; limit?: number }
): Promise<SyncCodesSummary> {
  const limit = parsePositiveInteger(args.limit, "limit");
  const gameName = args.gameName?.trim() || undefined;
  const dryRun = Boolean(args.dryRun);
  const articles: StoredArticleSource[] = await ctx.runQuery(
    internal.articlesInternal.listArticlesForSync,
    { limit, gameName }
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
      failures.push({ gameName: article.gameName, reason });
      console.error(`${label} Failed: ${reason}`);
    }
  }

  const wordpressUpdatedArticles = successes.filter((item) =>
    item.wordpress.some((s) => s.updated)
  ).length;
  let wordpressUpdatedSites = 0;
  for (const item of successes) {
    for (const s of item.wordpress) {
      if (s.updated) wordpressUpdatedSites++;
    }
  }

  logInfo(`Sync complete: ${successes.length} ok, ${failures.length} failed, ${wordpressUpdatedSites} WP update(s)`);

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

// ── Exports ───────────────────────────────────────────────────────────────

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
