import { createHash } from "node:crypto";

import type { LetrosoAnswerResult } from "../types/letroso.ts";
import type { ExpiredCode, ScrapedCode } from "../types/scraper.ts";

const DEFAULT_ACTIVE_MARKER_START = "<!-- TN_CODES_START -->";
const DEFAULT_ACTIVE_MARKER_END = "<!-- TN_CODES_END -->";
const DEFAULT_EXPIRED_MARKER_START = "<!-- TN_EXPIRED_CODES_START -->";
const DEFAULT_EXPIRED_MARKER_END = "<!-- TN_EXPIRED_CODES_END -->";
const DEFAULT_UPDATE_MARKER_START = "<!-- TN_CODES_UPDATE_START -->";
const DEFAULT_UPDATE_MARKER_END = "<!-- TN_CODES_UPDATE_END -->";
const DEFAULT_LETROSO_ARTICLE_URL = "https://www.technerdiness.com/puzzle/letroso-answers-today/";
const DEFAULT_LETROSO_MARKER_START = "<!-- TN_LETROSO_ANSWER_START -->";
const DEFAULT_LETROSO_MARKER_END = "<!-- TN_LETROSO_ANSWER_END -->";

type WordPressEndpointType = "posts" | "pages";
type WordPressPostType = "post" | "page";

interface WordPressPostResponse {
  id: number;
  type?: string;
  slug?: string;
  link?: string;
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
  const blocks = [
    `<p><strong>Letroso answer for ${escapeHtml(formatIsoDateLong(result.answerDate))}:</strong></p>`,
    `<p>${escapeHtml(result.answer)}</p>`,
  ];

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
    `<details class="tn-letroso-answer-reveal">`,
    "<summary>Reveal Answer</summary>",
    `<div class="tn-letroso-answer-reveal__content">\n${blocks.join("\n\n")}\n</div>`,
    "</details>",
  ].join("\n");
}

export function hashWordPressCodesHtml(activeHtml: string): string {
  return createHash("sha256").update(activeHtml).digest("hex");
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
): Promise<{ endpoint: WordPressEndpointType; contentRaw: string }> {
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

      return { endpoint, contentRaw };
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

export async function updateWordPressLetrosoAnswerSection(
  result: LetrosoAnswerResult
): Promise<{
  articleUrl: string;
  wordpressPostId: number;
  wordpressPostType: WordPressPostType;
  updated: boolean;
  reason: "marker_replaced" | "no_change";
}> {
  const articleUrl = getLetrosoArticleUrl();
  const updateResult = await updateWordPressArticleMarkedSection({
    articleUrl,
    markerStart: getLetrosoMarkerStart(),
    markerEnd: getLetrosoMarkerEnd(),
    replacementHtml: renderWordPressLetrosoAnswerHtml(result),
  });

  return {
    articleUrl,
    wordpressPostId: updateResult.wordpressPostId,
    wordpressPostType: updateResult.wordpressPostType,
    updated: updateResult.updated,
    reason: updateResult.updated ? "marker_replaced" : "no_change",
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
