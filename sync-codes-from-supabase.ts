import "dotenv/config";

import { scrapeBeebomPage } from "./beebom.ts";
import {
  listArticleSourcesFromSupabase,
  saveScrapeResultToSupabase,
  type StoredArticleSource,
  updateArticleWordPressSyncState,
} from "./supabase-storage.ts";
import {
  hashWordPressCodesHtml,
  normalizeWordPressPostId,
  renderWordPressCodesHtml,
  renderWordPressCodesUpdateHtml,
  renderWordPressExpiredCodesHtml,
  updateWordPressArticleCodesSection,
} from "./wordpress.ts";

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
  shouldPersist: boolean
): Promise<SyncItemResult> {
  const scraped = await scrapeBeebomPage(article.beebomArticleUrl);
  const summary: SyncItemResult = {
    gameName: article.gameName,
    beebomArticleUrl: article.beebomArticleUrl,
    articleId: article.articleId,
    activeCodes: scraped.codes.length,
    expiredCodes: scraped.expiredCodes.length,
  };

  if (!shouldPersist) {
    return summary;
  }

  const saved = await saveScrapeResultToSupabase(article, scraped);
  summary.attemptedUpserts = saved.attemptedUpserts;

  const wordpressPostId = normalizeWordPressPostId(article.wordpressPostId);
  if (!wordpressPostId) {
    summary.wordpressUpdated = false;
    summary.wordpressUpdateReason = "missing_wordpress_post_id";
    return summary;
  }

  if (!article.wordpressPostType) {
    summary.wordpressUpdated = false;
    summary.wordpressUpdateReason = "missing_wordpress_post_type";
    return summary;
  }

  const renderedActiveHtml = renderWordPressCodesHtml(scraped.codes);
  const renderedExpiredHtml = renderWordPressExpiredCodesHtml(scraped.expiredCodes);
  const renderedUpdateHtml = renderWordPressCodesUpdateHtml(article.gameName);
  const renderedHash = hashWordPressCodesHtml(
    renderedActiveHtml,
    renderedExpiredHtml,
    renderedUpdateHtml
  );

  if (renderedHash === article.lastWordpressCodesHash) {
    summary.wordpressUpdated = false;
    summary.wordpressUpdateReason = "no_change";
    await updateArticleWordPressSyncState({
      articleId: article.articleId,
      lastWordpressSyncError: null,
    });
    return summary;
  }

  try {
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
    summary.wordpressUpdateReason = "content_changed";
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

  const successes: SyncItemResult[] = [];
  const failures: SyncFailure[] = [];

  for (const article of articles) {
    try {
      const summary = await syncArticle(article, !isDryRun);
      successes.push(summary);
    } catch (error) {
      failures.push({
        beebomArticleUrl: article.beebomArticleUrl,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun: isDryRun,
        requestedLimit: limit ?? null,
        requestedBeebomUrl: beebomArticleUrl ?? null,
        fetchedArticles: articles.length,
        syncedArticles: successes.length,
        failedArticles: failures.length,
        successes,
        failures,
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
