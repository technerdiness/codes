import "dotenv/config";

import { scrapeBeebomPage } from "./beebom.ts";
import type { ArticleSourceInput } from "./scraper-types.ts";
import { saveScrapeResultToSupabase } from "./supabase-storage.ts";

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldSave = args.includes("--save");
  const shouldShowHelp = args.includes("--help") || args.includes("-h");
  const unknownFlags = args.filter(
    (value) =>
      value.startsWith("-") &&
      !["--save", "--help", "-h", "--game-name", "--our-article-url"].includes(value)
  );
  const gameName = readFlagValue(args, "--game-name");
  const ourArticleUrl = readFlagValue(args, "--our-article-url");
  const url = readPositionalUrl(args, ["--game-name", "--our-article-url"]);

  if (shouldShowHelp) {
    console.error("Usage: npm run scrape -- <beebom-article-url> [--save]");
    console.error(
      "       npm run scrape:supabase -- <beebom-article-url> --game-name \"Game Name\" --our-article-url <our-article-url>"
    );
    process.exitCode = 0;
    return;
  }

  if (unknownFlags.length) {
    console.error(`Unsupported option(s): ${unknownFlags.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  if (!url) {
    console.error("Usage: npm run scrape -- <beebom-article-url> [--save]");
    process.exitCode = 1;
    return;
  }

  if (!isValidUrl(url)) {
    console.error(`Invalid URL: ${url}`);
    process.exitCode = 1;
    return;
  }

  const result = await scrapeBeebomPage(url);
  const output: Record<string, unknown> = {
    sourceUrl: url,
    ...result,
  };

  if (shouldSave) {
    if (!gameName) {
      console.error("Missing --game-name when using --save.");
      process.exitCode = 1;
      return;
    }

    if (!ourArticleUrl) {
      console.error("Missing --our-article-url when using --save.");
      process.exitCode = 1;
      return;
    }

    if (!isValidUrl(ourArticleUrl)) {
      console.error(`Invalid our article URL: ${ourArticleUrl}`);
      process.exitCode = 1;
      return;
    }

    const articleSource: ArticleSourceInput = {
      gameName,
      ourArticleUrl,
      beebomArticleUrl: url,
    };

    output.article = articleSource;
    output.supabase = await saveScrapeResultToSupabase(articleSource, result);
  }

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

function readFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;

  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    return undefined;
  }

  return value;
}

function readPositionalUrl(args: string[], flagsWithValues: string[]): string | undefined {
  const skipIndexes = new Set<number>();

  flagsWithValues.forEach((flag) => {
    const index = args.indexOf(flag);
    if (index !== -1) {
      skipIndexes.add(index);
      if (args[index + 1]) {
        skipIndexes.add(index + 1);
      }
    }
  });

  return args.find((value, index) => !skipIndexes.has(index) && !value.startsWith("-"));
}
