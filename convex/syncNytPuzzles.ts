"use node";

import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";

type PuzzleName = "wordle" | "connections" | "strands";
type WordPressEndpointType = "posts" | "pages";
type WordPressPostType = "post" | "page";
type ConnectionsCategoryColor = "yellow" | "green" | "blue" | "purple";
type StrandsCoordinate = [number, number];

interface SyncRequestPayload {
  answerDate?: string;
  timezoneId?: string;
  puzzles?: PuzzleName[];
  dryRun?: boolean;
}

interface SyncSummary {
  answerDate: string;
  dryRun: boolean;
  puzzles: Record<string, Record<string, unknown>>;
}

interface WordPressPostResponse {
  id: number;
  type?: string;
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

interface LoadedWordPressPost {
  articleUrl: string;
  endpoint: WordPressEndpointType;
  wordpressPostId: number;
  wordpressPostType: WordPressPostType;
  siteOrigin: string;
  contentRaw: string;
  titleRaw: string;
}

interface WordleAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  answerDateSource: "api:print-date" | "fetched-at";
  answer: string;
  puzzleId: number;
  daysSinceLaunch: number;
  editor: string | null;
  extractedFrom: "nyt:solution-endpoint";
}

interface ConnectionsCategoryCard {
  content: string;
  position: number | null;
}

interface ConnectionsCategory {
  color: ConnectionsCategoryColor;
  title: string;
  cards: ConnectionsCategoryCard[];
}

interface ConnectionsAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  answerDateSource: "api:print-date" | "fetched-at";
  puzzleId: number;
  editor: string | null;
  categories: ConnectionsCategory[];
  extractedFrom: "nyt:connections-endpoint";
}

interface StrandsAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  answerDateSource: "api:print-date" | "fetched-at";
  puzzleId: number;
  clue: string;
  spangram: string;
  spangramCoords: StrandsCoordinate[];
  themeWords: string[];
  themeCoords: Record<string, StrandsCoordinate[]>;
  editor: string | null;
  constructors: string | null;
  startingBoard: string[];
  extractedFrom: "nyt:strands-endpoint";
}

interface NytWordleApiResponse {
  id: number;
  solution: string;
  print_date: string;
  days_since_launch: number;
  editor?: string;
}

interface NytConnectionsApiCard {
  content: string;
  position?: number;
}

interface NytConnectionsApiCategory {
  title: string;
  cards: NytConnectionsApiCard[];
}

interface NytConnectionsApiResponse {
  id: number;
  print_date: string;
  editor?: string;
  categories: NytConnectionsApiCategory[];
}

interface NytStrandsApiResponse {
  id: number;
  printDate: string;
  themeWords: string[];
  editor?: string;
  constructors?: string;
  spangram: string;
  clue: string;
  startingBoard?: string[];
  themeCoords?: Record<string, number[][]>;
  spangramCoords?: number[][];
}

const DEFAULT_WORDLE_ARTICLE_URL =
  "https://www.technerdiness.com/puzzle/todays-wordle-hints-answers/";
const DEFAULT_GW_WORDLE_ARTICLE_URL =
  "https://www.gamingwize.com/puzzles/todays-wordle-hints-answers/";
const DEFAULT_WORDLE_MARKER_START = "<!-- TN_WORDLE_ANSWER_START -->";
const DEFAULT_WORDLE_MARKER_END = "<!-- TN_WORDLE_ANSWER_END -->";
const DEFAULT_WORDLE_HISTORY_MARKER_START = "<!-- TN_WORDLE_HISTORY_START -->";
const DEFAULT_WORDLE_HISTORY_MARKER_END = "<!-- TN_WORDLE_HISTORY_END -->";
const DEFAULT_CONNECTIONS_ARTICLE_URL =
  "https://www.technerdiness.com/puzzle/todays-nyt-connections-hints-answers/";
const DEFAULT_GW_CONNECTIONS_ARTICLE_URL =
  "https://www.gamingwize.com/puzzles/today-nyt-connections-hints-answers/";
const DEFAULT_CONNECTIONS_MARKER_START = "<!-- TN_CONNECTIONS_ANSWER_START -->";
const DEFAULT_CONNECTIONS_MARKER_END = "<!-- TN_CONNECTIONS_ANSWER_END -->";
const DEFAULT_CONNECTIONS_CURRENT_DATE_MARKER_START = "<!-- TN_CONNECTIONS_CURRENT_DATE_START -->";
const DEFAULT_CONNECTIONS_CURRENT_DATE_MARKER_END = "<!-- TN_CONNECTIONS_CURRENT_DATE_END -->";
const DEFAULT_STRANDS_ARTICLE_URL =
  "https://www.technerdiness.com/puzzle/todays-nyt-strands-hints-answers/";
const DEFAULT_GW_STRANDS_ARTICLE_URL =
  "https://www.gamingwize.com/puzzles/todays-nyt-strands-hints-answers/";
const DEFAULT_STRANDS_SPANGRAM_MARKER_START = "<!-- TN_STRANDS_SPANGRAM_START -->";
const DEFAULT_STRANDS_SPANGRAM_MARKER_END = "<!-- TN_STRANDS_SPANGRAM_END -->";
const DEFAULT_STRANDS_THEME_WORDS_MARKER_START = "<!-- TN_STRANDS_THEME_WORDS_START -->";
const DEFAULT_STRANDS_THEME_WORDS_MARKER_END = "<!-- TN_STRANDS_THEME_WORDS_END -->";
const DEFAULT_STRANDS_CURRENT_DATE_MARKER_START = "<!-- TN_STRANDS_CURRENT_DATE_START -->";
const DEFAULT_STRANDS_CURRENT_DATE_MARKER_END = "<!-- TN_STRANDS_CURRENT_DATE_END -->";
const DEFAULT_STRANDS_CLUE_MARKER_START = "<!-- TN_STRANDS_CLUE_START -->";
const DEFAULT_STRANDS_CLUE_MARKER_END = "<!-- TN_STRANDS_CLUE_END -->";
const WORDLE_SOURCE_URL = "https://www.nytimes.com/svc/wordle/v2";
const CONNECTIONS_SOURCE_URL = "https://www.nytimes.com/svc/connections/v2";
const STRANDS_SOURCE_URL = "https://www.nytimes.com/svc/strands/v2";
const CONNECTIONS_COLORS = ["yellow", "green", "blue", "purple"] as const;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEnvValue(name: string, fallback?: string): string {
  return process.env[name]?.trim() || fallback || "";
}

function isPuzzleName(value: unknown): value is PuzzleName {
  return value === "wordle" || value === "connections" || value === "strands";
}

function getWordPressAuthHeader(envPrefix?: string): string {
  const prefixed = (name: string) => envPrefix ? `${envPrefix}_${name}` : name;
  const username = getRequiredEnv(prefixed("WORDPRESS_USERNAME"));
  const applicationPassword = getRequiredEnv(prefixed("WORDPRESS_APPLICATION_PASSWORD"));
  return `Basic ${btoa(`${username}:${applicationPassword}`)}`;
}

function getWordleArticleUrl(): string {
  return getEnvValue("WORDPRESS_WORDLE_ARTICLE_URL", DEFAULT_WORDLE_ARTICLE_URL);
}

function getGwWordleArticleUrl(): string {
  return getEnvValue("GW_WORDPRESS_WORDLE_ARTICLE_URL", DEFAULT_GW_WORDLE_ARTICLE_URL);
}

function getWordleMarkerStart(): string {
  return getEnvValue("WORDPRESS_WORDLE_MARKER_START", DEFAULT_WORDLE_MARKER_START);
}

function getWordleMarkerEnd(): string {
  return getEnvValue("WORDPRESS_WORDLE_MARKER_END", DEFAULT_WORDLE_MARKER_END);
}

function getWordleHistoryMarkerStart(): string {
  return getEnvValue("WORDPRESS_WORDLE_HISTORY_MARKER_START", DEFAULT_WORDLE_HISTORY_MARKER_START);
}

function getWordleHistoryMarkerEnd(): string {
  return getEnvValue("WORDPRESS_WORDLE_HISTORY_MARKER_END", DEFAULT_WORDLE_HISTORY_MARKER_END);
}

function getConnectionsArticleUrl(): string {
  return getEnvValue("WORDPRESS_CONNECTIONS_ARTICLE_URL", DEFAULT_CONNECTIONS_ARTICLE_URL);
}

function getGwConnectionsArticleUrl(): string {
  return getEnvValue("GW_WORDPRESS_CONNECTIONS_ARTICLE_URL", DEFAULT_GW_CONNECTIONS_ARTICLE_URL);
}

function getConnectionsMarkerStart(): string {
  return getEnvValue("WORDPRESS_CONNECTIONS_MARKER_START", DEFAULT_CONNECTIONS_MARKER_START);
}

function getConnectionsMarkerEnd(): string {
  return getEnvValue("WORDPRESS_CONNECTIONS_MARKER_END", DEFAULT_CONNECTIONS_MARKER_END);
}

function getConnectionsCurrentDateMarkerStart(): string {
  return getEnvValue(
    "WORDPRESS_CONNECTIONS_CURRENT_DATE_MARKER_START",
    DEFAULT_CONNECTIONS_CURRENT_DATE_MARKER_START
  );
}

function getConnectionsCurrentDateMarkerEnd(): string {
  return getEnvValue(
    "WORDPRESS_CONNECTIONS_CURRENT_DATE_MARKER_END",
    DEFAULT_CONNECTIONS_CURRENT_DATE_MARKER_END
  );
}

function getStrandsArticleUrl(): string {
  return getEnvValue("WORDPRESS_STRANDS_ARTICLE_URL", DEFAULT_STRANDS_ARTICLE_URL);
}

function getGwStrandsArticleUrl(): string {
  return getEnvValue("GW_WORDPRESS_STRANDS_ARTICLE_URL", DEFAULT_GW_STRANDS_ARTICLE_URL);
}

function getStrandsSpangramMarkerStart(): string {
  return getEnvValue(
    "WORDPRESS_STRANDS_SPANGRAM_MARKER_START",
    DEFAULT_STRANDS_SPANGRAM_MARKER_START
  );
}

function getStrandsSpangramMarkerEnd(): string {
  return getEnvValue(
    "WORDPRESS_STRANDS_SPANGRAM_MARKER_END",
    DEFAULT_STRANDS_SPANGRAM_MARKER_END
  );
}

function getStrandsThemeWordsMarkerStart(): string {
  return getEnvValue(
    "WORDPRESS_STRANDS_THEME_WORDS_MARKER_START",
    DEFAULT_STRANDS_THEME_WORDS_MARKER_START
  );
}

function getStrandsThemeWordsMarkerEnd(): string {
  return getEnvValue(
    "WORDPRESS_STRANDS_THEME_WORDS_MARKER_END",
    DEFAULT_STRANDS_THEME_WORDS_MARKER_END
  );
}

function getStrandsCurrentDateMarkerStart(): string {
  return getEnvValue(
    "WORDPRESS_STRANDS_CURRENT_DATE_MARKER_START",
    DEFAULT_STRANDS_CURRENT_DATE_MARKER_START
  );
}

function getStrandsCurrentDateMarkerEnd(): string {
  return getEnvValue(
    "WORDPRESS_STRANDS_CURRENT_DATE_MARKER_END",
    DEFAULT_STRANDS_CURRENT_DATE_MARKER_END
  );
}

function getStrandsClueMarkerStart(): string {
  return getEnvValue("WORDPRESS_STRANDS_CLUE_MARKER_START", DEFAULT_STRANDS_CLUE_MARKER_START);
}

function getStrandsClueMarkerEnd(): string {
  return getEnvValue("WORDPRESS_STRANDS_CLUE_MARKER_END", DEFAULT_STRANDS_CLUE_MARKER_END);
}

function getWordleTimezone(override?: string): string {
  return override || getEnvValue("WORDLE_TIMEZONE") || getEnvValue("WORDPRESS_UPDATE_TIMEZONE") || "UTC";
}

function getConnectionsTimezone(override?: string): string {
  return override || getEnvValue("CONNECTIONS_TIMEZONE") || getEnvValue("WORDPRESS_UPDATE_TIMEZONE") || "UTC";
}

function getStrandsTimezone(override?: string): string {
  return override || getEnvValue("STRANDS_TIMEZONE") || getEnvValue("WORDPRESS_UPDATE_TIMEZONE") || "UTC";
}

function formatDateInTimezone(date: Date, timezoneId: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function validateAnswerDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid answer date: ${value}. Expected YYYY-MM-DD.`);
  }
}

function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function normalizeComparisonValue(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim().toUpperCase();
  return normalized ? normalized : null;
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

function mapPostTypeToEndpoint(postType?: string | null): WordPressEndpointType[] {
  if (postType === "post") return ["posts"];
  if (postType === "page") return ["pages"];
  return ["posts", "pages"];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

function replaceMarkedSectionIfPresent(
  content: string,
  replacementHtml: string,
  markerStart: string,
  markerEnd: string
): string {
  const startIndex = content.indexOf(markerStart);
  const endIndex = content.indexOf(markerEnd);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return content;
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

async function requestWordPress<T>(
  url: URL,
  init: RequestInit = {},
  includeAuth = true,
  envPrefix?: string
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (includeAuth) {
    headers.set("Authorization", getWordPressAuthHeader(envPrefix));
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

async function lookupWordPressPostByUrl(articleUrl: string, envPrefix?: string): Promise<{
  wordpressPostId: number;
  wordpressPostType: WordPressPostType;
}> {
  const origin = new URL(articleUrl).origin;
  const slug = new URL(articleUrl).pathname.split("/").filter(Boolean).at(-1);

  if (!slug) {
    throw new Error(`Could not determine WordPress slug for ${articleUrl}`);
  }

  const normalizedTargetUrl = normalizeUrlForComparison(articleUrl);

  for (const useAuth of [false, true]) {
    for (const endpoint of ["posts", "pages"] as const) {
      const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}`, origin);
      requestUrl.searchParams.set("slug", slug);
      requestUrl.searchParams.set("_fields", "id,type,link");
      requestUrl.searchParams.set("per_page", "10");
      if (useAuth) {
        requestUrl.searchParams.set("status", "any");
      }

      try {
        const posts = await requestWordPress<WordPressPostResponse[]>(requestUrl, {}, useAuth, envPrefix);
        const matched =
          posts.find((post) => normalizeUrlForComparison(post.link) === normalizedTargetUrl) ?? posts[0];

        if (!matched?.id) {
          continue;
        }

        return {
          wordpressPostId: matched.id,
          wordpressPostType: endpoint === "posts" ? "post" : "page",
        };
      } catch {
        continue;
      }
    }
  }

  throw new Error(`Could not resolve a WordPress post for ${articleUrl}`);
}

async function fetchWordPressPost(articleUrl: string, envPrefix?: string): Promise<LoadedWordPressPost> {
  const resolvedPost = await lookupWordPressPostByUrl(articleUrl, envPrefix);
  const siteOrigin = new URL(articleUrl).origin;

  for (const endpoint of mapPostTypeToEndpoint(resolvedPost.wordpressPostType)) {
    const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}/${resolvedPost.wordpressPostId}`, siteOrigin);
    requestUrl.searchParams.set("context", "edit");

    try {
      const data = await requestWordPress<WordPressPostResponse>(requestUrl, {}, true, envPrefix);
      const contentRaw = data.content?.raw;
      if (!contentRaw) {
        throw new Error(`WordPress ${endpoint} response did not include content.raw`);
      }

      return {
        articleUrl,
        endpoint,
        wordpressPostId: resolvedPost.wordpressPostId,
        wordpressPostType: resolvedPost.wordpressPostType,
        siteOrigin,
        contentRaw,
        titleRaw: data.title?.raw ?? data.title?.rendered ?? "",
      };
    } catch (error) {
      if (endpoint === mapPostTypeToEndpoint(resolvedPost.wordpressPostType).at(-1)) {
        throw error;
      }
    }
  }

  throw new Error(`Could not load WordPress post ${resolvedPost.wordpressPostId} for ${articleUrl}`);
}

async function updateWordPressPost(
  loadedPost: LoadedWordPressPost,
  updatedContent: string,
  updatedTitle?: string,
  envPrefix?: string
): Promise<void> {
  const requestUrl = new URL(
    `/wp-json/wp/v2/${loadedPost.endpoint}/${loadedPost.wordpressPostId}`,
    loadedPost.siteOrigin
  );

  const body: Record<string, string> = {
    content: updatedContent,
  };
  if (updatedTitle !== undefined) {
    body.title = updatedTitle;
  }

  await requestWordPress<Record<string, unknown>>(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, true, envPrefix);
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
  return `${monthNames[Number(month) - 1]} ${Number(day)}`;
}

function formatIsoDateLong(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return value;
  }

  const [, year] = match;
  return `${formatIsoDateMonthDay(value)}, ${year}`;
}

function calculateStrandsGameNumber(answerDate: string): number {
  const [year, month, day] = answerDate.split("-").map((part) => Number(part));
  const answerDateUtc = Date.UTC(year, month - 1, day);
  const launchDateUtc = Date.UTC(2024, 2, 4);
  return Math.floor((answerDateUtc - launchDateUtc) / (24 * 60 * 60 * 1000)) + 1;
}

function getPreviousIsoDate(answerDate: string): string {
  const date = new Date(`${answerDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid answer date: ${answerDate}. Expected YYYY-MM-DD.`);
  }

  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function revealWordleAnswer(
  answerDateOverride: string | undefined,
  timezoneId: string
): Promise<WordleAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const answerDate = answerDateOverride || formatDateInTimezone(new Date(), timezoneId);
  validateAnswerDate(answerDate);

  const sourceUrl = `${WORDLE_SOURCE_URL}/${answerDate}.json`;
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; TechNerdinessBot/1.0)",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  }

  const payload = (await response.json()) as NytWordleApiResponse;
  if (!payload.solution) {
    throw new Error(`Wordle response from ${sourceUrl} did not include a solution.`);
  }

  const normalizedAnswerDate = payload.print_date?.trim() || answerDate;
  validateAnswerDate(normalizedAnswerDate);

  return {
    sourceUrl,
    fetchedAt,
    answerDate: normalizedAnswerDate,
    answerDateSource: payload.print_date?.trim() === answerDate ? "api:print-date" : "fetched-at",
    answer: normalizeAnswer(payload.solution),
    puzzleId: payload.id,
    daysSinceLaunch: payload.days_since_launch,
    editor: payload.editor?.trim() || null,
    extractedFrom: "nyt:solution-endpoint",
  };
}

async function revealConnectionsAnswer(
  answerDateOverride: string | undefined,
  timezoneId: string
): Promise<ConnectionsAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const answerDate = answerDateOverride || formatDateInTimezone(new Date(), timezoneId);
  validateAnswerDate(answerDate);

  const sourceUrl = `${CONNECTIONS_SOURCE_URL}/${answerDate}.json`;
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; TechNerdinessBot/1.0)",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  }

  const payload = (await response.json()) as NytConnectionsApiResponse;
  if (!Array.isArray(payload.categories) || payload.categories.length === 0) {
    throw new Error(`Connections response from ${sourceUrl} did not include categories.`);
  }

  const normalizedAnswerDate = payload.print_date?.trim() || answerDate;
  validateAnswerDate(normalizedAnswerDate);

  return {
    sourceUrl,
    fetchedAt,
    answerDate: normalizedAnswerDate,
    answerDateSource: payload.print_date?.trim() === answerDate ? "api:print-date" : "fetched-at",
    puzzleId: payload.id,
    editor: payload.editor?.trim() || null,
    categories: payload.categories.map((category, index) => ({
      color: CONNECTIONS_COLORS[index] ?? "purple",
      title: category.title.trim(),
      cards: category.cards.map((card) => ({
        content: card.content.trim(),
        position:
          typeof card.position === "number" && Number.isInteger(card.position) ? card.position : null,
      })),
    })),
    extractedFrom: "nyt:connections-endpoint",
  };
}

function normalizeCoords(coords: number[][] | undefined): StrandsCoordinate[] {
  if (!Array.isArray(coords)) {
    return [];
  }

  return coords
    .filter(
      (coord): coord is number[] =>
        Array.isArray(coord) &&
        coord.length === 2 &&
        typeof coord[0] === "number" &&
        typeof coord[1] === "number"
    )
    .map((coord) => [coord[0], coord[1]] as StrandsCoordinate);
}

async function revealStrandsAnswer(
  answerDateOverride: string | undefined,
  timezoneId: string
): Promise<StrandsAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const answerDate = answerDateOverride || formatDateInTimezone(new Date(), timezoneId);
  validateAnswerDate(answerDate);

  const sourceUrl = `${STRANDS_SOURCE_URL}/${answerDate}.json`;
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; TechNerdinessBot/1.0)",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  }

  const payload = (await response.json()) as NytStrandsApiResponse;
  if (!Array.isArray(payload.themeWords) || payload.themeWords.length === 0) {
    throw new Error(`Strands response from ${sourceUrl} did not include theme words.`);
  }

  const normalizedAnswerDate = payload.printDate?.trim() || answerDate;
  validateAnswerDate(normalizedAnswerDate);
  const themeWords = payload.themeWords.map(normalizeAnswer);

  return {
    sourceUrl,
    fetchedAt,
    answerDate: normalizedAnswerDate,
    answerDateSource: payload.printDate?.trim() === answerDate ? "api:print-date" : "fetched-at",
    puzzleId: payload.id,
    clue: payload.clue.trim(),
    spangram: normalizeAnswer(payload.spangram),
    spangramCoords: normalizeCoords(payload.spangramCoords),
    themeWords,
    themeCoords: Object.fromEntries(
      payload.themeWords.map((word, index) => [themeWords[index], normalizeCoords(payload.themeCoords?.[word])])
    ) as Record<string, StrandsCoordinate[]>,
    editor: payload.editor?.trim() || null,
    constructors: payload.constructors?.trim() || null,
    startingBoard: Array.isArray(payload.startingBoard) ? payload.startingBoard.map((row) => row.trim()) : [],
    extractedFrom: "nyt:strands-endpoint",
  };
}

function toPlainObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function renderWordPressWordlePostTitle(answerDate: string, wordleNumber: number): string {
  return `Today's NYT Wordle Answer and Hints for ${formatIsoDateMonthDay(answerDate)} (Puzzle #${wordleNumber})`;
}

function renderWordPressConnectionsPostTitle(answerDate: string, puzzleId: number): string {
  return `Today's NYT Connections Answer for ${formatIsoDateMonthDay(answerDate)} (Puzzle #${puzzleId})`;
}

function renderWordPressStrandsPostTitle(answerDate: string): string {
  return `Today's NYT Strands Answer and Hints for ${formatIsoDateMonthDay(answerDate)} (Game #${calculateStrandsGameNumber(answerDate)})`;
}

function renderWordleAnswerRevealSection(
  result: WordleAnswerResult,
  label: "Today's" | "Yesterday's"
): string {
  const headingHtml = `<h2 class="tn-wordle-answer-heading">${label} Wordle answer (${escapeHtml(
    formatIsoDateMonthDay(result.answerDate)
  )} - game #${result.daysSinceLaunch}) is...</h2>`;

  return [
    headingHtml,
    `<details class="tn-wordle-answer-reveal" data-answer="${escapeHtml(result.answer)}">`,
    "<summary>Reveal Answer</summary>",
    `<div class="tn-wordle-answer-reveal__content">\n<p>${escapeHtml(result.answer)}</p>\n</div>`,
    "</details>",
  ].join("\n");
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

function renderWordPressWordleAnswerHtml(
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

function renderWordPressWordleHistoryHtml(
  entries: { answerDate: string; answer: string; puzzleId: number }[]
): string {
  const rows = entries.length
    ? entries
        .map(
          (entry) =>
            `<tr><td>${escapeHtml(formatIsoDateLong(entry.answerDate))}</td><td>${escapeHtml(entry.answer)}</td><td>#${entry.puzzleId}</td></tr>`
        )
        .join("")
    : '<tr><td colspan="3">No Wordle answers saved yet.</td></tr>';

  return [
    "<table>",
    "<thead><tr><th>Date</th><th>Answer</th><th>Puzzle</th></tr></thead>",
    `<tbody>${rows}</tbody>`,
    "</table>",
  ].join("\n");
}

function extractCurrentWordleAnswerSignature(content: string): string | null {
  const answerSection = extractMarkedSectionContent(content, getWordleMarkerStart(), getWordleMarkerEnd());
  if (!answerSection) {
    return null;
  }

  const dataSignatureMatch = answerSection.match(/data-answer-signature="([^"]+)"/i);
  const dataSignature = normalizeComparisonValue(dataSignatureMatch?.[1]);
  if (dataSignature) {
    return dataSignature;
  }

  const dataAnswerMatch = answerSection.match(/data-answer="([^"]+)"/i);
  return normalizeComparisonValue(dataAnswerMatch?.[1]);
}

async function syncWordle(
  ctx: any,
  answerDateOverride: string | undefined,
  timezoneId: string,
  dryRun: boolean
): Promise<Record<string, unknown>> {
  const result = await revealWordleAnswer(answerDateOverride, timezoneId);

  let previousResult: WordleAnswerResult | null = null;
  if (!dryRun) {
    const previousDate = getPreviousIsoDate(result.answerDate);
    const prevRow = await ctx.runQuery(internal.nytAnswers.getPreviousWordleAnswer, {
      answerDate: previousDate,
    });
    if (prevRow?.payload) {
      previousResult = toPlainObject(prevRow.payload) as WordleAnswerResult;
    }
  }

  const summary: Record<string, unknown> = {
    answerDate: result.answerDate,
    answer: result.answer,
    wordleNumber: result.daysSinceLaunch,
    database: dryRun ? "skipped:dry-run" : "saved",
    wordpress: dryRun ? "skipped:dry-run" : "updated",
    wordpress_gw: dryRun ? "skipped:dry-run" : "updated",
  };

  if (!dryRun) {
    await ctx.runMutation(internal.nytAnswers.upsertWordleAnswer, {
      answerDate: result.answerDate,
      answerDateSource: result.answerDateSource,
      answer: result.answer,
      sourceUrl: result.sourceUrl,
      puzzleId: result.puzzleId,
      daysSinceLaunch: result.daysSinceLaunch,
      editor: result.editor ?? undefined,
      fetchedAt: result.fetchedAt,
      extractedFrom: result.extractedFrom,
      payload: toPlainObject(result),
    });

    const history = (
      await ctx.runQuery(internal.nytAnswers.getWordleHistory, {})
    ).filter((entry: { answerDate: string }) => entry.answerDate !== result.answerDate);

    const nextSignature = buildWordleAnswerSignature(result, previousResult);
    const updatedTitle = renderWordPressWordlePostTitle(result.answerDate, result.daysSinceLaunch);
    const renderedAnswerHtml = renderWordPressWordleAnswerHtml(result, previousResult);
    const renderedHistoryHtml = renderWordPressWordleHistoryHtml(history);

    // Update TN
    const loadedPost = await fetchWordPressPost(getWordleArticleUrl());
    const currentSignature = extractCurrentWordleAnswerSignature(loadedPost.contentRaw);

    if (!(currentSignature === nextSignature && loadedPost.titleRaw === updatedTitle)) {
      const withAnswer = replaceMarkedSection(
        loadedPost.contentRaw,
        renderedAnswerHtml,
        getWordleMarkerStart(),
        getWordleMarkerEnd()
      );
      const updatedContent = replaceMarkedSectionIfPresent(
        withAnswer,
        renderedHistoryHtml,
        getWordleHistoryMarkerStart(),
        getWordleHistoryMarkerEnd()
      );
      if (updatedContent !== loadedPost.contentRaw || loadedPost.titleRaw !== updatedTitle) {
        await updateWordPressPost(loadedPost, updatedContent, updatedTitle);
      } else {
        summary.wordpress = "skipped:no-change";
      }
    } else {
      summary.wordpress = "skipped:answer-unchanged";
    }

    // Update GW
    try {
      const gwLoadedPost = await fetchWordPressPost(getGwWordleArticleUrl(), "GW");
      const gwCurrentSignature = extractCurrentWordleAnswerSignature(gwLoadedPost.contentRaw);

      if (!(gwCurrentSignature === nextSignature && gwLoadedPost.titleRaw === updatedTitle)) {
        const gwWithAnswer = replaceMarkedSection(
          gwLoadedPost.contentRaw,
          renderedAnswerHtml,
          getWordleMarkerStart(),
          getWordleMarkerEnd()
        );
        const gwUpdatedContent = replaceMarkedSectionIfPresent(
          gwWithAnswer,
          renderedHistoryHtml,
          getWordleHistoryMarkerStart(),
          getWordleHistoryMarkerEnd()
        );
        if (gwUpdatedContent !== gwLoadedPost.contentRaw || gwLoadedPost.titleRaw !== updatedTitle) {
          await updateWordPressPost(gwLoadedPost, gwUpdatedContent, updatedTitle, "GW");
        } else {
          summary.wordpress_gw = "skipped:no-change";
        }
      } else {
        summary.wordpress_gw = "skipped:answer-unchanged";
      }
    } catch (error) {
      summary.wordpress_gw = `error:${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return summary;
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

function renderWordPressConnectionsAnswerHtml(result: ConnectionsAnswerResult): string {
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

  return rows.length
    ? normalizeComparisonValue(
        rows.map((row) => `${stripHtml(row[1])}::${stripHtml(row[2])}`).join("||")
      )
    : null;
}

async function syncConnections(
  ctx: any,
  answerDateOverride: string | undefined,
  timezoneId: string,
  dryRun: boolean
): Promise<Record<string, unknown>> {
  const result = await revealConnectionsAnswer(answerDateOverride, timezoneId);
  const summary: Record<string, unknown> = {
    answerDate: result.answerDate,
    puzzleId: result.puzzleId,
    database: dryRun ? "skipped:dry-run" : "saved",
    wordpress: dryRun ? "skipped:dry-run" : "updated",
    wordpress_gw: dryRun ? "skipped:dry-run" : "updated",
  };

  if (!dryRun) {
    await ctx.runMutation(internal.nytAnswers.upsertConnectionsAnswer, {
      answerDate: result.answerDate,
      answerDateSource: result.answerDateSource,
      sourceUrl: result.sourceUrl,
      puzzleId: result.puzzleId,
      editor: result.editor ?? undefined,
      categoryCount: result.categories.length,
      categories: toPlainObject(result.categories),
      fetchedAt: result.fetchedAt,
      extractedFrom: result.extractedFrom,
      payload: toPlainObject(result),
    });

    const nextSignature = buildConnectionsAnswerSignature(result);
    const updatedTitle = renderWordPressConnectionsPostTitle(result.answerDate, result.puzzleId);
    const expectedCurrentDate = escapeHtml(formatIsoDateMonthDay(result.answerDate));
    const renderedAnswerHtml = renderWordPressConnectionsAnswerHtml(result);

    // Update TN
    const loadedPost = await fetchWordPressPost(getConnectionsArticleUrl());
    const currentSignature = extractCurrentConnectionsAnswerSignature(loadedPost.contentRaw);
    const currentDateSection = extractMarkedSectionContent(
      loadedPost.contentRaw,
      getConnectionsCurrentDateMarkerStart(),
      getConnectionsCurrentDateMarkerEnd()
    );
    const isCurrentDateUpToDate =
      currentDateSection === null || currentDateSection.trim() === expectedCurrentDate;

    if (!(currentSignature === nextSignature && loadedPost.titleRaw === updatedTitle && isCurrentDateUpToDate)) {
      const updatedContent = replaceMarkedSection(
        loadedPost.contentRaw,
        renderedAnswerHtml,
        getConnectionsMarkerStart(),
        getConnectionsMarkerEnd()
      );
      const updatedContentWithDate = replaceInlineMarkedTextIfPresent(
        updatedContent,
        expectedCurrentDate,
        getConnectionsCurrentDateMarkerStart(),
        getConnectionsCurrentDateMarkerEnd()
      );

      if (updatedContentWithDate !== loadedPost.contentRaw || loadedPost.titleRaw !== updatedTitle) {
        await updateWordPressPost(loadedPost, updatedContentWithDate, updatedTitle);
      } else {
        summary.wordpress = "skipped:no-change";
      }
    } else {
      summary.wordpress = "skipped:answer-unchanged";
    }

    // Update GW
    try {
      const gwLoadedPost = await fetchWordPressPost(getGwConnectionsArticleUrl(), "GW");
      const gwCurrentSignature = extractCurrentConnectionsAnswerSignature(gwLoadedPost.contentRaw);
      const gwCurrentDateSection = extractMarkedSectionContent(
        gwLoadedPost.contentRaw,
        getConnectionsCurrentDateMarkerStart(),
        getConnectionsCurrentDateMarkerEnd()
      );
      const gwIsCurrentDateUpToDate =
        gwCurrentDateSection === null || gwCurrentDateSection.trim() === expectedCurrentDate;

      if (!(gwCurrentSignature === nextSignature && gwLoadedPost.titleRaw === updatedTitle && gwIsCurrentDateUpToDate)) {
        const gwUpdatedContent = replaceMarkedSection(
          gwLoadedPost.contentRaw,
          renderedAnswerHtml,
          getConnectionsMarkerStart(),
          getConnectionsMarkerEnd()
        );
        const gwUpdatedContentWithDate = replaceInlineMarkedTextIfPresent(
          gwUpdatedContent,
          expectedCurrentDate,
          getConnectionsCurrentDateMarkerStart(),
          getConnectionsCurrentDateMarkerEnd()
        );

        if (gwUpdatedContentWithDate !== gwLoadedPost.contentRaw || gwLoadedPost.titleRaw !== updatedTitle) {
          await updateWordPressPost(gwLoadedPost, gwUpdatedContentWithDate, updatedTitle, "GW");
        } else {
          summary.wordpress_gw = "skipped:no-change";
        }
      } else {
        summary.wordpress_gw = "skipped:answer-unchanged";
      }
    } catch (error) {
      summary.wordpress_gw = `error:${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return summary;
}

function buildStrandsAnswerSignature(result: StrandsAnswerResult): string {
  return normalizeComparisonValue([result.spangram, ...result.themeWords].join("::")) as string;
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

function renderWordPressStrandsSpangramHtml(result: StrandsAnswerResult): string {
  return renderWordPressStrandsRevealHtml(
    "Reveal Spangram",
    `<p>${escapeHtml(result.spangram)}</p>`,
    `data-answer="${escapeHtml(result.spangram)}"`
  );
}

function renderWordPressStrandsThemeWordsHtml(result: StrandsAnswerResult): string {
  const items = result.themeWords.map((word) => `<li>${escapeHtml(word)}</li>`).join("");
  return renderWordPressStrandsRevealHtml(
    "Reveal Theme Words",
    `<ul class="wp-block-list">${items}</ul>`,
    `data-answer-signature="${escapeHtml(buildStrandsAnswerSignature(result))}"`
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
    return normalizeComparisonValue([spangram, ...themeWords].join("::"));
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

async function syncStrands(
  ctx: any,
  answerDateOverride: string | undefined,
  timezoneId: string,
  dryRun: boolean
): Promise<Record<string, unknown>> {
  const result = await revealStrandsAnswer(answerDateOverride, timezoneId);
  const summary: Record<string, unknown> = {
    answerDate: result.answerDate,
    puzzleId: result.puzzleId,
    spangram: result.spangram,
    database: dryRun ? "skipped:dry-run" : "saved",
    wordpress: dryRun ? "skipped:dry-run" : "updated",
    wordpress_gw: dryRun ? "skipped:dry-run" : "updated",
  };

  if (!dryRun) {
    await ctx.runMutation(internal.nytAnswers.upsertStrandsAnswer, {
      answerDate: result.answerDate,
      answerDateSource: result.answerDateSource,
      sourceUrl: result.sourceUrl,
      puzzleId: result.puzzleId,
      clue: result.clue,
      spangram: result.spangram,
      themeWordCount: result.themeWords.length,
      themeWords: [...result.themeWords],
      themeCoords: toPlainObject(result.themeCoords),
      spangramCoords: result.spangramCoords.map((coord) => [coord[0], coord[1]]),
      editor: result.editor ?? undefined,
      constructors: result.constructors ?? undefined,
      startingBoard: [...result.startingBoard],
      fetchedAt: result.fetchedAt,
      extractedFrom: result.extractedFrom,
      payload: toPlainObject(result),
    });

    const nextSignature = buildStrandsAnswerSignature(result);
    const updatedTitle = renderWordPressStrandsPostTitle(result.answerDate);
    const expectedCurrentDate = escapeHtml(formatIsoDateMonthDay(result.answerDate));
    const expectedClue = escapeHtml(result.clue);
    const renderedSpangramHtml = renderWordPressStrandsSpangramHtml(result);
    const renderedThemeWordsHtml = renderWordPressStrandsThemeWordsHtml(result);

    async function applyStrandsUpdate(
      post: LoadedWordPressPost,
      envPrefix?: string
    ): Promise<"updated" | "skipped:no-change" | "skipped:answer-unchanged"> {
      const currentDateSection = extractMarkedSectionContent(
        post.contentRaw,
        getStrandsCurrentDateMarkerStart(),
        getStrandsCurrentDateMarkerEnd()
      );
      const currentClueSection = extractMarkedSectionContent(
        post.contentRaw,
        getStrandsClueMarkerStart(),
        getStrandsClueMarkerEnd()
      );
      const isCurrentDateUpToDate =
        currentDateSection === null || currentDateSection.trim() === expectedCurrentDate;
      const isClueUpToDate = currentClueSection === null || currentClueSection.trim() === expectedClue;
      const currentSignature = extractCurrentStrandsAnswerSignature(post.contentRaw);

      if (currentSignature === nextSignature && post.titleRaw === updatedTitle && isCurrentDateUpToDate && isClueUpToDate) {
        return "skipped:answer-unchanged";
      }

      const withSpangram = replaceMarkedSection(
        post.contentRaw,
        renderedSpangramHtml,
        getStrandsSpangramMarkerStart(),
        getStrandsSpangramMarkerEnd()
      );
      const withThemeWords = replaceMarkedSection(
        withSpangram,
        renderedThemeWordsHtml,
        getStrandsThemeWordsMarkerStart(),
        getStrandsThemeWordsMarkerEnd()
      );
      const withDate = replaceInlineMarkedTextIfPresent(
        withThemeWords,
        expectedCurrentDate,
        getStrandsCurrentDateMarkerStart(),
        getStrandsCurrentDateMarkerEnd()
      );
      const updatedContent = replaceInlineMarkedTextIfPresent(
        withDate,
        expectedClue,
        getStrandsClueMarkerStart(),
        getStrandsClueMarkerEnd()
      );

      if (updatedContent === post.contentRaw && post.titleRaw === updatedTitle) {
        return "skipped:no-change";
      }

      await updateWordPressPost(post, updatedContent, updatedTitle, envPrefix);
      return "updated";
    }

    // Update TN
    const loadedPost = await fetchWordPressPost(getStrandsArticleUrl());
    summary.wordpress = await applyStrandsUpdate(loadedPost);

    // Update GW
    try {
      const gwLoadedPost = await fetchWordPressPost(getGwStrandsArticleUrl(), "GW");
      summary.wordpress_gw = await applyStrandsUpdate(gwLoadedPost, "GW");
    } catch (error) {
      summary.wordpress_gw = `error:${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return summary;
}

async function handleSync(
  ctx: any,
  payload: SyncRequestPayload
): Promise<SyncSummary> {
  const dryRun = Boolean(payload.dryRun);
  const requestedPuzzles = payload.puzzles?.filter(isPuzzleName).length
    ? payload.puzzles!.filter(isPuzzleName)
    : (["wordle", "connections", "strands"] as PuzzleName[]);

  const summary: SyncSummary = {
    answerDate: payload.answerDate || "",
    dryRun,
    puzzles: {},
  };

  for (const puzzle of requestedPuzzles) {
    try {
      if (puzzle === "wordle") {
        const wordleSummary = await syncWordle(
          ctx,
          payload.answerDate,
          getWordleTimezone(payload.timezoneId),
          dryRun
        );
        summary.puzzles.wordle = wordleSummary;
        summary.answerDate = String(wordleSummary.answerDate || summary.answerDate);
      } else if (puzzle === "connections") {
        const connectionsSummary = await syncConnections(
          ctx,
          payload.answerDate,
          getConnectionsTimezone(payload.timezoneId),
          dryRun
        );
        summary.puzzles.connections = connectionsSummary;
        summary.answerDate = String(connectionsSummary.answerDate || summary.answerDate);
      } else if (puzzle === "strands") {
        const strandsSummary = await syncStrands(
          ctx,
          payload.answerDate,
          getStrandsTimezone(payload.timezoneId),
          dryRun
        );
        summary.puzzles.strands = strandsSummary;
        summary.answerDate = String(strandsSummary.answerDate || summary.answerDate);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed syncing ${puzzle}:`, error);
      summary.puzzles[puzzle] = {
        status: "error",
        error: message,
      };
    }
  }

  return summary;
}

export const run = internalAction({
  args: {
    answerDate: v.optional(v.string()),
    timezoneId: v.optional(v.string()),
    puzzles: v.optional(v.array(v.string())),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await handleSync(ctx, {
      answerDate: args.answerDate,
      timezoneId: args.timezoneId,
      puzzles: args.puzzles as PuzzleName[] | undefined,
      dryRun: args.dryRun,
    });
  },
});

export const syncNytPuzzles = action({
  args: {
    answerDate: v.optional(v.string()),
    timezoneId: v.optional(v.string()),
    puzzles: v.optional(v.array(v.string())),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await handleSync(ctx, {
      answerDate: args.answerDate,
      timezoneId: args.timezoneId,
      puzzles: args.puzzles as PuzzleName[] | undefined,
      dryRun: args.dryRun,
    });
  },
});
