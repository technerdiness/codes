async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

import type { LetrosoAnswerHistoryEntry, LetrosoAnswerResult } from "./types";
import type { ExpiredCode, ScrapedCode } from "./types";

const DEFAULT_ACTIVE_MARKER_START = "<!-- TN_CODES_START -->";
const DEFAULT_ACTIVE_MARKER_END = "<!-- TN_CODES_END -->";
const DEFAULT_EXPIRED_MARKER_START = "<!-- TN_EXPIRED_CODES_START -->";
const DEFAULT_EXPIRED_MARKER_END = "<!-- TN_EXPIRED_CODES_END -->";
const DEFAULT_UPDATE_MARKER_START = "<!-- TN_CODES_UPDATE_START -->";
const DEFAULT_UPDATE_MARKER_END = "<!-- TN_CODES_UPDATE_END -->";
const DEFAULT_LETROSO_ARTICLE_URLS: Record<WordPressSiteKey, string> = {
  technerdiness: "https://www.technerdiness.com/puzzle/letroso-answers-today/",
  gamingwize: "https://www.gamingwize.com/puzzles/letroso-answers-today/",
};
const DEFAULT_LETROSO_MARKER_START = "<!-- TN_LETROSO_ANSWER_START -->";
const DEFAULT_LETROSO_MARKER_END = "<!-- TN_LETROSO_ANSWER_END -->";
const DEFAULT_LETROSO_HISTORY_MARKER_START = "<!-- TN_LETROSO_HISTORY_START -->";
const DEFAULT_LETROSO_HISTORY_MARKER_END = "<!-- TN_LETROSO_HISTORY_END -->";
const DEFAULT_LETROSO_CURRENT_DATE_MARKER_START = "<!-- TN_LETROSO_CURRENT_DATE_START -->";
const DEFAULT_LETROSO_CURRENT_DATE_MARKER_END = "<!-- TN_LETROSO_CURRENT_DATE_END -->";

type WordPressEndpointType = "posts" | "pages";
type WordPressPostType = "post" | "page";
export type WordPressSiteKey = "technerdiness" | "gamingwize";

interface WordPressPostResponse {
  id: number;
  link?: string;
  title?: {
    raw?: string;
    rendered?: string;
  };
  content?: {
    raw?: string;
  };
}

const WORDPRESS_SITE_ENV_PREFIXES: Record<WordPressSiteKey, string> = {
  technerdiness: "TN",
  gamingwize: "GW",
};

function getEnvValue(name: string, siteKey?: WordPressSiteKey): string | undefined {
  if (siteKey) {
    const siteSpecificValue = process.env[`${WORDPRESS_SITE_ENV_PREFIXES[siteKey]}_${name}`]?.trim();
    if (siteSpecificValue) {
      return siteSpecificValue;
    }
  }

  const value = process.env[name]?.trim();
  return value || undefined;
}

function getRequiredEnv(name: string, siteKey?: WordPressSiteKey): string {
  const value = getEnvValue(name, siteKey);
  if (!value) {
    const siteSpecificName = siteKey ? `${WORDPRESS_SITE_ENV_PREFIXES[siteKey]}_${name} or ` : "";
    throw new Error(`Missing ${siteSpecificName}${name}.`);
  }
  return value;
}

function getWordPressAuthHeader(siteKey?: WordPressSiteKey): string {
  const username = getRequiredEnv("WORDPRESS_USERNAME", siteKey);
  const applicationPassword = getRequiredEnv("WORDPRESS_APPLICATION_PASSWORD", siteKey);
  return `Basic ${btoa(`${username}:${applicationPassword}`)}`;
}

function getActiveMarkerStart(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_CODES_MARKER_START", siteKey) || DEFAULT_ACTIVE_MARKER_START;
}

function getActiveMarkerEnd(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_CODES_MARKER_END", siteKey) || DEFAULT_ACTIVE_MARKER_END;
}

function getExpiredMarkerStart(siteKey?: WordPressSiteKey): string {
  return (
    getEnvValue("WORDPRESS_EXPIRED_CODES_MARKER_START", siteKey) || DEFAULT_EXPIRED_MARKER_START
  );
}

function getExpiredMarkerEnd(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_EXPIRED_CODES_MARKER_END", siteKey) || DEFAULT_EXPIRED_MARKER_END;
}

function getUpdateMarkerStart(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_CODES_UPDATE_MARKER_START", siteKey) || DEFAULT_UPDATE_MARKER_START;
}

function getUpdateMarkerEnd(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_CODES_UPDATE_MARKER_END", siteKey) || DEFAULT_UPDATE_MARKER_END;
}

function getUpdateTimezone(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_UPDATE_TIMEZONE", siteKey) || process.env.TZ || "UTC";
}

function getLetrosoArticleUrl(siteKey?: WordPressSiteKey): string {
  const envUrl = getEnvValue("WORDPRESS_LETROSO_ARTICLE_URL", siteKey);
  if (envUrl) return envUrl;
  return siteKey ? DEFAULT_LETROSO_ARTICLE_URLS[siteKey] : DEFAULT_LETROSO_ARTICLE_URLS.technerdiness;
}

function getLetrosoMarkerStart(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_LETROSO_MARKER_START", siteKey) || DEFAULT_LETROSO_MARKER_START;
}

function getLetrosoMarkerEnd(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_LETROSO_MARKER_END", siteKey) || DEFAULT_LETROSO_MARKER_END;
}

function getLetrosoHistoryMarkerStart(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_LETROSO_HISTORY_MARKER_START", siteKey) || DEFAULT_LETROSO_HISTORY_MARKER_START;
}

function getLetrosoHistoryMarkerEnd(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_LETROSO_HISTORY_MARKER_END", siteKey) || DEFAULT_LETROSO_HISTORY_MARKER_END;
}

function getLetrosoCurrentDateMarkerStart(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_LETROSO_CURRENT_DATE_MARKER_START", siteKey) || DEFAULT_LETROSO_CURRENT_DATE_MARKER_START;
}

function getLetrosoCurrentDateMarkerEnd(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_LETROSO_CURRENT_DATE_MARKER_END", siteKey) || DEFAULT_LETROSO_CURRENT_DATE_MARKER_END;
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

function normalizeComparisonValue(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim().toUpperCase();
  return normalized ? normalized : null;
}

function normalizeUrlForComparison(value: string | undefined): string {
  if (!value) return "";
  const normalized = new URL(value);
  normalized.hash = "";
  if (normalized.pathname !== "/" && normalized.pathname.endsWith("/")) {
    normalized.pathname = normalized.pathname.slice(0, -1);
  }
  return normalized.toString();
}

export function renderWordPressCodesHtml(gameName: string, codes: ScrapedCode[]): string {
  if (!codes.length) {
    return `<p>As of now, there are no active codes for ${escapeHtml(gameName)}.</p>`;
  }

  const items = codes.map((code) => {
    if (code.rewardsText) {
      return `<li><strong>${escapeHtml(code.code)}:</strong> ${escapeHtml(code.rewardsText)}</li>`;
    }

    return `<li><strong>${escapeHtml(code.code)}</strong></li>`;
  });

  return `<ul class="wp-block-list">${items.join("")}</ul>`;
}

export function renderWordPressExpiredCodesHtml(gameName: string, codes: ExpiredCode[]): string {
  if (!codes.length) {
    return `<p>As of now, there are no expired codes for ${escapeHtml(gameName)}.</p>`;
  }

  const text = codes.map((code) => escapeHtml(code.code)).join(", ");
  return `<p>${text}</p>`;
}

export function renderWordPressCodesUpdateHtml(
  gameName: string,
  date = new Date(),
  siteKey?: WordPressSiteKey
): string {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    timeZone: getUpdateTimezone(siteKey),
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);

  return `<p><strong data-rich-text-format-boundary="true">Update: Added new ${escapeHtml(
    gameName
  )} codes on ${escapeHtml(formattedDate)}</strong></p>`;
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

export function renderWordPressLetrosoHistoryHtml(entries: LetrosoAnswerHistoryEntry[]): string {
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

export async function hashWordPressCodesHtml(activeHtml: string): Promise<string> {
  return sha256Hex(normalizeWordPressCodesHtml(activeHtml));
}

function normalizeWordPressCodesHtml(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function replaceMarkedSection(content: string, replacementHtml: string, markerStart: string, markerEnd: string, required = false): string {
  const startIndex = content.indexOf(markerStart);
  const endIndex = content.indexOf(markerEnd);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    if (required) {
      throw new Error(`Could not find WordPress marker block. Add ${markerStart} and ${markerEnd} to the article content.`);
    }
    console.log(`Marker not found, skipping: ${markerStart}`);
    return content;
  }

  const before = content.slice(0, startIndex + markerStart.length);
  const after = content.slice(endIndex);
  return `${before}\n${replacementHtml}\n${after}`;
}

function replaceInlineMarkedText(content: string, replacementText: string, markerStart: string, markerEnd: string, required = false): string {
  const startIndex = content.indexOf(markerStart);
  const endIndex = content.indexOf(markerEnd);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    if (required) {
      throw new Error(`Could not find WordPress inline marker block. Add ${markerStart} and ${markerEnd} to the article content.`);
    }
    console.log(`Inline marker not found, skipping: ${markerStart}`);
    return content;
  }

  const before = content.slice(0, startIndex + markerStart.length);
  const after = content.slice(endIndex);
  return `${before}${replacementText}${after}`;
}

function replaceMarkedSections(
  content: string,
  input: { activeHtml: string; expiredHtml: string; updateHtml: string },
  siteKey?: WordPressSiteKey
): string {
  const withActive = replaceMarkedSection(
    content,
    input.activeHtml,
    getActiveMarkerStart(siteKey),
    getActiveMarkerEnd(siteKey),
    true
  );
  const withExpired = replaceMarkedSection(
    withActive,
    input.expiredHtml,
    getExpiredMarkerStart(siteKey),
    getExpiredMarkerEnd(siteKey),
    true
  );
  return replaceMarkedSection(
    withExpired,
    input.updateHtml,
    getUpdateMarkerStart(siteKey),
    getUpdateMarkerEnd(siteKey),
    true
  );
}

function extractMarkedSectionContent(content: string, markerStart: string, markerEnd: string): string | null {
  const startIndex = content.indexOf(markerStart);
  const endIndex = content.indexOf(markerEnd);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return null;
  }

  return content.slice(startIndex + markerStart.length, endIndex);
}

function extractCurrentLetrosoAnswerFromContent(content: string, siteKey?: WordPressSiteKey): string | null {
  const answerSection = extractMarkedSectionContent(content, getLetrosoMarkerStart(siteKey), getLetrosoMarkerEnd(siteKey));
  if (!answerSection) {
    return null;
  }

  const dataAnswerMatch = answerSection.match(/data-answer="([^"]+)"/i);
  const dataAnswer = normalizeComparisonValue(dataAnswerMatch?.[1]);
  if (dataAnswer) {
    return dataAnswer;
  }

  const paragraphMatch = answerSection.match(/tn-letroso-answer-reveal__content[^>]*>\s*<p>(.*?)<\/p>/is);
  return normalizeComparisonValue(paragraphMatch?.[1] ? stripHtml(paragraphMatch[1]) : null);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function requestWordPress<T>(
  url: URL,
  init: RequestInit = {},
  includeAuth = true,
  siteKey?: WordPressSiteKey
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (includeAuth) {
    headers.set("Authorization", getWordPressAuthHeader(siteKey));
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

async function fetchWordPressPostContent(
  articleUrl: string,
  wordpressPostId: number,
  wordpressPostType?: string | null,
  siteKey?: WordPressSiteKey
): Promise<{
  endpoint: WordPressEndpointType;
  contentRaw: string;
  titleRaw: string;
}> {
  const siteOrigin = new URL(articleUrl).origin;

  for (const endpoint of mapPostTypeToEndpoint(wordpressPostType)) {
    const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${wordpressPostId}`, siteOrigin);
    requestUrl.searchParams.set("context", "edit");

    try {
      const data = await requestWordPress<WordPressPostResponse>(requestUrl, {}, true, siteKey);
      const contentRaw = data.content?.raw;
      if (!contentRaw) {
        throw new Error(`WordPress ${endpoint} response did not include content.raw`);
      }

      return {
        endpoint,
        contentRaw,
        titleRaw: data.title?.raw ?? data.title?.rendered ?? "",
      };
    } catch (error) {
      if (endpoint === mapPostTypeToEndpoint(wordpressPostType).at(-1)) {
        throw error;
      }
    }
  }

  throw new Error(`Could not load WordPress post ${wordpressPostId} for ${articleUrl}`);
}

export async function fetchWordPressArticleActiveCodesHash(input: {
  siteKey?: WordPressSiteKey;
  articleUrl: string;
  wordpressPostId: number;
  wordpressPostType?: string | null;
}): Promise<string | null> {
  const { contentRaw } = await fetchWordPressPostContent(
    input.articleUrl,
    input.wordpressPostId,
    input.wordpressPostType,
    input.siteKey
  );
  const activeSection = extractMarkedSectionContent(
    contentRaw,
    getActiveMarkerStart(input.siteKey),
    getActiveMarkerEnd(input.siteKey)
  );

  if (activeSection === null) {
    return null;
  }

  return hashWordPressCodesHtml(activeSection);
}

async function lookupWordPressPostByUrl(
  articleUrl: string,
  siteKey?: WordPressSiteKey
): Promise<{
  wordpressPostId: number;
  wordpressPostType: WordPressPostType;
}> {
  const siteUrl = new URL(articleUrl);
  const slug = siteUrl.pathname.split("/").filter(Boolean).at(-1);

  if (!slug) {
    throw new Error(`Could not determine WordPress slug for ${articleUrl}`);
  }

  const siteOrigin = siteUrl.origin;
  const normalizedTargetUrl = normalizeUrlForComparison(articleUrl);

  for (const endpoint of ["posts", "pages"] as const) {
    const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}`, siteOrigin);
    requestUrl.searchParams.set("slug", slug);
    requestUrl.searchParams.set("_fields", "id,link");
    requestUrl.searchParams.set("per_page", "10");

    const posts = await requestWordPress<WordPressPostResponse[]>(requestUrl, {}, false, siteKey);
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

export async function updateWordPressArticleCodesSection(input: {
  siteKey?: WordPressSiteKey;
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
    input.wordpressPostType,
    input.siteKey
  );
  const updatedContent = replaceMarkedSections(contentRaw, {
    activeHtml: input.activeHtml,
    expiredHtml: input.expiredHtml,
    updateHtml: input.updateHtml,
  }, input.siteKey);
  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${input.wordpressPostId}`, siteOrigin);

  await requestWordPress<Record<string, unknown>>(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: updatedContent,
    }),
  }, true, input.siteKey);
}

export async function updateWordPressLetrosoAnswerSection(input: {
  result: LetrosoAnswerResult;
  history: LetrosoAnswerHistoryEntry[];
  siteKey?: WordPressSiteKey;
}): Promise<{
  siteKey: WordPressSiteKey;
  articleUrl: string;
  wordpressPostId: number;
  wordpressPostType: WordPressPostType;
  updated: boolean;
  reason: "marker_replaced" | "no_change" | "answer_unchanged";
}> {
  const siteKey = input.siteKey ?? "technerdiness";
  const articleUrl = getLetrosoArticleUrl(siteKey);
  const resolvedPost = await lookupWordPressPostByUrl(articleUrl, siteKey);
  const siteOrigin = new URL(articleUrl).origin;
  const { endpoint, contentRaw, titleRaw } = await fetchWordPressPostContent(
    articleUrl,
    resolvedPost.wordpressPostId,
    resolvedPost.wordpressPostType,
    siteKey
  );
  const currentAnswer = extractCurrentLetrosoAnswerFromContent(contentRaw, siteKey);
  if (currentAnswer === normalizeComparisonValue(input.result.answer)) {
    return {
      siteKey,
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
    getLetrosoMarkerStart(siteKey),
    getLetrosoMarkerEnd(siteKey)
  );
  const withHistory = replaceMarkedSection(
    withAnswer,
    renderWordPressLetrosoHistoryHtml(input.history),
    getLetrosoHistoryMarkerStart(siteKey),
    getLetrosoHistoryMarkerEnd(siteKey)
  );
  const updatedContent = replaceInlineMarkedText(
    withHistory,
    escapeHtml(formatIsoDateLong(input.result.answerDate)),
    getLetrosoCurrentDateMarkerStart(siteKey),
    getLetrosoCurrentDateMarkerEnd(siteKey)
  );

  if (updatedContent === contentRaw && titleRaw === updatedTitle) {
    return {
      siteKey,
      articleUrl,
      wordpressPostId: resolvedPost.wordpressPostId,
      wordpressPostType: resolvedPost.wordpressPostType,
      updated: false,
      reason: "no_change",
    };
  }

  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${resolvedPost.wordpressPostId}`, siteOrigin);
  await requestWordPress<Record<string, unknown>>(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: updatedContent,
      title: updatedTitle,
    }),
  }, true, siteKey);

  return {
    siteKey,
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
