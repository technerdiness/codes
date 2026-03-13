import "dotenv/config";

import { scrapeBeebomPage } from "../providers/beebom.ts";
import {
  listArticleSourcesFromSupabase,
  saveScrapeResultToSupabase,
  type StoredArticleSource,
  updateArticleWordPressSyncState,
} from "../integrations/supabase/storage.ts";
import {
  hashWordPressCodesHtml,
  normalizeWordPressPostId,
  renderWordPressCodesHtml,
  renderWordPressCodesUpdateHtml,
  renderWordPressExpiredCodesHtml,
  updateWordPressArticleCodesSection,
} from "../integrations/wordpress.ts";

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

function logInfo(message: string): void {
  console.log(message);
}

function logFailure(message: string): void {
  console.error(message);
}

function formatArticleLabel(index: number, total: number, gameName: string): string {
  return `[${index}/${total}] ${gameName}`;
}

function readFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;

  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    return undefined;
  }

  return value;
}

function parsePositiveInteger(value: string | undefined, flag: string): number | undefined {
  if (!value) return undefined;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return parsed;
}

function validateUrl(value: string, flag: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error();
    }
    return value;
  } catch {
    throw new Error(`Invalid ${flag}: ${value}`);
  }
}

function printUsage(): void {
  console.error("Usage: npm run sync:codes");
  console.error("       npm run sync:codes -- --limit 5");
  console.error("       npm run sync:codes -- --beebom-url <beebom-article-url>");
  console.error("       npm run sync:codes -- --dry-run");
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

  const renderedActiveHtml = renderWordPressCodesHtml(scraped.codes);
  const renderedExpiredHtml = renderWordPressExpiredCodesHtml(scraped.expiredCodes);
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldShowHelp = args.includes("--help") || args.includes("-h");
  const isDryRun = args.includes("--dry-run");
  const allowedFlags = new Set(["--help", "-h", "--dry-run", "--limit", "--beebom-url"]);
  const unknownFlags = args.filter((value) => value.startsWith("-") && !allowedFlags.has(value));

  if (shouldShowHelp) {
    printUsage();
    return;
  }

  if (unknownFlags.length) {
    throw new Error(`Unsupported option(s): ${unknownFlags.join(", ")}`);
  }

  const limit = parsePositiveInteger(readFlagValue(args, "--limit"), "--limit");
  const beebomArticleUrlRaw = readFlagValue(args, "--beebom-url");
  const beebomArticleUrl = beebomArticleUrlRaw
    ? validateUrl(beebomArticleUrlRaw, "--beebom-url")
    : undefined;

  const articles = await listArticleSourcesFromSupabase({
    limit,
    beebomArticleUrl,
  });
  const runMode = isDryRun ? "dry-run" : "write";
  logInfo(`Sync start: ${articles.length} article(s), mode=${runMode}`);

  const successes: SyncItemResult[] = [];
  const failures: SyncFailure[] = [];

  for (const [index, article] of articles.entries()) {
    const label = formatArticleLabel(index + 1, articles.length, article.gameName);
    try {
      const summary = await syncArticle(article, !isDryRun, label);
      successes.push(summary);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push({
        beebomArticleUrl: article.beebomArticleUrl,
        reason,
      });
      logFailure(`${label} Failed`);
      logFailure(`${label} ${reason}`);
    }
  }

  const wordpressUpdatedCount = successes.filter((item) => item.wordpressUpdated).length;
  logInfo(
    `Sync complete: ${successes.length} succeeded, ${failures.length} failed, ${wordpressUpdatedCount} WordPress update(s)`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logFailure(`Sync failed: ${message}`);
  process.exitCode = 1;
});
