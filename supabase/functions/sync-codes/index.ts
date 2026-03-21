import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { scrapeBeebomPage } from "../_shared/providers/beebom.ts";
import {
  listArticleSourcesFromSupabase,
  saveScrapeResultToSupabase,
  updateSiteWordPressSyncState,
} from "../_shared/supabase/storage.ts";
import type {
  StoredArticleSource,
  StoredWordPressSiteState,
  WordPressSiteKey,
} from "../_shared/supabase/storage.ts";
import type { ScrapeResult } from "../_shared/types/scraper.ts";
import {
  fetchWordPressArticleActiveCodesHash,
  hashWordPressCodesHtml,
  normalizeWordPressPostId,
  renderWordPressCodesHtml,
  renderWordPressCodesUpdateHtml,
  renderWordPressExpiredCodesHtml,
  updateWordPressArticleCodesSection,
} from "../_shared/wordpress.ts";

interface SyncCodesRequestPayload {
  limit?: number;
  beebomArticleUrl?: string;
  dryRun?: boolean;
}

interface SyncFailure {
  beebomArticleUrl: string;
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
  beebomArticleUrl: string;
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

const JSON_HEADERS = { "Content-Type": "application/json" };
const SITE_KEYS: WordPressSiteKey[] = ["technerdiness", "gamingwize"];
const SITE_LABELS: Record<WordPressSiteKey, string> = {
  technerdiness: "Tech Nerdiness",
  gamingwize: "Gaming Wize",
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}

function isAuthorized(req: Request): boolean {
  const expected = Deno.env.get("SYNC_CODES_WEBHOOK_SECRET")?.trim();
  const received = req.headers.get("X-Webhook-Secret")?.trim();
  return Boolean(expected && received && expected === received);
}

function parsePositiveInteger(value: number | null | undefined, field: string): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }

  return value;
}

function validateUrl(value: string | undefined, field: string): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error();
    }
    return value;
  } catch {
    throw new Error(`Invalid ${field}: ${value}`);
  }
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

function buildRenderedPayload(
  article: StoredArticleSource,
  scraped: ScrapeResult
): RenderedWordPressCodesPayload {
  const gameName = article.gameName || "this game";
  const activeHtml = renderWordPressCodesHtml(gameName, scraped.codes);
  const expiredHtml = renderWordPressExpiredCodesHtml(gameName, scraped.expiredCodes);

  return {
    activeHtml,
    expiredHtml,
    activeHash: hashWordPressCodesHtml(activeHtml),
  };
}

async function syncWordPressSite(
  article: StoredArticleSource,
  siteState: StoredWordPressSiteState,
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
    await updateSiteWordPressSyncState({
      articleId: article.articleId,
      siteKey: siteState.siteKey,
      lastWordpressCodesHash: rendered.activeHash,
      lastWordpressSyncError: null,
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

    await updateSiteWordPressSyncState({
      articleId: article.articleId,
      siteKey: siteState.siteKey,
      lastWordpressCodesHash: rendered.activeHash,
      lastWordpressSyncAt: new Date().toISOString(),
      lastWordpressSyncError: null,
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
      await updateSiteWordPressSyncState({
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
  article: StoredArticleSource,
  shouldPersist: boolean,
  label: string
): Promise<SyncItemResult> {
  logInfo(`${label} Scraping ${article.sourceBeebomUrl}`);
  const scraped = await scrapeBeebomPage(article.sourceBeebomUrl);
  const summary: SyncItemResult = {
    gameName: article.gameName,
    beebomArticleUrl: article.sourceBeebomUrl,
    articleId: article.articleId,
    activeCodes: scraped.codes.length,
    expiredCodes: scraped.expiredCodes.length,
    wordpress: [],
  };
  logInfo(`${label} Scraped ${summary.activeCodes} active, ${summary.expiredCodes} expired`);

  if (!shouldPersist) {
    logInfo(`${label} Dry run, skipped Supabase and WordPress`);
    return summary;
  }

  const saved = await saveScrapeResultToSupabase(article, scraped);
  summary.attemptedUpserts = saved.attemptedUpserts;
  logInfo(`${label} Supabase upserted ${saved.attemptedUpserts} row(s)`);

  const rendered = buildRenderedPayload(article, scraped);
  const siteResults: SiteSyncResult[] = [];
  const siteErrors: string[] = [];

  for (const siteKey of SITE_KEYS) {
    const result = await syncWordPressSite(article, article.siteStates[siteKey], rendered, label);
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

async function handleSyncCodes(payload: SyncCodesRequestPayload): Promise<SyncCodesSummary> {
  const limit = parsePositiveInteger(payload.limit, "limit");
  const beebomArticleUrl = validateUrl(payload.beebomArticleUrl?.trim(), "beebomArticleUrl");
  const dryRun = Boolean(payload.dryRun);
  const articles = await listArticleSourcesFromSupabase({
    limit,
    beebomArticleUrl,
  });

  logInfo(`Sync start: ${articles.length} article(s), mode=${dryRun ? "dry-run" : "write"}`);

  const successes: SyncItemResult[] = [];
  const failures: SyncFailure[] = [];

  for (const [index, article] of articles.entries()) {
    const label = formatArticleLabel(index + 1, articles.length, article.gameName);
    try {
      const summary = await syncArticle(article, !dryRun, label);
      successes.push(summary);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push({
        beebomArticleUrl: article.sourceBeebomUrl,
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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  let payload: SyncCodesRequestPayload = {};

  try {
    const text = await req.text();
    payload = text ? (JSON.parse(text) as SyncCodesRequestPayload) : {};
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  try {
    const summary = await handleSyncCodes(payload);
    return jsonResponse(summary.failedArticles ? 500 : 200, {
      ok: summary.failedArticles === 0,
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Codes sync failed:", error);
    return jsonResponse(500, {
      ok: false,
      error: message,
    });
  }
});
