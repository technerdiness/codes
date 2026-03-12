import "dotenv/config";

import * as cheerio from "cheerio";

import type { ArticleSourceInput } from "./scraper-types.ts";
import { upsertArticleSourceToSupabase } from "./supabase-storage.ts";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1FEE9Uhy4UKjawkut2q5LQkYdYgh1-fFwU47wps1TNgM/gviz/tq?tqx=out:json&sheet=codes";
const USER_AGENT = "Mozilla/5.0 (compatible; RobloxCodesBot/1.0)";

interface GoogleSheetCell {
  v?: string | null;
}

interface GoogleSheetRow {
  c?: Array<GoogleSheetCell | null>;
}

interface GoogleSheetResponse {
  table?: {
    rows?: GoogleSheetRow[];
  };
}

interface ImportFailure {
  rowNumber: number;
  reason: string;
}

interface PreparedArticleRow extends ArticleSourceInput {
  rowNumber: number;
}

function extractJsonFromGoogleResponse(raw: string): GoogleSheetResponse {
  const prefix = "google.visualization.Query.setResponse(";
  const suffix = ");";
  const trimmed = raw.trim();
  const start = trimmed.indexOf(prefix);
  const end = trimmed.lastIndexOf(suffix);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Unexpected Google Sheets response format.");
  }

  return JSON.parse(trimmed.slice(start + prefix.length, end)) as GoogleSheetResponse;
}

function getCellValue(row: GoogleSheetRow, index: number): string {
  const value = row.c?.[index]?.v;
  return typeof value === "string" ? value.trim() : "";
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function deriveGameNameFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const slug = pathname
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(/-codes?$/i, "")
    .replace(/^roblox-/i, "")
    .replace(/-/g, " ")
    .trim();

  if (!slug) {
    throw new Error(`Could not derive a game name from URL: ${url}`);
  }

  return toTitleCase(slug);
}

function normalizeGameName(raw: string): string {
  return raw
    .replace(/\s*\|\s*Beebom.*$/i, "")
    .replace(/\s*[-|]\s*Beebom.*$/i, "")
    .replace(/^Roblox\s+/i, "")
    .replace(/\s+Codes?.*$/i, "")
    .trim();
}

async function resolveGameName(beebomArticleUrl: string, ourArticleUrl: string): Promise<string> {
  try {
    const res = await fetch(beebomArticleUrl, {
      headers: { "user-agent": USER_AGENT },
    });

    if (!res.ok) {
      throw new Error(`Beebom returned ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const heading =
      $("h1").first().text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $("title").text().trim();

    const normalized = heading ? normalizeGameName(heading) : "";
    if (normalized) {
      return normalized;
    }
  } catch {
    // Fall back to slug-based naming when the source page is missing or malformed.
  }

  return deriveGameNameFromUrl(ourArticleUrl);
}

async function fetchSheetRows(): Promise<GoogleSheetRow[]> {
  const res = await fetch(SHEET_URL, {
    headers: { "user-agent": USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Google Sheet: ${res.status}`);
  }

  const text = await res.text();
  const parsed = extractJsonFromGoogleResponse(text);
  return parsed.table?.rows ?? [];
}

async function prepareRows(rows: GoogleSheetRow[]): Promise<{
  articles: PreparedArticleRow[];
  failures: ImportFailure[];
}> {
  const articles: PreparedArticleRow[] = [];
  const failures: ImportFailure[] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 1;
    const ourArticleUrl = getCellValue(row, 1);
    const beebomArticleUrl = getCellValue(row, 2);

    if (!ourArticleUrl && !beebomArticleUrl) {
      continue;
    }

    if (!ourArticleUrl || !beebomArticleUrl) {
      failures.push({
        rowNumber,
        reason: "Missing Technerdiness URL or Beebom URL.",
      });
      continue;
    }

    try {
      const gameName = await resolveGameName(beebomArticleUrl, ourArticleUrl);

      articles.push({
        rowNumber,
        gameName,
        ourArticleUrl,
        beebomArticleUrl,
      });
    } catch (error) {
      failures.push({
        rowNumber,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { articles, failures };
}

async function importArticles(articles: PreparedArticleRow[]): Promise<ImportFailure[]> {
  const failures: ImportFailure[] = [];

  for (const article of articles) {
    try {
      await upsertArticleSourceToSupabase(article);
    } catch (error) {
      failures.push({
        rowNumber: article.rowNumber,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return failures;
}

async function main(): Promise<void> {
  const rows = await fetchSheetRows();
  const { articles, failures: preparationFailures } = await prepareRows(rows);
  const importFailures = await importArticles(articles);

  console.log(
    JSON.stringify(
      {
        sheet: "codes",
        totalSheetRows: rows.length,
        preparedArticles: articles.length,
        importedArticles: articles.length - importFailures.length,
        skippedOrFailedRows: [...preparationFailures, ...importFailures],
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
