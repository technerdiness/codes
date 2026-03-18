import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { scrapeBeebomPage } from "../_shared/providers/beebom.ts";
import {
  listArticleSourcesFromSupabase,
  saveScrapeResultToSupabase,
  type StoredArticleSource,
  updateArticleWordPressSyncState,
} from "../_shared/supabase/storage.ts";
import {
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

interface SyncItemResult {
  gameName: string;
  beebomArticleUrl: string;
  articleId?: string;
  activeCodes: number;
  expiredCodes: number;
  attemptedUpserts?: number;
  wordpressUpdated?: boolean;
  wordpressUpdateReason?: string;
}

interface SyncCodesSummary {
  dryRun: boolean;
  attemptedArticles: number;
  successfulArticles: number;
  failedArticles: number;
  wordpressUpdatedArticles: number;
  successes: SyncItemResult[];
  failures: SyncFailure[];
}

const JSON_HEADERS = { "Content-Type": "application/json" };

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

function logInfo(message: string): void {
  console.log(message);
}

async function syncArticle(
  article: StoredArticleSource,
  shouldPersist: boolean,
  label: string
): Promise<SyncItemResult> {
  logInfo(`${label} Scraping ${article.beebomArticleUrl}`);
  const scraped = await scrapeBeebomPage(article.beebomArticleUrl);
  const summary: SyncItemResult = {
    gameName: article.gameName,
    beebomArticleUrl: article.beebomArticleUrl,
    articleId: article.articleId,
    activeCodes: scraped.codes.length,
    expiredCodes: scraped.expiredCodes.length,
  };
  logInfo(`${label} Scraped ${summary.activeCodes} active, ${summary.expiredCodes} expired`);

  if (!shouldPersist) {
    logInfo(`${label} Dry run, skipped Supabase and WordPress`);
    return summary;
  }

  const saved = await saveScrapeResultToSupabase(article, scraped);
  summary.attemptedUpserts = saved.attemptedUpserts;
  logInfo(`${label} Supabase upserted ${saved.attemptedUpserts} row(s)`);

  const wordpressPostId = normalizeWordPressPostId(article.wordpressPostId);
  if (!wordpressPostId) {
    summary.wordpressUpdated = false;
    summary.wordpressUpdateReason = "missing_wordpress_post_id";
    logInfo(`${label} WordPress skipped: missing post ID`);
    return summary;
  }

  if (!article.wordpressPostType) {
    summary.wordpressUpdated = false;
    summary.wordpressUpdateReason = "missing_wordpress_post_type";
    logInfo(`${label} WordPress skipped: missing post type`);
    return summary;
  }

  const renderedActiveHtml = renderWordPressCodesHtml(article.gameName, scraped.codes);
  const renderedExpiredHtml = renderWordPressExpiredCodesHtml(
    article.gameName,
    scraped.expiredCodes
  );
  const renderedUpdateHtml = renderWordPressCodesUpdateHtml(article.gameName);
  const renderedHash = hashWordPressCodesHtml(renderedActiveHtml);

  if (renderedHash === article.lastWordpressCodesHash) {
    summary.wordpressUpdated = false;
    summary.wordpressUpdateReason = "no_change";
    await updateArticleWordPressSyncState({
      articleId: article.articleId,
      lastWordpressSyncError: null,
    });
    logInfo(`${label} WordPress skipped: active codes unchanged`);
    return summary;
  }

  try {
    logInfo(`${label} Updating WordPress marker sections`);
    await updateWordPressArticleCodesSection({
      articleUrl: article.ourArticleUrl,
      wordpressPostId,
      wordpressPostType: article.wordpressPostType,
      activeHtml: renderedActiveHtml,
      expiredHtml: renderedExpiredHtml,
      updateHtml: renderedUpdateHtml,
    });

    await updateArticleWordPressSyncState({
      articleId: article.articleId,
      lastWordpressCodesHash: renderedHash,
      lastWordpressSyncAt: new Date().toISOString(),
      lastWordpressSyncError: null,
    });

    summary.wordpressUpdated = true;
    summary.wordpressUpdateReason = "active_codes_changed";
    logInfo(`${label} WordPress updated`);
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    try {
      await updateArticleWordPressSyncState({
        articleId: article.articleId,
        lastWordpressSyncError: message,
      });
    } catch {
      // Preserve the original WordPress sync error.
    }

    throw error;
  }
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
        beebomArticleUrl: article.beebomArticleUrl,
        reason,
      });
      console.error(`${label} Failed`);
      console.error(`${label} ${reason}`);
    }
  }

  const wordpressUpdatedArticles = successes.filter((item) => item.wordpressUpdated).length;
  logInfo(
    `Sync complete: ${successes.length} succeeded, ${failures.length} failed, ${wordpressUpdatedArticles} WordPress update(s)`
  );

  return {
    dryRun,
    attemptedArticles: articles.length,
    successfulArticles: successes.length,
    failedArticles: failures.length,
    wordpressUpdatedArticles,
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
