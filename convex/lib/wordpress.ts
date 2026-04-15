async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

import type { LetrosoAnswerHistoryEntry, LetrosoAnswerResult } from "./types";
import type { ContextoAnswerHistoryEntry, ContextoAnswerResult } from "./types";
import type { ExpiredCode, ScrapedCode } from "./types";
import type { ZipAnswerResult } from "./types";

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

const DEFAULT_CONTEXTO_ARTICLE_URLS: Record<WordPressSiteKey, string> = {
  technerdiness: "https://www.technerdiness.com/puzzle/contexto-answers-today/",
  gamingwize: "https://www.gamingwize.com/puzzles/contexto-answers-today/",
};
const DEFAULT_CONTEXTO_MARKER_START = "<!-- TN_CONTEXTO_ANSWER_START -->";
const DEFAULT_CONTEXTO_MARKER_END = "<!-- TN_CONTEXTO_ANSWER_END -->";
const DEFAULT_CONTEXTO_HISTORY_MARKER_START = "<!-- TN_CONTEXTO_HISTORY_START -->";
const DEFAULT_CONTEXTO_HISTORY_MARKER_END = "<!-- TN_CONTEXTO_HISTORY_END -->";
const DEFAULT_CONTEXTO_CURRENT_DATE_MARKER_START = "<!-- TN_CONTEXTO_CURRENT_DATE_START -->";
const DEFAULT_CONTEXTO_CURRENT_DATE_MARKER_END = "<!-- TN_CONTEXTO_CURRENT_DATE_END -->";

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

function getContextoArticleUrl(siteKey?: WordPressSiteKey): string {
  const envUrl = getEnvValue("WORDPRESS_CONTEXTO_ARTICLE_URL", siteKey);
  if (envUrl) return envUrl;
  return siteKey ? DEFAULT_CONTEXTO_ARTICLE_URLS[siteKey] : DEFAULT_CONTEXTO_ARTICLE_URLS.technerdiness;
}

function getContextoMarkerStart(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_CONTEXTO_MARKER_START", siteKey) || DEFAULT_CONTEXTO_MARKER_START;
}

function getContextoMarkerEnd(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_CONTEXTO_MARKER_END", siteKey) || DEFAULT_CONTEXTO_MARKER_END;
}

function getContextoHistoryMarkerStart(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_CONTEXTO_HISTORY_MARKER_START", siteKey) || DEFAULT_CONTEXTO_HISTORY_MARKER_START;
}

function getContextoHistoryMarkerEnd(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_CONTEXTO_HISTORY_MARKER_END", siteKey) || DEFAULT_CONTEXTO_HISTORY_MARKER_END;
}

function getContextoCurrentDateMarkerStart(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_CONTEXTO_CURRENT_DATE_MARKER_START", siteKey) || DEFAULT_CONTEXTO_CURRENT_DATE_MARKER_START;
}

function getContextoCurrentDateMarkerEnd(siteKey?: WordPressSiteKey): string {
  return getEnvValue("WORDPRESS_CONTEXTO_CURRENT_DATE_MARKER_END", siteKey) || DEFAULT_CONTEXTO_CURRENT_DATE_MARKER_END;
}

function extractCurrentContextoAnswerFromContent(content: string, siteKey?: WordPressSiteKey): string | null {
  const answerSection = extractMarkedSectionContent(content, getContextoMarkerStart(siteKey), getContextoMarkerEnd(siteKey));
  if (!answerSection) {
    return null;
  }

  const dataAnswerMatch = answerSection.match(/data-answer="([^"]+)"/i);
  const dataAnswer = normalizeComparisonValue(dataAnswerMatch?.[1]);
  if (dataAnswer) {
    return dataAnswer;
  }

  const paragraphMatch = answerSection.match(/tn-contexto-answer-reveal__content[^>]*>\s*<p>(.*?)<\/p>/is);
  return normalizeComparisonValue(paragraphMatch?.[1] ? stripHtml(paragraphMatch[1]) : null);
}

export function renderWordPressContextoAnswerHtml(result: ContextoAnswerResult): string {
  const headingHtml = `<p><strong>Contexto answer for ${escapeHtml(
    formatIsoDateLong(result.answerDate)
  )}:</strong></p>`;
  const answerHtml = `<p>${escapeHtml(result.answer)}</p>`;

  return [
    "<style>",
    ".tn-contexto-answer-reveal{margin:1rem 0;}",
    ".tn-contexto-answer-reveal summary{display:inline-flex;align-items:center;justify-content:center;padding:.8rem 1.25rem;border:0;border-radius:999px;background:#111827;color:#fff;font-weight:700;cursor:pointer;list-style:none;}",
    ".tn-contexto-answer-reveal summary::-webkit-details-marker{display:none;}",
    ".tn-contexto-answer-reveal[open] summary{display:none;}",
    ".tn-contexto-answer-reveal__content{margin-top:1rem;padding:1rem 1.1rem;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;}",
    ".tn-contexto-answer-reveal__content p:last-child{margin-bottom:0;}",
    "</style>",
    headingHtml,
    `<details class="tn-contexto-answer-reveal" data-answer="${escapeHtml(result.answer)}">`,
    "<summary>Reveal Answer</summary>",
    `<div class="tn-contexto-answer-reveal__content">\n${answerHtml}\n</div>`,
    "</details>",
  ].join("\n");
}

export function renderWordPressContextoHistoryHtml(entries: ContextoAnswerHistoryEntry[]): string {
  const rows = entries.length
    ? entries
        .map(
          (entry) =>
            `<tr><td>${escapeHtml(formatIsoDateLong(entry.answerDate))}</td><td>${escapeHtml(
              entry.answer
            )}</td></tr>`
        )
        .join("")
    : '<tr><td colspan="2">No Contexto answers saved yet.</td></tr>';

  return [
    "<table>",
    "<thead><tr><th>Date</th><th>Answer</th></tr></thead>",
    `<tbody>${rows}</tbody>`,
    "</table>",
  ].join("\n");
}

export function renderWordPressContextoPostTitle(answerDate: string): string {
  return `Contexto Answers Today (${formatIsoDateLong(answerDate)}) – Complete Answer History`;
}

export async function updateWordPressContextoAnswerSection(input: {
  result: ContextoAnswerResult;
  history: ContextoAnswerHistoryEntry[];
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
  const articleUrl = getContextoArticleUrl(siteKey);
  const resolvedPost = await lookupWordPressPostByUrl(articleUrl, siteKey);
  const siteOrigin = new URL(articleUrl).origin;
  const { endpoint, contentRaw, titleRaw } = await fetchWordPressPostContent(
    articleUrl,
    resolvedPost.wordpressPostId,
    resolvedPost.wordpressPostType,
    siteKey
  );
  const currentAnswer = extractCurrentContextoAnswerFromContent(contentRaw, siteKey);
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

  const updatedTitle = renderWordPressContextoPostTitle(input.result.answerDate);
  const withAnswer = replaceMarkedSection(
    contentRaw,
    renderWordPressContextoAnswerHtml(input.result),
    getContextoMarkerStart(siteKey),
    getContextoMarkerEnd(siteKey)
  );
  const withHistory = replaceMarkedSection(
    withAnswer,
    renderWordPressContextoHistoryHtml(input.history),
    getContextoHistoryMarkerStart(siteKey),
    getContextoHistoryMarkerEnd(siteKey)
  );
  const updatedContent = replaceInlineMarkedText(
    withHistory,
    escapeHtml(formatIsoDateLong(input.result.answerDate)),
    getContextoCurrentDateMarkerStart(siteKey),
    getContextoCurrentDateMarkerEnd(siteKey)
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

const MONTH_YEAR_PATTERN =
  /\((January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\)/;

export async function updateWordPressPostTitleMonthYear(input: {
  siteKey: WordPressSiteKey;
  articleUrl: string;
  wordpressPostId: number;
  wordpressPostType?: string | null;
  newMonthYear: string;
}): Promise<"updated" | "no_match" | "no_change"> {
  const { endpoint, titleRaw } = await fetchWordPressPostContent(
    input.articleUrl,
    input.wordpressPostId,
    input.wordpressPostType,
    input.siteKey
  );

  if (!MONTH_YEAR_PATTERN.test(titleRaw)) return "no_match";

  const updatedTitle = titleRaw.replace(MONTH_YEAR_PATTERN, `(${input.newMonthYear})`);
  if (updatedTitle === titleRaw) return "no_change";

  const siteOrigin = new URL(input.articleUrl).origin;
  const requestUrl = new URL(
    `/wp-json/wp/v2/${endpoint}/${input.wordpressPostId}`,
    siteOrigin
  );
  await requestWordPress<Record<string, unknown>>(
    requestUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: updatedTitle }),
    },
    true,
    input.siteKey
  );

  return "updated";
}

export function normalizeWordPressPostId(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// ── LinkedIn Zip ─────────────────────────────────────────────────────────────

const DEFAULT_GW_ZIP_ARTICLE_URL = "https://www.gamingwize.com/puzzles/today-linkedin-zip-answers/";
const DEFAULT_GW_ZIP_ANSWER_MARKER_START = "<!-- GW_ZIP_ANSWER_START -->";
const DEFAULT_GW_ZIP_ANSWER_MARKER_END = "<!-- GW_ZIP_ANSWER_END -->";
const DEFAULT_GW_ZIP_HISTORY_MARKER_START = "<!-- GW_ZIP_HISTORY_START -->";
const DEFAULT_GW_ZIP_HISTORY_MARKER_END = "<!-- GW_ZIP_HISTORY_END -->";

export interface ZipHistoryEntry {
  answerDate: string;
  puzzleId: number;
}

function getGwZipArticleUrl(): string {
  return getEnvValue("WORDPRESS_GW_ZIP_ARTICLE_URL") || DEFAULT_GW_ZIP_ARTICLE_URL;
}

function getGwZipAnswerMarkerStart(): string {
  return getEnvValue("WORDPRESS_GW_ZIP_ANSWER_MARKER_START") || DEFAULT_GW_ZIP_ANSWER_MARKER_START;
}

function getGwZipAnswerMarkerEnd(): string {
  return getEnvValue("WORDPRESS_GW_ZIP_ANSWER_MARKER_END") || DEFAULT_GW_ZIP_ANSWER_MARKER_END;
}

function getGwZipHistoryMarkerStart(): string {
  return getEnvValue("WORDPRESS_GW_ZIP_HISTORY_MARKER_START") || DEFAULT_GW_ZIP_HISTORY_MARKER_START;
}

function getGwZipHistoryMarkerEnd(): string {
  return getEnvValue("WORDPRESS_GW_ZIP_HISTORY_MARKER_END") || DEFAULT_GW_ZIP_HISTORY_MARKER_END;
}

function formatIsoDateMonthYear(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month] = match;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${monthNames[Number(month) - 1]} ${year}`;
}

const ZIP_SEGMENT_COLORS = [
  "#5a9a6b", // green
  "#4a8fa8", // steel blue
  "#6b8fd4", // periwinkle
  "#e8834a", // orange
  "#c45a8a", // pink
  "#7a5abc", // purple
  "#4abd8a", // emerald
  "#c4a83a", // gold
];

function renderZipSvg(gridSize: number, solution: number[], orderedSequence: number[]): string {
  const CELL = 64;
  const PAD = 20;
  const STROKE = 52; // thick enough to fill each cell
  const WP_R = 18;
  const svgSize = gridSize * CELL + PAD * 2;

  function cellCenter(cellIdx: number): [number, number] {
    const row = Math.floor(cellIdx / gridSize);
    const col = cellIdx % gridSize;
    return [PAD + col * CELL + CELL / 2, PAD + row * CELL + CELL / 2];
  }

  // Map each cell index → its step in the solution (0-based)
  const cellToStep = new Map<number, number>();
  solution.forEach((cellIdx, step) => cellToStep.set(cellIdx, step));

  // Find the step at which each waypoint occurs, sorted by step order
  const waypointBreaks: number[] = orderedSequence
    .map(cellIdx => cellToStep.get(cellIdx) ?? -1)
    .filter(s => s >= 0)
    .sort((a, b) => a - b);

  // Build colored segments: partition solution by waypoint steps
  const breakpoints = [0, ...waypointBreaks, solution.length - 1];
  const uniqueBreaks = [...new Set(breakpoints)].sort((a, b) => a - b);

  const parts: string[] = [];

  // Grid background cells
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const x = PAD + c * CELL;
      const y = PAD + r * CELL;
      parts.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#f0f0f0" stroke="#e0e0e0" stroke-width="1"/>`);
    }
  }

  // Colored path segments
  for (let i = 0; i < uniqueBreaks.length - 1; i++) {
    const start = uniqueBreaks[i];
    const end = uniqueBreaks[i + 1];
    const color = ZIP_SEGMENT_COLORS[i % ZIP_SEGMENT_COLORS.length];
    const segCells = solution.slice(start, end + 1);
    if (segCells.length < 2) continue;
    const points = segCells.map(cellIdx => cellCenter(cellIdx).join(",")).join(" ");
    parts.push(
      `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${STROKE}" stroke-linejoin="round" stroke-linecap="round"/>`
    );
  }

  // Waypoint circles + labels on top
  orderedSequence.forEach((cellIdx, idx) => {
    const [cx, cy] = cellCenter(cellIdx);
    const label = String(idx + 1);
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${WP_R}" fill="#1a1a1a"/>`,
      `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" fill="#ffffff" font-family="Arial, Helvetica, sans-serif">${label}</text>`
    );
  });

  return [
    `<div style="overflow-x:auto;margin:12px 0;text-align:center;">`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="${svgSize}" height="${svgSize}" style="max-width:100%;border-radius:12px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08);">`,
    ...parts,
    `</svg>`,
    `</div>`,
  ].join("\n");
}

export function renderWordPressZipAnswerHtml(result: ZipAnswerResult): string {
  const dateLabel = escapeHtml(formatIsoDateLong(result.answerDate));
  const svgHtml = renderZipSvg(result.gridSize, result.solution, result.orderedSequence);
  return [
    `<div data-puzzle-id="${result.puzzleId}">`,
    `<p><strong>Puzzle #${result.puzzleId} — ${dateLabel}</strong></p>`,
    svgHtml,
    `</div>`,
  ].join("\n");
}

export function renderWordPressZipHistoryHtml(entries: ZipHistoryEntry[]): string {
  const rows = entries.length
    ? entries
        .map((e) => `<tr><td>${escapeHtml(formatIsoDateLong(e.answerDate))}</td><td>#${e.puzzleId}</td></tr>`)
        .join("")
    : '<tr><td colspan="2">No past answers yet.</td></tr>';

  return ["<table>", "<thead><tr><th>Date</th><th>Puzzle</th></tr></thead>", `<tbody>${rows}</tbody>`, "</table>"].join("\n");
}

export function renderWordPressZipPostTitle(answerDate: string, puzzleId: number): string {
  return `LinkedIn Zip Answer Today – Puzzle #${puzzleId} (${formatIsoDateMonthYear(answerDate)})`;
}

function extractCurrentZipPuzzleIdFromContent(content: string): number | null {
  const section = extractMarkedSectionContent(content, getGwZipAnswerMarkerStart(), getGwZipAnswerMarkerEnd());
  if (!section) return null;
  const match = section.match(/data-puzzle-id="(\d+)"/i);
  return match ? Number(match[1]) : null;
}

export async function updateWordPressZipAnswerSection(input: {
  result: ZipAnswerResult;
  history: ZipHistoryEntry[];
}): Promise<{
  articleUrl: string;
  wordpressPostId: number;
  wordpressPostType: WordPressPostType;
  updated: boolean;
  reason: "marker_replaced" | "no_change" | "answer_unchanged";
}> {
  const siteKey: WordPressSiteKey = "gamingwize";
  const articleUrl = getGwZipArticleUrl();
  const resolvedPost = await lookupWordPressPostByUrl(articleUrl, siteKey);
  const siteOrigin = new URL(articleUrl).origin;
  const { endpoint, contentRaw, titleRaw } = await fetchWordPressPostContent(
    articleUrl,
    resolvedPost.wordpressPostId,
    resolvedPost.wordpressPostType,
    siteKey
  );

  const currentPuzzleId = extractCurrentZipPuzzleIdFromContent(contentRaw);
  if (currentPuzzleId === input.result.puzzleId) {
    return {
      articleUrl,
      wordpressPostId: resolvedPost.wordpressPostId,
      wordpressPostType: resolvedPost.wordpressPostType,
      updated: false,
      reason: "answer_unchanged",
    };
  }

  const updatedTitle = renderWordPressZipPostTitle(input.result.answerDate, input.result.puzzleId);
  const withAnswer = replaceMarkedSection(
    contentRaw,
    renderWordPressZipAnswerHtml(input.result),
    getGwZipAnswerMarkerStart(),
    getGwZipAnswerMarkerEnd()
  );
  const updatedContent = replaceMarkedSection(
    withAnswer,
    renderWordPressZipHistoryHtml(input.history),
    getGwZipHistoryMarkerStart(),
    getGwZipHistoryMarkerEnd()
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
  await requestWordPress<Record<string, unknown>>(
    requestUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: updatedContent, title: updatedTitle }),
    },
    true,
    siteKey
  );

  return {
    articleUrl,
    wordpressPostId: resolvedPost.wordpressPostId,
    wordpressPostType: resolvedPost.wordpressPostType,
    updated: true,
    reason: "marker_replaced",
  };
}

// ── LinkedIn Crossclimb ───────────────────────────────────────────────────────

const DEFAULT_GW_CROSSCLIMB_ARTICLE_URL = "https://www.gamingwize.com/puzzles/today-linkedin-crossclimb-answers/";
const DEFAULT_GW_CROSSCLIMB_ANSWER_MARKER_START = "<!-- GW_CROSSCLIMB_ANSWER_START -->";
const DEFAULT_GW_CROSSCLIMB_ANSWER_MARKER_END = "<!-- GW_CROSSCLIMB_ANSWER_END -->";
const DEFAULT_GW_CROSSCLIMB_HISTORY_MARKER_START = "<!-- GW_CROSSCLIMB_HISTORY_START -->";
const DEFAULT_GW_CROSSCLIMB_HISTORY_MARKER_END = "<!-- GW_CROSSCLIMB_HISTORY_END -->";

export interface CrossclimbHistoryEntry {
  answerDate: string;
  puzzleId: number;
}

function getGwCrossclimbArticleUrl(): string {
  return getEnvValue("WORDPRESS_GW_CROSSCLIMB_ARTICLE_URL") || DEFAULT_GW_CROSSCLIMB_ARTICLE_URL;
}

export function renderWordPressCrossclimbAnswerHtml(result: {
  answerDate: string;
  puzzleId: number;
  words: string[];
  clues: string[];
}): string {
  const rows = result.words.map((word, i) => {
    const clue = result.clues[i] ?? "";
    return [
      `<tr>`,
      `<td style="padding:8px 12px;font-size:15px;font-weight:700;letter-spacing:.05em;font-family:monospace;white-space:nowrap;">${escapeHtml(word)}</td>`,
      `<td style="padding:8px 12px;color:#6b7280;font-size:14px;">${escapeHtml(clue)}</td>`,
      `</tr>`,
    ].join("");
  });

  return [
    `<div data-puzzle-id="${result.puzzleId}">`,
    `<p><strong>Puzzle #${result.puzzleId} — ${escapeHtml(formatIsoDateLong(result.answerDate))}</strong></p>`,
    `<table style="border-collapse:collapse;width:100%;max-width:480px;">`,
    `<thead><tr><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #e5e7eb;">Word</th><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #e5e7eb;">Clue</th></tr></thead>`,
    `<tbody>${rows.join("")}</tbody>`,
    `</table>`,
    `</div>`,
  ].join("\n");
}

export function renderWordPressCrossclimbHistoryHtml(entries: CrossclimbHistoryEntry[]): string {
  const rows = entries.length
    ? entries.map((e) => `<tr><td>${escapeHtml(formatIsoDateLong(e.answerDate))}</td><td>#${e.puzzleId}</td></tr>`).join("")
    : '<tr><td colspan="2">No past answers yet.</td></tr>';
  return ["<table>", "<thead><tr><th>Date</th><th>Puzzle</th></tr></thead>", `<tbody>${rows}</tbody>`, "</table>"].join("\n");
}

export function renderWordPressCrossclimbPostTitle(answerDate: string, puzzleId: number): string {
  return `LinkedIn Crossclimb Answer Today – Puzzle #${puzzleId} (${formatIsoDateMonthYear(answerDate)})`;
}

function extractCurrentCrossclimbPuzzleIdFromContent(content: string): number | null {
  const section = extractMarkedSectionContent(content, DEFAULT_GW_CROSSCLIMB_ANSWER_MARKER_START, DEFAULT_GW_CROSSCLIMB_ANSWER_MARKER_END);
  if (!section) return null;
  const match = section.match(/data-puzzle-id="(\d+)"/i);
  return match ? Number(match[1]) : null;
}

export async function updateWordPressCrossclimbAnswerSection(input: {
  result: { answerDate: string; puzzleId: number; words: string[]; clues: string[] };
  history: CrossclimbHistoryEntry[];
}): Promise<{ articleUrl: string; wordpressPostId: number; wordpressPostType: WordPressPostType; updated: boolean; reason: string }> {
  const siteKey: WordPressSiteKey = "gamingwize";
  const articleUrl = getGwCrossclimbArticleUrl();
  const resolvedPost = await lookupWordPressPostByUrl(articleUrl, siteKey);
  const siteOrigin = new URL(articleUrl).origin;
  const { endpoint, contentRaw, titleRaw } = await fetchWordPressPostContent(articleUrl, resolvedPost.wordpressPostId, resolvedPost.wordpressPostType, siteKey);

  if (extractCurrentCrossclimbPuzzleIdFromContent(contentRaw) === input.result.puzzleId) {
    return { articleUrl, wordpressPostId: resolvedPost.wordpressPostId, wordpressPostType: resolvedPost.wordpressPostType, updated: false, reason: "answer_unchanged" };
  }

  const updatedTitle = renderWordPressCrossclimbPostTitle(input.result.answerDate, input.result.puzzleId);
  const withAnswer = replaceMarkedSection(contentRaw, renderWordPressCrossclimbAnswerHtml(input.result), DEFAULT_GW_CROSSCLIMB_ANSWER_MARKER_START, DEFAULT_GW_CROSSCLIMB_ANSWER_MARKER_END);
  const updatedContent = replaceMarkedSection(withAnswer, renderWordPressCrossclimbHistoryHtml(input.history), DEFAULT_GW_CROSSCLIMB_HISTORY_MARKER_START, DEFAULT_GW_CROSSCLIMB_HISTORY_MARKER_END);

  if (updatedContent === contentRaw && titleRaw === updatedTitle) {
    return { articleUrl, wordpressPostId: resolvedPost.wordpressPostId, wordpressPostType: resolvedPost.wordpressPostType, updated: false, reason: "no_change" };
  }

  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${resolvedPost.wordpressPostId}`, siteOrigin);
  await requestWordPress<Record<string, unknown>>(requestUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: updatedContent, title: updatedTitle }) }, true, siteKey);
  return { articleUrl, wordpressPostId: resolvedPost.wordpressPostId, wordpressPostType: resolvedPost.wordpressPostType, updated: true, reason: "marker_replaced" };
}

// ── LinkedIn Queens ───────────────────────────────────────────────────────────

const DEFAULT_GW_QUEENS_ARTICLE_URL = "https://www.gamingwize.com/puzzles/today-linkedin-queens-answers/";
const DEFAULT_GW_QUEENS_ANSWER_MARKER_START = "<!-- GW_QUEENS_ANSWER_START -->";
const DEFAULT_GW_QUEENS_ANSWER_MARKER_END = "<!-- GW_QUEENS_ANSWER_END -->";
const DEFAULT_GW_QUEENS_HISTORY_MARKER_START = "<!-- GW_QUEENS_HISTORY_START -->";
const DEFAULT_GW_QUEENS_HISTORY_MARKER_END = "<!-- GW_QUEENS_HISTORY_END -->";

export interface QueensHistoryEntry {
  answerDate: string;
  puzzleId: number;
}

const QUEENS_REGION_COLORS = [
  "#e8a0bf", "#a0c4e8", "#a0e8b4", "#e8d4a0",
  "#c4a0e8", "#e8a0a0", "#a0e8e0", "#e8c8a0",
  "#b4e8a0", "#d4a0e8",
];

function getGwQueensArticleUrl(): string {
  return getEnvValue("WORDPRESS_GW_QUEENS_ARTICLE_URL") || DEFAULT_GW_QUEENS_ARTICLE_URL;
}

export function renderWordPressQueensAnswerHtml(result: {
  answerDate: string;
  puzzleId: number;
  gridSize: number;
  solution: { row: number; col: number }[];
  colorGrid: number[];
}): string {
  const CELL = 52;
  const PAD = 12;
  const svgSize = result.gridSize * CELL + PAD * 2;

  const solutionSet = new Set(result.solution.map((s) => `${s.row},${s.col}`));
  const cells: string[] = [];

  for (let r = 0; r < result.gridSize; r++) {
    for (let c = 0; c < result.gridSize; c++) {
      const cellIdx = r * result.gridSize + c;
      const colorIdx = result.colorGrid[cellIdx] ?? 0;
      const color = QUEENS_REGION_COLORS[colorIdx % QUEENS_REGION_COLORS.length];
      const x = PAD + c * CELL;
      const y = PAD + r * CELL;
      const isQueen = solutionSet.has(`${r},${c}`);
      cells.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${color}" stroke="#fff" stroke-width="2"/>`);
      if (isQueen) {
        const cx = x + CELL / 2;
        const cy = y + CELL / 2;
        cells.push(`<circle cx="${cx}" cy="${cy}" r="14" fill="#1a1a1a"/>`);
        cells.push(`<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="#fff" font-family="Arial, Helvetica, sans-serif">♛</text>`);
      }
    }
  }

  return [
    `<div data-puzzle-id="${result.puzzleId}">`,
    `<p><strong>Puzzle #${result.puzzleId} — ${escapeHtml(formatIsoDateLong(result.answerDate))}</strong></p>`,
    `<div style="overflow-x:auto;margin:12px 0;text-align:center;">`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="${svgSize}" height="${svgSize}" style="max-width:100%;border-radius:12px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08);">`,
    ...cells,
    `</svg>`,
    `</div>`,
    `</div>`,
  ].join("\n");
}

export function renderWordPressQueensHistoryHtml(entries: QueensHistoryEntry[]): string {
  const rows = entries.length
    ? entries.map((e) => `<tr><td>${escapeHtml(formatIsoDateLong(e.answerDate))}</td><td>#${e.puzzleId}</td></tr>`).join("")
    : '<tr><td colspan="2">No past answers yet.</td></tr>';
  return ["<table>", "<thead><tr><th>Date</th><th>Puzzle</th></tr></thead>", `<tbody>${rows}</tbody>`, "</table>"].join("\n");
}

export function renderWordPressQueensPostTitle(answerDate: string, puzzleId: number): string {
  return `LinkedIn Queens Answer Today – Puzzle #${puzzleId} (${formatIsoDateMonthYear(answerDate)})`;
}

function extractCurrentQueensPuzzleIdFromContent(content: string): number | null {
  const section = extractMarkedSectionContent(content, DEFAULT_GW_QUEENS_ANSWER_MARKER_START, DEFAULT_GW_QUEENS_ANSWER_MARKER_END);
  if (!section) return null;
  const match = section.match(/data-puzzle-id="(\d+)"/i);
  return match ? Number(match[1]) : null;
}

export async function updateWordPressQueensAnswerSection(input: {
  result: { answerDate: string; puzzleId: number; gridSize: number; solution: { row: number; col: number }[]; colorGrid: number[] };
  history: QueensHistoryEntry[];
}): Promise<{ articleUrl: string; wordpressPostId: number; wordpressPostType: WordPressPostType; updated: boolean; reason: string }> {
  const siteKey: WordPressSiteKey = "gamingwize";
  const articleUrl = getGwQueensArticleUrl();
  const resolvedPost = await lookupWordPressPostByUrl(articleUrl, siteKey);
  const siteOrigin = new URL(articleUrl).origin;
  const { endpoint, contentRaw, titleRaw } = await fetchWordPressPostContent(articleUrl, resolvedPost.wordpressPostId, resolvedPost.wordpressPostType, siteKey);

  if (extractCurrentQueensPuzzleIdFromContent(contentRaw) === input.result.puzzleId) {
    return { articleUrl, wordpressPostId: resolvedPost.wordpressPostId, wordpressPostType: resolvedPost.wordpressPostType, updated: false, reason: "answer_unchanged" };
  }

  const updatedTitle = renderWordPressQueensPostTitle(input.result.answerDate, input.result.puzzleId);
  const withAnswer = replaceMarkedSection(contentRaw, renderWordPressQueensAnswerHtml(input.result), DEFAULT_GW_QUEENS_ANSWER_MARKER_START, DEFAULT_GW_QUEENS_ANSWER_MARKER_END);
  const updatedContent = replaceMarkedSection(withAnswer, renderWordPressQueensHistoryHtml(input.history), DEFAULT_GW_QUEENS_HISTORY_MARKER_START, DEFAULT_GW_QUEENS_HISTORY_MARKER_END);

  if (updatedContent === contentRaw && titleRaw === updatedTitle) {
    return { articleUrl, wordpressPostId: resolvedPost.wordpressPostId, wordpressPostType: resolvedPost.wordpressPostType, updated: false, reason: "no_change" };
  }

  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${resolvedPost.wordpressPostId}`, siteOrigin);
  await requestWordPress<Record<string, unknown>>(requestUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: updatedContent, title: updatedTitle }) }, true, siteKey);
  return { articleUrl, wordpressPostId: resolvedPost.wordpressPostId, wordpressPostType: resolvedPost.wordpressPostType, updated: true, reason: "marker_replaced" };
}

// ── LinkedIn Tango ────────────────────────────────────────────────────────────

const DEFAULT_GW_TANGO_ARTICLE_URL = "https://www.gamingwize.com/puzzles/today-linkedin-tango-answers/";
const DEFAULT_GW_TANGO_ANSWER_MARKER_START = "<!-- GW_TANGO_ANSWER_START -->";
const DEFAULT_GW_TANGO_ANSWER_MARKER_END = "<!-- GW_TANGO_ANSWER_END -->";
const DEFAULT_GW_TANGO_HISTORY_MARKER_START = "<!-- GW_TANGO_HISTORY_START -->";
const DEFAULT_GW_TANGO_HISTORY_MARKER_END = "<!-- GW_TANGO_HISTORY_END -->";

export interface TangoHistoryEntry {
  answerDate: string;
  puzzleId: number;
}

function getGwTangoArticleUrl(): string {
  return getEnvValue("WORDPRESS_GW_TANGO_ARTICLE_URL") || DEFAULT_GW_TANGO_ARTICLE_URL;
}

export function renderWordPressTangoAnswerHtml(result: {
  answerDate: string;
  puzzleId: number;
  gridSize: number;
  solution: string[];
  edges?: { startIdx: number; endIdx: number; isEqual: boolean }[];
}): string {
  const CELL = 56;
  const PAD = 12;
  const svgSize = result.gridSize * CELL + PAD * 2;
  const cells: string[] = [];

  for (let r = 0; r < result.gridSize; r++) {
    for (let c = 0; c < result.gridSize; c++) {
      const cellIdx = r * result.gridSize + c;
      const value = result.solution[cellIdx];
      const isSun = value === "ONE";
      const x = PAD + c * CELL;
      const y = PAD + r * CELL;
      const cx = x + CELL / 2;
      const cy = y + CELL / 2;
      const bg = isSun ? "#fff7d6" : "#e8f0ff";
      cells.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${bg}" stroke="#d1d5db" stroke-width="1.5"/>`);
      if (isSun) {
        cells.push(`<circle cx="${cx}" cy="${cy}" r="12" fill="#f59e0b"/>`);
        cells.push(`<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="18" font-family="Arial">☀</text>`);
      } else {
        cells.push(`<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="18" font-family="Arial">🌙</text>`);
      }
    }
  }

  // Render constraint edges (= or ×) between adjacent cells
  const edgeOverlays: string[] = [];
  for (const edge of result.edges ?? []) {
    const rA = Math.floor(edge.startIdx / result.gridSize);
    const cA = edge.startIdx % result.gridSize;
    const rB = Math.floor(edge.endIdx / result.gridSize);
    const cB = edge.endIdx % result.gridSize;
    const cxA = PAD + cA * CELL + CELL / 2;
    const cyA = PAD + rA * CELL + CELL / 2;
    const cxB = PAD + cB * CELL + CELL / 2;
    const cyB = PAD + rB * CELL + CELL / 2;
    const mx = (cxA + cxB) / 2;
    const my = (cyA + cyB) / 2;
    const label = edge.isEqual ? "=" : "×";
    const labelColor = edge.isEqual ? "#4f46e5" : "#dc2626";
    edgeOverlays.push(`<circle cx="${mx}" cy="${my}" r="10" fill="#fff" stroke="#d1d5db" stroke-width="1.5"/>`);
    edgeOverlays.push(`<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="bold" font-family="Arial" fill="${labelColor}">${label}</text>`);
  }

  return [
    `<div data-puzzle-id="${result.puzzleId}">`,
    `<p><strong>Puzzle #${result.puzzleId} — ${escapeHtml(formatIsoDateLong(result.answerDate))}</strong></p>`,
    `<div style="overflow-x:auto;margin:12px 0;text-align:center;">`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="${svgSize}" height="${svgSize}" style="max-width:100%;border-radius:12px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08);">`,
    ...cells,
    ...edgeOverlays,
    `</svg>`,
    `</div>`,
    `</div>`,
  ].join("\n");
}

export function renderWordPressTangoHistoryHtml(entries: TangoHistoryEntry[]): string {
  const rows = entries.length
    ? entries.map((e) => `<tr><td>${escapeHtml(formatIsoDateLong(e.answerDate))}</td><td>#${e.puzzleId}</td></tr>`).join("")
    : '<tr><td colspan="2">No past answers yet.</td></tr>';
  return ["<table>", "<thead><tr><th>Date</th><th>Puzzle</th></tr></thead>", `<tbody>${rows}</tbody>`, "</table>"].join("\n");
}

export function renderWordPressTangoPostTitle(answerDate: string, puzzleId: number): string {
  return `LinkedIn Tango Answer Today – Puzzle #${puzzleId} (${formatIsoDateMonthYear(answerDate)})`;
}

function extractCurrentTangoPuzzleIdFromContent(content: string): number | null {
  const section = extractMarkedSectionContent(content, DEFAULT_GW_TANGO_ANSWER_MARKER_START, DEFAULT_GW_TANGO_ANSWER_MARKER_END);
  if (!section) return null;
  const match = section.match(/data-puzzle-id="(\d+)"/i);
  return match ? Number(match[1]) : null;
}

export async function updateWordPressTangoAnswerSection(input: {
  result: { answerDate: string; puzzleId: number; gridSize: number; solution: string[]; edges?: { startIdx: number; endIdx: number; isEqual: boolean }[] };
  history: TangoHistoryEntry[];
}): Promise<{ articleUrl: string; wordpressPostId: number; wordpressPostType: WordPressPostType; updated: boolean; reason: string }> {
  const siteKey: WordPressSiteKey = "gamingwize";
  const articleUrl = getGwTangoArticleUrl();
  const resolvedPost = await lookupWordPressPostByUrl(articleUrl, siteKey);
  const siteOrigin = new URL(articleUrl).origin;
  const { endpoint, contentRaw, titleRaw } = await fetchWordPressPostContent(articleUrl, resolvedPost.wordpressPostId, resolvedPost.wordpressPostType, siteKey);

  if (extractCurrentTangoPuzzleIdFromContent(contentRaw) === input.result.puzzleId) {
    return { articleUrl, wordpressPostId: resolvedPost.wordpressPostId, wordpressPostType: resolvedPost.wordpressPostType, updated: false, reason: "answer_unchanged" };
  }

  const updatedTitle = renderWordPressTangoPostTitle(input.result.answerDate, input.result.puzzleId);
  const withAnswer = replaceMarkedSection(contentRaw, renderWordPressTangoAnswerHtml(input.result), DEFAULT_GW_TANGO_ANSWER_MARKER_START, DEFAULT_GW_TANGO_ANSWER_MARKER_END);
  const updatedContent = replaceMarkedSection(withAnswer, renderWordPressTangoHistoryHtml(input.history), DEFAULT_GW_TANGO_HISTORY_MARKER_START, DEFAULT_GW_TANGO_HISTORY_MARKER_END);

  if (updatedContent === contentRaw && titleRaw === updatedTitle) {
    return { articleUrl, wordpressPostId: resolvedPost.wordpressPostId, wordpressPostType: resolvedPost.wordpressPostType, updated: false, reason: "no_change" };
  }

  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${resolvedPost.wordpressPostId}`, siteOrigin);
  await requestWordPress<Record<string, unknown>>(requestUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: updatedContent, title: updatedTitle }) }, true, siteKey);
  return { articleUrl, wordpressPostId: resolvedPost.wordpressPostId, wordpressPostType: resolvedPost.wordpressPostType, updated: true, reason: "marker_replaced" };
}

// ── LinkedIn Mini Sudoku ──────────────────────────────────────────────────────

const DEFAULT_GW_MINI_SUDOKU_ARTICLE_URL = "https://www.gamingwize.com/puzzles/today-linkedin-mini-sudoku-answers/";
const DEFAULT_GW_MINI_SUDOKU_ANSWER_MARKER_START = "<!-- GW_MINI_SUDOKU_ANSWER_START -->";
const DEFAULT_GW_MINI_SUDOKU_ANSWER_MARKER_END = "<!-- GW_MINI_SUDOKU_ANSWER_END -->";
const DEFAULT_GW_MINI_SUDOKU_HISTORY_MARKER_START = "<!-- GW_MINI_SUDOKU_HISTORY_START -->";
const DEFAULT_GW_MINI_SUDOKU_HISTORY_MARKER_END = "<!-- GW_MINI_SUDOKU_HISTORY_END -->";

export interface MiniSudokuHistoryEntry {
  answerDate: string;
  puzzleId: number;
  name: string;
}

function getGwMiniSudokuArticleUrl(): string {
  return getEnvValue("WORDPRESS_GW_MINI_SUDOKU_ARTICLE_URL") || DEFAULT_GW_MINI_SUDOKU_ARTICLE_URL;
}

export function renderWordPressMiniSudokuAnswerHtml(result: {
  answerDate: string;
  puzzleId: number;
  name: string;
  gridRowSize: number;
  gridColSize: number;
  solution: number[];
  presetCellIdxes: number[];
}): string {
  const CELL = 52;
  const PAD = 12;
  const svgW = result.gridColSize * CELL + PAD * 2;
  const svgH = result.gridRowSize * CELL + PAD * 2;
  const presetSet = new Set(result.presetCellIdxes);
  const cells: string[] = [];

  for (let r = 0; r < result.gridRowSize; r++) {
    for (let c = 0; c < result.gridColSize; c++) {
      const cellIdx = r * result.gridColSize + c;
      const value = result.solution[cellIdx];
      const isPreset = presetSet.has(cellIdx);
      const x = PAD + c * CELL;
      const y = PAD + r * CELL;
      const cx = x + CELL / 2;
      const cy = y + CELL / 2;

      // Bold border at box boundaries (2x3 boxes)
      const borderRight = (c + 1) % 3 === 0 && c < result.gridColSize - 1 ? "3" : "1";
      const borderBottom = (r + 1) % 2 === 0 && r < result.gridRowSize - 1 ? "3" : "1";

      cells.push(
        `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${isPreset ? "#e8f0fe" : "#fff"}" stroke="#9ca3af" stroke-width="1"/>`,
        // thick right border
        ...(borderRight === "3" ? [`<line x1="${x + CELL}" y1="${y}" x2="${x + CELL}" y2="${y + CELL}" stroke="#374151" stroke-width="2.5"/>`] : []),
        // thick bottom border
        ...(borderBottom === "3" ? [`<line x1="${x}" y1="${y + CELL}" x2="${x + CELL}" y2="${y + CELL}" stroke="#374151" stroke-width="2.5"/>`] : []),
        `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="${isPreset ? 17 : 15}" font-weight="${isPreset ? "700" : "400"}" fill="${isPreset ? "#1e40af" : "#374151"}" font-family="Arial, Helvetica, sans-serif">${value ?? ""}</text>`
      );
    }
  }

  return [
    `<div data-puzzle-id="${result.puzzleId}">`,
    `<p><strong>Puzzle #${result.puzzleId} "${escapeHtml(result.name)}" — ${escapeHtml(formatIsoDateLong(result.answerDate))}</strong></p>`,
    `<div style="overflow-x:auto;margin:12px 0;text-align:center;">`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="max-width:100%;border-radius:12px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08);border:2px solid #374151;">`,
    ...cells,
    `</svg>`,
    `</div>`,
    `<p style="font-size:13px;color:#6b7280;margin-top:4px;">Bold blue numbers = pre-filled clues.</p>`,
    `</div>`,
  ].join("\n");
}

export function renderWordPressMiniSudokuHistoryHtml(entries: MiniSudokuHistoryEntry[]): string {
  const rows = entries.length
    ? entries.map((e) => `<tr><td>${escapeHtml(formatIsoDateLong(e.answerDate))}</td><td>#${e.puzzleId}</td><td>${escapeHtml(e.name)}</td></tr>`).join("")
    : '<tr><td colspan="3">No past answers yet.</td></tr>';
  return ["<table>", "<thead><tr><th>Date</th><th>Puzzle</th><th>Name</th></tr></thead>", `<tbody>${rows}</tbody>`, "</table>"].join("\n");
}

export function renderWordPressMiniSudokuPostTitle(answerDate: string, puzzleId: number): string {
  return `LinkedIn Mini Sudoku Answer Today – Puzzle #${puzzleId} (${formatIsoDateMonthYear(answerDate)})`;
}

function extractCurrentMiniSudokuPuzzleIdFromContent(content: string): number | null {
  const section = extractMarkedSectionContent(content, DEFAULT_GW_MINI_SUDOKU_ANSWER_MARKER_START, DEFAULT_GW_MINI_SUDOKU_ANSWER_MARKER_END);
  if (!section) return null;
  const match = section.match(/data-puzzle-id="(\d+)"/i);
  return match ? Number(match[1]) : null;
}

export async function updateWordPressMiniSudokuAnswerSection(input: {
  result: { answerDate: string; puzzleId: number; name: string; gridRowSize: number; gridColSize: number; solution: number[]; presetCellIdxes: number[] };
  history: MiniSudokuHistoryEntry[];
}): Promise<{ articleUrl: string; wordpressPostId: number; wordpressPostType: WordPressPostType; updated: boolean; reason: string }> {
  const siteKey: WordPressSiteKey = "gamingwize";
  const articleUrl = getGwMiniSudokuArticleUrl();
  const resolvedPost = await lookupWordPressPostByUrl(articleUrl, siteKey);
  const siteOrigin = new URL(articleUrl).origin;
  const { endpoint, contentRaw, titleRaw } = await fetchWordPressPostContent(articleUrl, resolvedPost.wordpressPostId, resolvedPost.wordpressPostType, siteKey);

  if (extractCurrentMiniSudokuPuzzleIdFromContent(contentRaw) === input.result.puzzleId) {
    return { articleUrl, wordpressPostId: resolvedPost.wordpressPostId, wordpressPostType: resolvedPost.wordpressPostType, updated: false, reason: "answer_unchanged" };
  }

  const updatedTitle = renderWordPressMiniSudokuPostTitle(input.result.answerDate, input.result.puzzleId);
  const withAnswer = replaceMarkedSection(contentRaw, renderWordPressMiniSudokuAnswerHtml(input.result), DEFAULT_GW_MINI_SUDOKU_ANSWER_MARKER_START, DEFAULT_GW_MINI_SUDOKU_ANSWER_MARKER_END);
  const updatedContent = replaceMarkedSection(withAnswer, renderWordPressMiniSudokuHistoryHtml(input.history), DEFAULT_GW_MINI_SUDOKU_HISTORY_MARKER_START, DEFAULT_GW_MINI_SUDOKU_HISTORY_MARKER_END);

  if (updatedContent === contentRaw && titleRaw === updatedTitle) {
    return { articleUrl, wordpressPostId: resolvedPost.wordpressPostId, wordpressPostType: resolvedPost.wordpressPostType, updated: false, reason: "no_change" };
  }

  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${resolvedPost.wordpressPostId}`, siteOrigin);
  await requestWordPress<Record<string, unknown>>(requestUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: updatedContent, title: updatedTitle }) }, true, siteKey);
  return { articleUrl, wordpressPostId: resolvedPost.wordpressPostId, wordpressPostType: resolvedPost.wordpressPostType, updated: true, reason: "marker_replaced" };
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
