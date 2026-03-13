import { createHash } from "node:crypto";

import type { ExpiredCode, ScrapedCode } from "./scraper-types.ts";

const DEFAULT_ACTIVE_MARKER_START = "<!-- TN_CODES_START -->";
const DEFAULT_ACTIVE_MARKER_END = "<!-- TN_CODES_END -->";
const DEFAULT_EXPIRED_MARKER_START = "<!-- TN_EXPIRED_CODES_START -->";
const DEFAULT_EXPIRED_MARKER_END = "<!-- TN_EXPIRED_CODES_END -->";
const DEFAULT_UPDATE_MARKER_START = "<!-- TN_CODES_UPDATE_START -->";
const DEFAULT_UPDATE_MARKER_END = "<!-- TN_CODES_UPDATE_END -->";

type WordPressEndpointType = "posts" | "pages";

interface WordPressPostResponse {
  id: number;
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
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: getWordPressAuthHeader(),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`WordPress request failed with status ${response.status} for ${url.toString()}`);
  }

  return (await response.json()) as T;
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

export function normalizeWordPressPostId(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
