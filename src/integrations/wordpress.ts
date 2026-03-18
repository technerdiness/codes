import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

import type { ConnectionsAnswerResult } from "../types/connections.ts";
import type { LetrosoAnswerHistoryEntry, LetrosoAnswerResult } from "../types/letroso.ts";
import type { ExpiredCode, ScrapedCode } from "../types/scraper.ts";
import type { StrandsAnswerResult } from "../types/strands.ts";
import type { WordleAnswerResult } from "../types/wordle.ts";

const DEFAULT_ACTIVE_MARKER_START = "<!-- TN_CODES_START -->";
const DEFAULT_ACTIVE_MARKER_END = "<!-- TN_CODES_END -->";
const DEFAULT_EXPIRED_MARKER_START = "<!-- TN_EXPIRED_CODES_START -->";
const DEFAULT_EXPIRED_MARKER_END = "<!-- TN_EXPIRED_CODES_END -->";
const DEFAULT_UPDATE_MARKER_START = "<!-- TN_CODES_UPDATE_START -->";
const DEFAULT_UPDATE_MARKER_END = "<!-- TN_CODES_UPDATE_END -->";
const DEFAULT_LETROSO_ARTICLE_URL = "https://www.technerdiness.com/puzzle/letroso-answers-today/";
const DEFAULT_LETROSO_MARKER_START = "<!-- TN_LETROSO_ANSWER_START -->";
const DEFAULT_LETROSO_MARKER_END = "<!-- TN_LETROSO_ANSWER_END -->";
const DEFAULT_LETROSO_HISTORY_MARKER_START = "<!-- TN_LETROSO_HISTORY_START -->";
const DEFAULT_LETROSO_HISTORY_MARKER_END = "<!-- TN_LETROSO_HISTORY_END -->";
const DEFAULT_LETROSO_CURRENT_DATE_MARKER_START = "<!-- TN_LETROSO_CURRENT_DATE_START -->";
const DEFAULT_LETROSO_CURRENT_DATE_MARKER_END = "<!-- TN_LETROSO_CURRENT_DATE_END -->";
const DEFAULT_WORDLE_ARTICLE_URL =
  "https://www.technerdiness.com/puzzle/todays-wordle-hints-answers/";
const DEFAULT_WORDLE_MARKER_START = "<!-- TN_WORDLE_ANSWER_START -->";
const DEFAULT_WORDLE_MARKER_END = "<!-- TN_WORDLE_ANSWER_END -->";
const DEFAULT_CONNECTIONS_ARTICLE_URL =
  "https://www.technerdiness.com/puzzle/todays-nyt-connections-hints-answers/";
const DEFAULT_CONNECTIONS_MARKER_START = "<!-- TN_CONNECTIONS_ANSWER_START -->";
const DEFAULT_CONNECTIONS_MARKER_END = "<!-- TN_CONNECTIONS_ANSWER_END -->";
const DEFAULT_CONNECTIONS_CURRENT_DATE_MARKER_START = "<!-- TN_CONNECTIONS_CURRENT_DATE_START -->";
const DEFAULT_CONNECTIONS_CURRENT_DATE_MARKER_END = "<!-- TN_CONNECTIONS_CURRENT_DATE_END -->";
const DEFAULT_STRANDS_ARTICLE_URL =
  "https://www.technerdiness.com/puzzle/todays-nyt-strands-hints-answers/";
const DEFAULT_STRANDS_SPANGRAM_MARKER_START = "<!-- TN_STRANDS_SPANGRAM_START -->";
const DEFAULT_STRANDS_SPANGRAM_MARKER_END = "<!-- TN_STRANDS_SPANGRAM_END -->";
const DEFAULT_STRANDS_THEME_WORDS_MARKER_START = "<!-- TN_STRANDS_THEME_WORDS_START -->";
const DEFAULT_STRANDS_THEME_WORDS_MARKER_END = "<!-- TN_STRANDS_THEME_WORDS_END -->";
const DEFAULT_STRANDS_CURRENT_DATE_MARKER_START = "<!-- TN_STRANDS_CURRENT_DATE_START -->";
const DEFAULT_STRANDS_CURRENT_DATE_MARKER_END = "<!-- TN_STRANDS_CURRENT_DATE_END -->";
const DEFAULT_STRANDS_CLUE_MARKER_START = "<!-- TN_STRANDS_CLUE_START -->";
const DEFAULT_STRANDS_CLUE_MARKER_END = "<!-- TN_STRANDS_CLUE_END -->";

type WordPressEndpointType = "posts" | "pages";
type WordPressPostType = "post" | "page";

interface WordPressPostResponse {
  id: number;
  type?: string;
  slug?: string;
  link?: string;
  title?: {
    raw?: string;
    rendered?: string;
  };
  content?: {
    raw?: string;
    rendered?: string;
  };
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env before syncing WordPress content.`);
  }
  return value;
}

function getWordPressAuthHeader(): string {
  const username = getRequiredEnv("WORDPRESS_USERNAME");
  const applicationPassword = getRequiredEnv("WORDPRESS_APPLICATION_PASSWORD");
  return `Basic ${Buffer.from(`${username}:${applicationPassword}`).toString("base64")}`;
}

function getActiveMarkerStart(): string {
  return process.env.WORDPRESS_CODES_MARKER_START?.trim() || DEFAULT_ACTIVE_MARKER_START;
}

function getActiveMarkerEnd(): string {
  return process.env.WORDPRESS_CODES_MARKER_END?.trim() || DEFAULT_ACTIVE_MARKER_END;
}

function getExpiredMarkerStart(): string {
  return (
    process.env.WORDPRESS_EXPIRED_CODES_MARKER_START?.trim() || DEFAULT_EXPIRED_MARKER_START
  );
}

function getExpiredMarkerEnd(): string {
  return process.env.WORDPRESS_EXPIRED_CODES_MARKER_END?.trim() || DEFAULT_EXPIRED_MARKER_END;
}

function getUpdateMarkerStart(): string {
  return process.env.WORDPRESS_CODES_UPDATE_MARKER_START?.trim() || DEFAULT_UPDATE_MARKER_START;
}

function getUpdateMarkerEnd(): string {
  return process.env.WORDPRESS_CODES_UPDATE_MARKER_END?.trim() || DEFAULT_UPDATE_MARKER_END;
}

function getUpdateTimezone(): string {
  return process.env.WORDPRESS_UPDATE_TIMEZONE?.trim() || process.env.TZ || "UTC";
}

function getLetrosoArticleUrl(): string {
  return process.env.WORDPRESS_LETROSO_ARTICLE_URL?.trim() || DEFAULT_LETROSO_ARTICLE_URL;
}

function getLetrosoMarkerStart(): string {
  return process.env.WORDPRESS_LETROSO_MARKER_START?.trim() || DEFAULT_LETROSO_MARKER_START;
}

function getLetrosoMarkerEnd(): string {
  return process.env.WORDPRESS_LETROSO_MARKER_END?.trim() || DEFAULT_LETROSO_MARKER_END;
}

function getLetrosoHistoryMarkerStart(): string {
  return (
    process.env.WORDPRESS_LETROSO_HISTORY_MARKER_START?.trim() ||
    DEFAULT_LETROSO_HISTORY_MARKER_START
  );
}

function getLetrosoHistoryMarkerEnd(): string {
  return (
    process.env.WORDPRESS_LETROSO_HISTORY_MARKER_END?.trim() || DEFAULT_LETROSO_HISTORY_MARKER_END
  );
}

function getLetrosoCurrentDateMarkerStart(): string {
  return (
    process.env.WORDPRESS_LETROSO_CURRENT_DATE_MARKER_START?.trim() ||
    DEFAULT_LETROSO_CURRENT_DATE_MARKER_START
  );
}

function getLetrosoCurrentDateMarkerEnd(): string {
  return (
    process.env.WORDPRESS_LETROSO_CURRENT_DATE_MARKER_END?.trim() ||
    DEFAULT_LETROSO_CURRENT_DATE_MARKER_END
  );
}

function getWordleArticleUrl(): string {
  return process.env.WORDPRESS_WORDLE_ARTICLE_URL?.trim() || DEFAULT_WORDLE_ARTICLE_URL;
}

function getWordleMarkerStart(): string {
  return process.env.WORDPRESS_WORDLE_MARKER_START?.trim() || DEFAULT_WORDLE_MARKER_START;
}

function getWordleMarkerEnd(): string {
  return process.env.WORDPRESS_WORDLE_MARKER_END?.trim() || DEFAULT_WORDLE_MARKER_END;
}

function getConnectionsArticleUrl(): string {
  return process.env.WORDPRESS_CONNECTIONS_ARTICLE_URL?.trim() || DEFAULT_CONNECTIONS_ARTICLE_URL;
}

function getConnectionsMarkerStart(): string {
  return (
    process.env.WORDPRESS_CONNECTIONS_MARKER_START?.trim() || DEFAULT_CONNECTIONS_MARKER_START
  );
}

function getConnectionsMarkerEnd(): string {
  return process.env.WORDPRESS_CONNECTIONS_MARKER_END?.trim() || DEFAULT_CONNECTIONS_MARKER_END;
}

function getConnectionsCurrentDateMarkerStart(): string {
  return (
    process.env.WORDPRESS_CONNECTIONS_CURRENT_DATE_MARKER_START?.trim() ||
    DEFAULT_CONNECTIONS_CURRENT_DATE_MARKER_START
  );
}

function getConnectionsCurrentDateMarkerEnd(): string {
  return (
    process.env.WORDPRESS_CONNECTIONS_CURRENT_DATE_MARKER_END?.trim() ||
    DEFAULT_CONNECTIONS_CURRENT_DATE_MARKER_END
  );
}

function getStrandsArticleUrl(): string {
  return process.env.WORDPRESS_STRANDS_ARTICLE_URL?.trim() || DEFAULT_STRANDS_ARTICLE_URL;
}

function getStrandsSpangramMarkerStart(): string {
  return (
    process.env.WORDPRESS_STRANDS_SPANGRAM_MARKER_START?.trim() ||
    DEFAULT_STRANDS_SPANGRAM_MARKER_START
  );
}

function getStrandsSpangramMarkerEnd(): string {
  return (
    process.env.WORDPRESS_STRANDS_SPANGRAM_MARKER_END?.trim() ||
    DEFAULT_STRANDS_SPANGRAM_MARKER_END
  );
}

function getStrandsThemeWordsMarkerStart(): string {
  return (
    process.env.WORDPRESS_STRANDS_THEME_WORDS_MARKER_START?.trim() ||
    DEFAULT_STRANDS_THEME_WORDS_MARKER_START
  );
}

function getStrandsThemeWordsMarkerEnd(): string {
  return (
    process.env.WORDPRESS_STRANDS_THEME_WORDS_MARKER_END?.trim() ||
    DEFAULT_STRANDS_THEME_WORDS_MARKER_END
  );
}

function getStrandsCurrentDateMarkerStart(): string {
  return (
    process.env.WORDPRESS_STRANDS_CURRENT_DATE_MARKER_START?.trim() ||
    DEFAULT_STRANDS_CURRENT_DATE_MARKER_START
  );
}

function getStrandsCurrentDateMarkerEnd(): string {
  return (
    process.env.WORDPRESS_STRANDS_CURRENT_DATE_MARKER_END?.trim() ||
    DEFAULT_STRANDS_CURRENT_DATE_MARKER_END
  );
}

function getStrandsClueMarkerStart(): string {
  return (
    process.env.WORDPRESS_STRANDS_CLUE_MARKER_START?.trim() || DEFAULT_STRANDS_CLUE_MARKER_START
  );
}

function getStrandsClueMarkerEnd(): string {
  return process.env.WORDPRESS_STRANDS_CLUE_MARKER_END?.trim() || DEFAULT_STRANDS_CLUE_MARKER_END;
}

function mapPostTypeToEndpoint(postType?: string | null): WordPressEndpointType[] {
  if (postType === "post") return ["posts"];
  if (postType === "page") return ["pages"];
  return ["posts", "pages"];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderWordPressCodesHtml(codes: ScrapedCode[]): string {
  const items = codes.map((code) => {
    const reward = code.rewardsText ? ` ${escapeHtml(code.rewardsText)}` : "";
    return `<li><strong>${escapeHtml(code.code)}:</strong>${reward}</li>`;
  });

  return `<ul class="wp-block-list">${items.join("")}</ul>`;
}

export function renderWordPressExpiredCodesHtml(codes: ExpiredCode[]): string {
  const text = codes.map((code) => escapeHtml(code.code)).join(", ");
  return `<p>${text}</p>`;
}

export function renderWordPressCodesUpdateHtml(gameName: string, date = new Date()): string {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    timeZone: getUpdateTimezone(),
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);

  return `<strong data-rich-text-format-boundary="true">Update: Added new ${escapeHtml(
    gameName
  )} codes on ${escapeHtml(formattedDate)}</strong><p>&nbsp;</p>`;
}

export function renderWordPressLetrosoAnswerHtml(result: LetrosoAnswerResult): string {
  const headingHtml = `<p><strong>Letroso answer for ${escapeHtml(
    formatIsoDateLong(result.answerDate)
  )}:</strong></p>`;
  const blocks = [`<p>${escapeHtml(result.answer)}</p>`];

  if (result.meaning) {
    blocks.push(
      `<p>Meaning of <em>${escapeHtml(result.answer)}</em>: ${escapeHtml(result.meaning)}</p>`
    );
  }

  return [
    "<style>",
    ".tn-letroso-answer-reveal{margin:1rem 0;}",
    ".tn-letroso-answer-reveal summary{display:inline-flex;align-items:center;justify-content:center;padding:.8rem 1.25rem;border:0;border-radius:999px;background:#111827;color:#fff;font-weight:700;cursor:pointer;list-style:none;}",
    ".tn-letroso-answer-reveal summary::-webkit-details-marker{display:none;}",
    ".tn-letroso-answer-reveal[open] summary{display:none;}",
    ".tn-letroso-answer-reveal__content{margin-top:1rem;padding:1rem 1.1rem;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;}",
    ".tn-letroso-answer-reveal__content p:last-child{margin-bottom:0;}",
    "</style>",
    headingHtml,
    `<details class="tn-letroso-answer-reveal" data-answer="${escapeHtml(result.answer)}">`,
    "<summary>Reveal Answer</summary>",
    `<div class="tn-letroso-answer-reveal__content">\n${blocks.join("\n\n")}\n</div>`,
    "</details>",
  ].join("\n");
}

export function renderWordPressLetrosoHistoryHtml(
  entries: LetrosoAnswerHistoryEntry[]
): string {
  const rows = entries.length
    ? entries
        .map(
          (entry) =>
            `<tr><td>${escapeHtml(formatIsoDateLong(entry.answerDate))}</td><td>${escapeHtml(
              entry.answer
            )}</td></tr>`
        )
        .join("")
    : '<tr><td colspan="2">No Letroso answers saved yet.</td></tr>';

  return [
    "<table>",
    "<thead><tr><th>Date</th><th>Answer</th></tr></thead>",
    `<tbody>${rows}</tbody>`,
    "</table>",
  ].join("\n");
}

export function renderWordPressLetrosoPostTitle(answerDate: string): string {
  return `Letroso Answers Today (${formatIsoDateLong(answerDate)}) – Complete Answer History`;
}

export function renderWordPressConnectionsPostTitle(
  answerDate: string,
  puzzleId: number
): string {
  return `Today's NYT Connections Hints and Answer for ${formatIsoDateMonthDay(answerDate)} (Puzzle #${puzzleId})`;
}

export function renderWordPressStrandsPostTitle(answerDate: string): string {
  return `Today's NYT Strands Answer and Hints for ${formatIsoDateMonthDay(answerDate)} (Game #${calculateStrandsGameNumber(
    answerDate
  )})`;
}

export function renderWordPressWordlePostTitle(
  answerDate: string,
  wordleNumber: number
): string {
  return `Today's NYT Wordle Answer and Hints for ${formatIsoDateMonthDay(answerDate)} (Puzzle #${wordleNumber})`;
}

export function renderWordPressWordleAnswerHtml(result: WordleAnswerResult): string {
  return renderWordPressWordleAnswerHtmlWithPrevious(result, null);
}

export function renderWordPressWordleAnswerHtmlWithPrevious(
  result: WordleAnswerResult,
  previousResult: WordleAnswerResult | null
): string {
  const sections = [renderWordleAnswerRevealSection(result, "Today's")];

  if (previousResult) {
    sections.push(renderWordleAnswerRevealSection(previousResult, "Yesterday's"));
  }

  return [
    "<style>",
    ".tn-wordle-answer-heading{margin:0 0 1rem;}",
    ".tn-wordle-answer-reveal{margin:1rem 0;}",
    ".tn-wordle-answer-reveal summary{display:inline-flex;align-items:center;justify-content:center;padding:.8rem 1.25rem;border:0;border-radius:999px;background:#111827;color:#fff;font-weight:700;cursor:pointer;list-style:none;}",
    ".tn-wordle-answer-reveal summary::-webkit-details-marker{display:none;}",
    ".tn-wordle-answer-reveal[open] summary{display:none;}",
    ".tn-wordle-answer-reveal__content{margin-top:1rem;padding:1rem 1.1rem;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;}",
    ".tn-wordle-answer-reveal__content p:last-child{margin-bottom:0;}",
    "</style>",
    `<div class="tn-wordle-answer-block" data-answer-signature="${escapeHtml(
      buildWordleAnswerSignature(result, previousResult)
    )}">`,
    sections.join("\n\n"),
    "</div>",
    ].join("\n");
}

function renderWordleAnswerRevealSection(
  result: WordleAnswerResult,
  label: "Today's" | "Yesterday's"
): string {
  const headingHtml = `<h2 class="tn-wordle-answer-heading">${label} Wordle answer (${escapeHtml(
    formatIsoDateMonthDay(result.answerDate)
  )} - game #${result.daysSinceLaunch}) is...</h2>`;
  const blocks = [`<p>${escapeHtml(result.answer)}</p>`];

  return [
    headingHtml,
    `<details class="tn-wordle-answer-reveal" data-answer="${escapeHtml(result.answer)}">`,
    "<summary>Reveal Answer</summary>",
    `<div class="tn-wordle-answer-reveal__content">\n${blocks.join("\n\n")}\n</div>`,
    "</details>",
  ].join("\n");
}

export function renderWordPressConnectionsAnswerHtml(result: ConnectionsAnswerResult): string {
  const headingHtml = `<p><strong>NYT Connections answers for ${escapeHtml(
    formatIsoDateLong(result.answerDate)
  )}:</strong></p>`;
  const rows = result.categories
    .map(
      (category) =>
        `<tr><td>${escapeHtml(category.title)}</td><td>${escapeHtml(
          category.cards.map((card) => card.content).join(", ")
        )}</td></tr>`
    )
    .join("");

  return [
    "<style>",
    ".tn-connections-answer-reveal{margin:1rem 0;}",
    ".tn-connections-answer-reveal summary{display:inline-flex;align-items:center;justify-content:center;padding:.8rem 1.25rem;border:0;border-radius:999px;background:#111827;color:#fff;font-weight:700;cursor:pointer;list-style:none;}",
    ".tn-connections-answer-reveal summary::-webkit-details-marker{display:none;}",
    ".tn-connections-answer-reveal[open] summary{display:none;}",
    ".tn-connections-answer-reveal__content{margin-top:1rem;}",
    ".tn-connections-answer-reveal__content table{width:100%;border-collapse:collapse;}",
    ".tn-connections-answer-reveal__content th,.tn-connections-answer-reveal__content td{padding:.8rem 0;text-align:left;vertical-align:top;}",
    "</style>",
    headingHtml,
    `<details class="tn-connections-answer-reveal" data-answer-signature="${escapeHtml(
      buildConnectionsAnswerSignature(result)
    )}">`,
    "<summary>Reveal Answers</summary>",
    '<div class="tn-connections-answer-reveal__content">',
    "<table>",
    "<thead><tr><th>Group</th><th>Items</th></tr></thead>",
    `<tbody>${rows}</tbody>`,
    "</table>",
    "</div>",
    "</details>",
  ].join("\n");
}

export function renderWordPressStrandsSpangramHtml(result: StrandsAnswerResult): string {
  return renderWordPressStrandsRevealHtml(
    "Reveal Spangram",
    `<p>${escapeHtml(result.spangram)}</p>`,
    `data-answer="${escapeHtml(result.spangram)}"`
  );
}

export function renderWordPressStrandsThemeWordsHtml(result: StrandsAnswerResult): string {
  const items = result.themeWords
    .map((word) => `<li>${escapeHtml(word)}</li>`)
    .join("");

  return renderWordPressStrandsRevealHtml(
    "Reveal Theme Words",
    `<ul class="wp-block-list">${items}</ul>`,
    `data-answer-signature="${escapeHtml(buildStrandsAnswerSignature(result))}"`
  );
}

function renderWordPressStrandsRevealHtml(
  summaryLabel: string,
  innerHtml: string,
  dataAttribute: string
): string {
  return [
    "<style>",
    ".tn-strands-answer-reveal{margin:1rem 0;}",
    ".tn-strands-answer-reveal summary{display:inline-flex;align-items:center;justify-content:center;padding:.8rem 1.25rem;border:0;border-radius:999px;background:#111827;color:#fff;font-weight:700;cursor:pointer;list-style:none;}",
    ".tn-strands-answer-reveal summary::-webkit-details-marker{display:none;}",
    ".tn-strands-answer-reveal[open] summary{display:none;}",
    ".tn-strands-answer-reveal__content{margin-top:1rem;padding:1rem 1.1rem;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;}",
    ".tn-strands-answer-reveal__content p:last-child,.tn-strands-answer-reveal__content ul:last-child{margin-bottom:0;}",
    "</style>",
    `<details class="tn-strands-answer-reveal" ${dataAttribute}>`,
    `<summary>${escapeHtml(summaryLabel)}</summary>`,
    `<div class="tn-strands-answer-reveal__content">\n${innerHtml}\n</div>`,
    "</details>",
  ].join("\n");
}

export function hashWordPressCodesHtml(activeHtml: string): string {
  return createHash("sha256").update(activeHtml).digest("hex");
}

function extractMarkedSectionContent(
  content: string,
  markerStart: string,
  markerEnd: string
): string | null {
  const startIndex = content.indexOf(markerStart);
  const endIndex = content.indexOf(markerEnd);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return null;
  }

  return content.slice(startIndex + markerStart.length, endIndex);
}

function replaceMarkedSection(
  content: string,
  replacementHtml: string,
  markerStart: string,
  markerEnd: string
): string {
  const startIndex = content.indexOf(markerStart);
  const endIndex = content.indexOf(markerEnd);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(
      `Could not find WordPress marker block. Add ${markerStart} and ${markerEnd} to the article content.`
    );
  }

  const before = content.slice(0, startIndex + markerStart.length);
  const after = content.slice(endIndex);
  return `${before}\n${replacementHtml}\n${after}`;
}

function replaceInlineMarkedText(
  content: string,
  replacementText: string,
  markerStart: string,
  markerEnd: string
): string {
  const startIndex = content.indexOf(markerStart);
  const endIndex = content.indexOf(markerEnd);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(
      `Could not find WordPress inline marker block. Add ${markerStart} and ${markerEnd} to the article content.`
    );
  }

  const before = content.slice(0, startIndex + markerStart.length);
  const after = content.slice(endIndex);
  return `${before}${replacementText}${after}`;
}

function replaceInlineMarkedTextIfPresent(
  content: string,
  replacementText: string,
  markerStart: string,
  markerEnd: string
): string {
  const startIndex = content.indexOf(markerStart);
  const endIndex = content.indexOf(markerEnd);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return content;
  }

  return replaceInlineMarkedText(content, replacementText, markerStart, markerEnd);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeComparisonValue(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim().toUpperCase();
  return normalized ? normalized : null;
}

function extractCurrentLetrosoAnswerFromContent(content: string): string | null {
  const answerSection = extractMarkedSectionContent(
    content,
    getLetrosoMarkerStart(),
    getLetrosoMarkerEnd()
  );

  if (!answerSection) {
    return null;
  }

  const dataAnswerMatch = answerSection.match(/data-answer="([^"]+)"/i);
  const dataAnswer = normalizeComparisonValue(dataAnswerMatch?.[1]);
  if (dataAnswer) {
    return dataAnswer;
  }

  const paragraphMatch = answerSection.match(
    /tn-letroso-answer-reveal__content[^>]*>\s*<p>(.*?)<\/p>/is
  );
  return normalizeComparisonValue(paragraphMatch?.[1] ? stripHtml(paragraphMatch[1]) : null);
}

function extractCurrentWordleAnswerSignatureFromContent(content: string): string | null {
  const answerSection = extractMarkedSectionContent(
    content,
    getWordleMarkerStart(),
    getWordleMarkerEnd()
  );

  if (!answerSection) {
    return null;
  }

  const dataSignatureMatch = answerSection.match(/data-answer-signature="([^"]+)"/i);
  const dataSignature = normalizeComparisonValue(dataSignatureMatch?.[1]);
  if (dataSignature) {
    return dataSignature;
  }

  const dataAnswerMatch = answerSection.match(/data-answer="([^"]+)"/i);
  const dataAnswer = normalizeComparisonValue(dataAnswerMatch?.[1]);
  if (dataAnswer) {
    return dataAnswer;
  }

  const paragraphMatch = answerSection.match(/tn-wordle-answer-reveal__content[^>]*>\s*<p>(.*?)<\/p>/is);
  return normalizeComparisonValue(paragraphMatch?.[1] ? stripHtml(paragraphMatch[1]) : null);
}

function buildWordleAnswerSignature(
  result: WordleAnswerResult,
  previousResult: WordleAnswerResult | null
): string {
  return normalizeComparisonValue(
    [
      result.answerDate,
      result.answer,
      String(result.daysSinceLaunch),
      previousResult?.answerDate ?? "",
      previousResult?.answer ?? "",
      previousResult ? String(previousResult.daysSinceLaunch) : "",
    ].join("::")
  ) as string;
}

function buildStrandsAnswerSignature(result: StrandsAnswerResult): string {
  return buildStrandsAnswerSignatureFromValues(result.spangram, result.themeWords);
}

function buildStrandsAnswerSignatureFromValues(spangram: string, themeWords: string[]): string {
  return normalizeComparisonValue(
    [spangram, ...themeWords].map((value) => value.trim()).join("::")
  ) as string;
}

function buildConnectionsAnswerSignature(result: ConnectionsAnswerResult): string {
  return normalizeComparisonValue(
    result.categories
      .map((category) =>
        [category.title, ...category.cards.map((card) => card.content)].join("::")
      )
      .join("||")
  ) as string;
}

function extractCurrentConnectionsAnswerSignature(content: string): string | null {
  const answerSection = extractMarkedSectionContent(
    content,
    getConnectionsMarkerStart(),
    getConnectionsMarkerEnd()
  );

  if (!answerSection) {
    return null;
  }

  const dataSignatureMatch = answerSection.match(/data-answer-signature="([^"]+)"/i);
  const dataSignature = normalizeComparisonValue(dataSignatureMatch?.[1]);
  if (dataSignature) {
    return dataSignature;
  }

  const rows = Array.from(
    answerSection.matchAll(/<tr>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/gis)
  );
  if (!rows.length) {
    return null;
  }

  return normalizeComparisonValue(
    rows
      .map((row) => `${stripHtml(row[1])}::${stripHtml(row[2])}`)
      .join("||")
  );
}

function extractCurrentStrandsSpangramFromContent(content: string): string | null {
  const spangramSection = extractMarkedSectionContent(
    content,
    getStrandsSpangramMarkerStart(),
    getStrandsSpangramMarkerEnd()
  );

  if (!spangramSection) {
    return null;
  }

  const dataAnswerMatch = spangramSection.match(/data-answer="([^"]+)"/i);
  const dataAnswer = normalizeComparisonValue(dataAnswerMatch?.[1]);
  if (dataAnswer) {
    return dataAnswer;
  }

  const paragraphMatch = spangramSection.match(/tn-strands-answer-reveal__content[^>]*>\s*<p>(.*?)<\/p>/is);
  return normalizeComparisonValue(paragraphMatch?.[1] ? stripHtml(paragraphMatch[1]) : null);
}

function extractCurrentStrandsThemeWordsFromContent(content: string): string[] | null {
  const themeWordsSection = extractMarkedSectionContent(
    content,
    getStrandsThemeWordsMarkerStart(),
    getStrandsThemeWordsMarkerEnd()
  );

  if (!themeWordsSection) {
    return null;
  }

  const items = Array.from(themeWordsSection.matchAll(/<li>(.*?)<\/li>/gis))
    .map((match) => normalizeComparisonValue(stripHtml(match[1])))
    .filter((value): value is string => Boolean(value));

  return items.length ? items : null;
}

function extractCurrentStrandsAnswerSignature(content: string): string | null {
  const spangram = extractCurrentStrandsSpangramFromContent(content);
  const themeWords = extractCurrentStrandsThemeWordsFromContent(content);

  if (spangram && themeWords?.length) {
    return buildStrandsAnswerSignatureFromValues(spangram, themeWords);
  }

  const themeWordsSection = extractMarkedSectionContent(
    content,
    getStrandsThemeWordsMarkerStart(),
    getStrandsThemeWordsMarkerEnd()
  );
  if (!themeWordsSection) {
    return null;
  }

  const dataSignatureMatch = themeWordsSection.match(/data-answer-signature="([^"]+)"/i);
  return normalizeComparisonValue(dataSignatureMatch?.[1]);
}

export function replaceMarkedSections(
  content: string,
  input: {
    activeHtml: string;
    expiredHtml: string;
    updateHtml: string;
  }
): string {
  const withActiveCodes = replaceMarkedSection(
    content,
    input.activeHtml,
    getActiveMarkerStart(),
    getActiveMarkerEnd()
  );

  const withExpiredCodes = replaceMarkedSection(
    withActiveCodes,
    input.expiredHtml,
    getExpiredMarkerStart(),
    getExpiredMarkerEnd()
  );

  return replaceMarkedSection(
    withExpiredCodes,
    input.updateHtml,
    getUpdateMarkerStart(),
    getUpdateMarkerEnd()
  );
}

async function requestWordPress<T>(url: URL, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const authHeader = headers.get("Authorization");
  if (authHeader !== "") {
    headers.set("Authorization", getWordPressAuthHeader());
  } else {
    headers.delete("Authorization");
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(`WordPress request failed with status ${response.status} for ${url.toString()}`);
  }

  return (await response.json()) as T;
}

async function lookupWordPressPostByUrl(articleUrl: string): Promise<{
  wordpressPostId: number;
  wordpressPostType: WordPressPostType;
}> {
  const siteUrl = new URL(articleUrl);
  const slug = siteUrl.pathname.split("/").filter(Boolean).at(-1);

  if (!slug) {
    throw new Error(`Could not determine WordPress slug for ${articleUrl}`);
  }

  const normalizedTargetUrl = normalizeUrlForComparison(articleUrl);

  for (const endpoint of ["posts", "pages"] as const) {
    const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}`, siteUrl.origin);
    requestUrl.searchParams.set("slug", slug);
    requestUrl.searchParams.set("_fields", "id,type,slug,link");

    const posts = await requestWordPress<WordPressPostResponse[]>(requestUrl, {
      headers: {
        Authorization: "",
      },
    });

    const matched =
      posts.find((post) => normalizeUrlForComparison(post.link) === normalizedTargetUrl) ?? posts[0];

    if (!matched?.id) {
      continue;
    }

    return {
      wordpressPostId: matched.id,
      wordpressPostType: endpoint === "posts" ? "post" : "page",
    };
  }

  throw new Error(`Could not resolve a WordPress post for ${articleUrl}`);
}

async function fetchWordPressPostContent(
  articleUrl: string,
  wordpressPostId: number,
  wordpressPostType?: string | null
): Promise<{ endpoint: WordPressEndpointType; contentRaw: string; titleRaw: string }> {
  const siteOrigin = new URL(articleUrl).origin;

  for (const endpoint of mapPostTypeToEndpoint(wordpressPostType)) {
    const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${wordpressPostId}`, siteOrigin);
    requestUrl.searchParams.set("context", "edit");

    try {
      const data = await requestWordPress<WordPressPostResponse>(requestUrl);
      const contentRaw = data.content?.raw;
      if (!contentRaw) {
        throw new Error(`WordPress ${endpoint} response did not include content.raw`);
      }
      const titleRaw = data.title?.raw ?? data.title?.rendered ?? "";

      return { endpoint, contentRaw, titleRaw };
    } catch (error) {
      if (endpoint === mapPostTypeToEndpoint(wordpressPostType).at(-1)) {
        throw error;
      }
    }
  }

  throw new Error(`Could not load WordPress post ${wordpressPostId} for ${articleUrl}`);
}

export async function updateWordPressArticleMarkedSection(input: {
  articleUrl: string;
  wordpressPostId?: number | null;
  wordpressPostType?: string | null;
  markerStart: string;
  markerEnd: string;
  replacementHtml: string;
}): Promise<{
  updated: boolean;
  wordpressPostId: number;
  wordpressPostType: WordPressPostType;
}> {
  const resolvedPostId = normalizeWordPressPostId(input.wordpressPostId);
  const resolvedPost =
    resolvedPostId && input.wordpressPostType
      ? {
          wordpressPostId: resolvedPostId,
          wordpressPostType:
            input.wordpressPostType === "page"
              ? ("page" as const)
              : ("post" as const),
        }
      : await lookupWordPressPostByUrl(input.articleUrl);

  const siteOrigin = new URL(input.articleUrl).origin;
  const { endpoint, contentRaw } = await fetchWordPressPostContent(
    input.articleUrl,
    resolvedPost.wordpressPostId,
    resolvedPost.wordpressPostType
  );
  const updatedContent = replaceMarkedSection(
    contentRaw,
    input.replacementHtml,
    input.markerStart,
    input.markerEnd
  );

  if (updatedContent === contentRaw) {
    return {
      updated: false,
      wordpressPostId: resolvedPost.wordpressPostId,
      wordpressPostType: resolvedPost.wordpressPostType,
    };
  }

  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${resolvedPost.wordpressPostId}`, siteOrigin);
  await requestWordPress(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: updatedContent,
    }),
  });

  return {
    updated: true,
    wordpressPostId: resolvedPost.wordpressPostId,
    wordpressPostType: resolvedPost.wordpressPostType,
  };
}

export async function updateWordPressArticleCodesSection(input: {
  articleUrl: string;
  wordpressPostId: number;
  wordpressPostType?: string | null;
  activeHtml: string;
  expiredHtml: string;
  updateHtml: string;
}): Promise<void> {
  const siteOrigin = new URL(input.articleUrl).origin;
  const { endpoint, contentRaw } = await fetchWordPressPostContent(
    input.articleUrl,
    input.wordpressPostId,
    input.wordpressPostType
  );
  const updatedContent = replaceMarkedSections(contentRaw, {
    activeHtml: input.activeHtml,
    expiredHtml: input.expiredHtml,
    updateHtml: input.updateHtml,
  });
  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${input.wordpressPostId}`, siteOrigin);

  await requestWordPress(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: updatedContent,
    }),
  });
}

export async function updateWordPressLetrosoAnswerSection(input: {
  result: LetrosoAnswerResult;
  history: LetrosoAnswerHistoryEntry[];
}): Promise<{
  articleUrl: string;
  wordpressPostId: number;
  wordpressPostType: WordPressPostType;
  updated: boolean;
  reason: "marker_replaced" | "no_change" | "answer_unchanged";
}> {
  const articleUrl = getLetrosoArticleUrl();
  const resolvedPost = await lookupWordPressPostByUrl(articleUrl);
  const siteOrigin = new URL(articleUrl).origin;
  const { endpoint, contentRaw, titleRaw } = await fetchWordPressPostContent(
    articleUrl,
    resolvedPost.wordpressPostId,
    resolvedPost.wordpressPostType
  );
  const currentAnswer = extractCurrentLetrosoAnswerFromContent(contentRaw);
  if (currentAnswer === normalizeComparisonValue(input.result.answer)) {
    return {
      articleUrl,
      wordpressPostId: resolvedPost.wordpressPostId,
      wordpressPostType: resolvedPost.wordpressPostType,
      updated: false,
      reason: "answer_unchanged",
    };
  }

  const updatedTitle = renderWordPressLetrosoPostTitle(input.result.answerDate);
  const withAnswer = replaceMarkedSection(
    contentRaw,
    renderWordPressLetrosoAnswerHtml(input.result),
    getLetrosoMarkerStart(),
    getLetrosoMarkerEnd()
  );
  const withHistory = replaceMarkedSection(
    withAnswer,
    renderWordPressLetrosoHistoryHtml(input.history),
    getLetrosoHistoryMarkerStart(),
    getLetrosoHistoryMarkerEnd()
  );
  const updatedContent = replaceInlineMarkedText(
    withHistory,
    escapeHtml(formatIsoDateLong(input.result.answerDate)),
    getLetrosoCurrentDateMarkerStart(),
    getLetrosoCurrentDateMarkerEnd()
  );

  if (updatedContent === contentRaw && titleRaw === updatedTitle) {
    return {
      articleUrl,
      wordpressPostId: resolvedPost.wordpressPostId,
      wordpressPostType: resolvedPost.wordpressPostType,
      updated: false,
      reason: "no_change",
    };
  }

  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${resolvedPost.wordpressPostId}`, siteOrigin);
  await requestWordPress(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: updatedContent,
      title: updatedTitle,
    }),
  });

  return {
    articleUrl,
    wordpressPostId: resolvedPost.wordpressPostId,
    wordpressPostType: resolvedPost.wordpressPostType,
    updated: true,
    reason: "marker_replaced",
  };
}

export async function updateWordPressWordleAnswerSection(input: {
  result: WordleAnswerResult;
  previousResult?: WordleAnswerResult | null;
}): Promise<{
  articleUrl: string;
  wordpressPostId: number;
  wordpressPostType: WordPressPostType;
  updated: boolean;
  reason: "marker_replaced" | "no_change" | "answer_unchanged";
}> {
  const articleUrl = getWordleArticleUrl();
  const resolvedPost = await lookupWordPressPostByUrl(articleUrl);
  const siteOrigin = new URL(articleUrl).origin;
  const { endpoint, contentRaw, titleRaw } = await fetchWordPressPostContent(
    articleUrl,
    resolvedPost.wordpressPostId,
    resolvedPost.wordpressPostType
  );
  const currentSignature = extractCurrentWordleAnswerSignatureFromContent(contentRaw);
  const nextSignature = buildWordleAnswerSignature(input.result, input.previousResult ?? null);
  const updatedTitle = renderWordPressWordlePostTitle(
    input.result.answerDate,
    input.result.daysSinceLaunch
  );
  if (currentSignature === nextSignature && titleRaw === updatedTitle) {
    return {
      articleUrl,
      wordpressPostId: resolvedPost.wordpressPostId,
      wordpressPostType: resolvedPost.wordpressPostType,
      updated: false,
      reason: "answer_unchanged",
    };
  }

  const updatedContent = replaceMarkedSection(
    contentRaw,
    renderWordPressWordleAnswerHtmlWithPrevious(input.result, input.previousResult ?? null),
    getWordleMarkerStart(),
    getWordleMarkerEnd()
  );

  if (updatedContent === contentRaw && titleRaw === updatedTitle) {
    return {
      articleUrl,
      wordpressPostId: resolvedPost.wordpressPostId,
      wordpressPostType: resolvedPost.wordpressPostType,
      updated: false,
      reason: "no_change",
    };
  }

  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${resolvedPost.wordpressPostId}`, siteOrigin);
  await requestWordPress(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: updatedContent,
      title: updatedTitle,
    }),
  });

  return {
    articleUrl,
    wordpressPostId: resolvedPost.wordpressPostId,
    wordpressPostType: resolvedPost.wordpressPostType,
    updated: true,
    reason: "marker_replaced",
  };
}

export async function updateWordPressConnectionsAnswerSection(input: {
  result: ConnectionsAnswerResult;
}): Promise<{
  articleUrl: string;
  wordpressPostId: number;
  wordpressPostType: WordPressPostType;
  updated: boolean;
  reason: "marker_replaced" | "no_change" | "answer_unchanged";
}> {
  const articleUrl = getConnectionsArticleUrl();
  const resolvedPost = await lookupWordPressPostByUrl(articleUrl);
  const siteOrigin = new URL(articleUrl).origin;
  const { endpoint, contentRaw, titleRaw } = await fetchWordPressPostContent(
    articleUrl,
    resolvedPost.wordpressPostId,
    resolvedPost.wordpressPostType
  );
  const currentSignature = extractCurrentConnectionsAnswerSignature(contentRaw);
  const nextSignature = buildConnectionsAnswerSignature(input.result);
  const updatedTitle = renderWordPressConnectionsPostTitle(
    input.result.answerDate,
    input.result.puzzleId
  );
  const expectedCurrentDate = escapeHtml(formatIsoDateMonthDay(input.result.answerDate));
  const currentDateSection = extractMarkedSectionContent(
    contentRaw,
    getConnectionsCurrentDateMarkerStart(),
    getConnectionsCurrentDateMarkerEnd()
  );
  const isCurrentDateUpToDate =
    currentDateSection === null || currentDateSection.trim() === expectedCurrentDate;

  if (currentSignature === nextSignature && titleRaw === updatedTitle && isCurrentDateUpToDate) {
    return {
      articleUrl,
      wordpressPostId: resolvedPost.wordpressPostId,
      wordpressPostType: resolvedPost.wordpressPostType,
      updated: false,
      reason: "answer_unchanged",
    };
  }

  const updatedContent = replaceMarkedSection(
    contentRaw,
    renderWordPressConnectionsAnswerHtml(input.result),
    getConnectionsMarkerStart(),
    getConnectionsMarkerEnd()
  );
  const updatedContentWithDate = replaceInlineMarkedTextIfPresent(
    updatedContent,
    expectedCurrentDate,
    getConnectionsCurrentDateMarkerStart(),
    getConnectionsCurrentDateMarkerEnd()
  );

  if (updatedContentWithDate === contentRaw && titleRaw === updatedTitle) {
    return {
      articleUrl,
      wordpressPostId: resolvedPost.wordpressPostId,
      wordpressPostType: resolvedPost.wordpressPostType,
      updated: false,
      reason: "no_change",
    };
  }

  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${resolvedPost.wordpressPostId}`, siteOrigin);
  await requestWordPress(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: updatedContentWithDate,
      title: updatedTitle,
    }),
  });

  return {
    articleUrl,
    wordpressPostId: resolvedPost.wordpressPostId,
    wordpressPostType: resolvedPost.wordpressPostType,
    updated: true,
    reason: "marker_replaced",
  };
}

export async function updateWordPressStrandsAnswerSection(input: {
  result: StrandsAnswerResult;
}): Promise<{
  articleUrl: string;
  wordpressPostId: number;
  wordpressPostType: WordPressPostType;
  updated: boolean;
  reason: "marker_replaced" | "no_change" | "answer_unchanged";
}> {
  const articleUrl = getStrandsArticleUrl();
  const resolvedPost = await lookupWordPressPostByUrl(articleUrl);
  const siteOrigin = new URL(articleUrl).origin;
  const { endpoint, contentRaw, titleRaw } = await fetchWordPressPostContent(
    articleUrl,
    resolvedPost.wordpressPostId,
    resolvedPost.wordpressPostType
  );
  const currentSignature = extractCurrentStrandsAnswerSignature(contentRaw);
  const nextSignature = buildStrandsAnswerSignature(input.result);
  const updatedTitle = renderWordPressStrandsPostTitle(input.result.answerDate);
  const expectedCurrentDate = escapeHtml(formatIsoDateMonthDay(input.result.answerDate));
  const expectedClue = escapeHtml(input.result.clue);
  const currentDateSection = extractMarkedSectionContent(
    contentRaw,
    getStrandsCurrentDateMarkerStart(),
    getStrandsCurrentDateMarkerEnd()
  );
  const currentClueSection = extractMarkedSectionContent(
    contentRaw,
    getStrandsClueMarkerStart(),
    getStrandsClueMarkerEnd()
  );
  const isCurrentDateUpToDate =
    currentDateSection === null || currentDateSection.trim() === expectedCurrentDate;
  const isClueUpToDate = currentClueSection === null || currentClueSection.trim() === expectedClue;

  if (
    currentSignature === nextSignature &&
    titleRaw === updatedTitle &&
    isCurrentDateUpToDate &&
    isClueUpToDate
  ) {
    return {
      articleUrl,
      wordpressPostId: resolvedPost.wordpressPostId,
      wordpressPostType: resolvedPost.wordpressPostType,
      updated: false,
      reason: "answer_unchanged",
    };
  }

  const withSpangram = replaceMarkedSection(
    contentRaw,
    renderWordPressStrandsSpangramHtml(input.result),
    getStrandsSpangramMarkerStart(),
    getStrandsSpangramMarkerEnd()
  );
  const updatedContent = replaceMarkedSection(
    withSpangram,
    renderWordPressStrandsThemeWordsHtml(input.result),
    getStrandsThemeWordsMarkerStart(),
    getStrandsThemeWordsMarkerEnd()
  );
  const updatedContentWithDate = replaceInlineMarkedTextIfPresent(
    updatedContent,
    expectedCurrentDate,
    getStrandsCurrentDateMarkerStart(),
    getStrandsCurrentDateMarkerEnd()
  );
  const updatedContentWithDateAndClue = replaceInlineMarkedTextIfPresent(
    updatedContentWithDate,
    expectedClue,
    getStrandsClueMarkerStart(),
    getStrandsClueMarkerEnd()
  );

  if (updatedContentWithDateAndClue === contentRaw && titleRaw === updatedTitle) {
    return {
      articleUrl,
      wordpressPostId: resolvedPost.wordpressPostId,
      wordpressPostType: resolvedPost.wordpressPostType,
      updated: false,
      reason: "no_change",
    };
  }

  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${resolvedPost.wordpressPostId}`, siteOrigin);
  await requestWordPress(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: updatedContentWithDateAndClue,
      title: updatedTitle,
    }),
  });

  return {
    articleUrl,
    wordpressPostId: resolvedPost.wordpressPostId,
    wordpressPostType: resolvedPost.wordpressPostType,
    updated: true,
    reason: "marker_replaced",
  };
}

export function normalizeWordPressPostId(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeUrlForComparison(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const normalized = new URL(value);
  normalized.hash = "";
  if (normalized.pathname !== "/" && normalized.pathname.endsWith("/")) {
    normalized.pathname = normalized.pathname.slice(0, -1);
  }

  return normalized.toString();
}

function formatIsoDateLong(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthName = monthNames[Number(month) - 1];

  return `${monthName} ${Number(day)}, ${year}`;
}

function formatIsoDateMonthDay(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return value;
  }

  const [, , month, day] = match;
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthName = monthNames[Number(month) - 1];

  return `${monthName} ${Number(day)}`;
}

function calculateStrandsGameNumber(answerDate: string): number {
  const [year, month, day] = answerDate.split("-").map((part) => Number(part));
  const answerDateUtc = Date.UTC(year, month - 1, day);
  const launchDateUtc = Date.UTC(2024, 2, 4);
  const millisPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((answerDateUtc - launchDateUtc) / millisPerDay) + 1;
}
