"use node";

import { v } from "convex/values";
import { internalAction, action, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";

type PuzzleName =
  | "wordle"
  | "connections"
  | "strands"
  | "spelling-bee"
  | "letter-boxed"
  | "sudoku"
  | "pips";
type DailyDifficultyName = "easy" | "medium" | "hard";
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

interface SpellingBeeAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  answerDateSource: "page:print-date";
  puzzleId: number;
  centerLetter: string;
  outerLetters: string[];
  validLetters: string[];
  pangrams: string[];
  answers: string[];
  editor: string | null;
  extractedFrom: "nyt:spelling-bee-window-gameData";
}

interface LetterBoxedAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  answerDateSource: "page:print-date";
  puzzleId: number;
  sides: string[];
  solution: string[];
  par: number | null;
  editor: string | null;
  extractedFrom: "nyt:letter-boxed-window-gameData";
}

interface SudokuDifficultyResult {
  difficulty: DailyDifficultyName;
  dayOfWeek: string | null;
  answerDate: string;
  publishedAt: string | null;
  puzzleId: number;
  version: number;
  hints: number[];
  puzzle: number[];
  solution: number[];
}

interface SudokuAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  answerDateSource: "page:print-date";
  easy: SudokuDifficultyResult;
  medium: SudokuDifficultyResult;
  hard: SudokuDifficultyResult;
  extractedFrom: "nyt:sudoku-window-gameData";
}

interface PipsRegion {
  indices: number[][];
  type: string;
  target?: number;
}

interface PipsDifficultyResult {
  difficulty: DailyDifficultyName;
  puzzleId: number;
  backendId: string;
  constructors: string | null;
  dominoes: number[][];
  regions: PipsRegion[];
  solution: number[][][];
}

interface PipsAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  answerDateSource: "api:print-date" | "fetched-at";
  editor: string | null;
  easy: PipsDifficultyResult;
  medium: PipsDifficultyResult;
  hard: PipsDifficultyResult;
  extractedFrom: "nyt:pips-endpoint";
}

interface NytWordleApiResponse {
  id: number;
  solution: string;
  print_date: string;
  days_since_launch: number;
  editor?: string;
}

interface NytConnectionsApiCard {
  content?: string;
  image_alt_text?: string;
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

interface NytSpellingBeePuzzleData {
  printDate: string;
  centerLetter: string;
  outerLetters: string[];
  validLetters?: string[];
  pangrams: string[];
  answers: string[];
  id: number;
  editor?: string;
}

interface NytSpellingBeePageData {
  today?: NytSpellingBeePuzzleData;
  yesterday?: NytSpellingBeePuzzleData;
  pastPuzzles?: Record<string, NytSpellingBeePuzzleData | NytSpellingBeePuzzleData[]>;
}

interface NytLetterBoxedPageData {
  id: number;
  ourSolution: string[];
  printDate: string;
  sides: string[];
  par?: number;
  editor?: string;
}

interface NytSudokuPuzzleData {
  hints?: number[];
  puzzle: number[];
  solution: number[];
}

interface NytSudokuDifficultyData {
  day_of_week?: string;
  difficulty?: string;
  print_date: string;
  published?: string;
  puzzle_id: number;
  version: number;
  puzzle_data: NytSudokuPuzzleData;
}

interface NytSudokuPageData {
  easy: NytSudokuDifficultyData;
  medium: NytSudokuDifficultyData;
  hard: NytSudokuDifficultyData;
}

interface NytPipsDifficultyData {
  id: number;
  backendId: string;
  constructors?: string;
  dominoes: number[][];
  regions: PipsRegion[];
  solution: number[][][];
}

interface NytPipsApiResponse {
  printDate: string;
  editor?: string;
  easy: NytPipsDifficultyData;
  medium: NytPipsDifficultyData;
  hard: NytPipsDifficultyData;
}

const DEFAULT_WORDLE_ARTICLE_URL =
  "https://www.technerdiness.com/puzzle/todays-wordle-hints-answers/";
const DEFAULT_GW_WORDLE_ARTICLE_URL =
  "https://www.gamingwize.com/puzzles/today-wordle-hints-answers/";
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
  "https://www.gamingwize.com/puzzles/today-nyt-strands-hints-answers/";
const DEFAULT_GW_SPELLING_BEE_ARTICLE_URL =
  "https://www.gamingwize.com/puzzles/today-nyt-spelling-bee-answers/";
const DEFAULT_GW_LETTER_BOXED_ARTICLE_URL =
  "https://www.gamingwize.com/puzzles/today-nyt-letter-boxed-answers/";
const DEFAULT_GW_SUDOKU_ARTICLE_URL =
  "https://www.gamingwize.com/puzzles/today-nyt-sudoku-answers/";
const DEFAULT_GW_PIPS_ARTICLE_URL =
  "https://www.gamingwize.com/puzzles/today-nyt-pips-answers/";
const SPELLING_BEE_MARKERS = {
  currentDateStart: "<!-- TN_SPELLING_BEE_CURRENT_DATE_START -->",
  currentDateEnd: "<!-- TN_SPELLING_BEE_CURRENT_DATE_END -->",
  centerLetterStart: "<!-- TN_SPELLING_BEE_CENTER_LETTER_START -->",
  centerLetterEnd: "<!-- TN_SPELLING_BEE_CENTER_LETTER_END -->",
  outerLettersStart: "<!-- TN_SPELLING_BEE_OUTER_LETTERS_START -->",
  outerLettersEnd: "<!-- TN_SPELLING_BEE_OUTER_LETTERS_END -->",
  pangramsStart: "<!-- TN_SPELLING_BEE_PANGRAMS_START -->",
  pangramsEnd: "<!-- TN_SPELLING_BEE_PANGRAMS_END -->",
  answersStart: "<!-- TN_SPELLING_BEE_ANSWERS_START -->",
  answersEnd: "<!-- TN_SPELLING_BEE_ANSWERS_END -->",
} as const;
const LETTER_BOXED_MARKERS = {
  currentDateStart: "<!-- TN_LETTER_BOXED_CURRENT_DATE_START -->",
  currentDateEnd: "<!-- TN_LETTER_BOXED_CURRENT_DATE_END -->",
  sidesStart: "<!-- TN_LETTER_BOXED_SIDES_START -->",
  sidesEnd: "<!-- TN_LETTER_BOXED_SIDES_END -->",
  answerStart: "<!-- TN_LETTER_BOXED_ANSWER_START -->",
  answerEnd: "<!-- TN_LETTER_BOXED_ANSWER_END -->",
} as const;
const SUDOKU_MARKERS = {
  currentDateStart: "<!-- TN_SUDOKU_CURRENT_DATE_START -->",
  currentDateEnd: "<!-- TN_SUDOKU_CURRENT_DATE_END -->",
  easyStart: "<!-- TN_SUDOKU_EASY_START -->",
  easyEnd: "<!-- TN_SUDOKU_EASY_END -->",
  mediumStart: "<!-- TN_SUDOKU_MEDIUM_START -->",
  mediumEnd: "<!-- TN_SUDOKU_MEDIUM_END -->",
  hardStart: "<!-- TN_SUDOKU_HARD_START -->",
  hardEnd: "<!-- TN_SUDOKU_HARD_END -->",
} as const;
const PIPS_MARKERS = {
  currentDateStart: "<!-- TN_PIPS_CURRENT_DATE_START -->",
  currentDateEnd: "<!-- TN_PIPS_CURRENT_DATE_END -->",
  easyStart: "<!-- TN_PIPS_EASY_START -->",
  easyEnd: "<!-- TN_PIPS_EASY_END -->",
  mediumStart: "<!-- TN_PIPS_MEDIUM_START -->",
  mediumEnd: "<!-- TN_PIPS_MEDIUM_END -->",
  hardStart: "<!-- TN_PIPS_HARD_START -->",
  hardEnd: "<!-- TN_PIPS_HARD_END -->",
} as const;
const DEFAULT_STRANDS_SPANGRAM_MARKER_START = "<!-- TN_STRANDS_SPANGRAM_START -->";
const DEFAULT_STRANDS_SPANGRAM_MARKER_END = "<!-- TN_STRANDS_SPANGRAM_END -->";
const DEFAULT_STRANDS_THEME_WORDS_MARKER_START = "<!-- TN_STRANDS_THEME_WORDS_START -->";
const DEFAULT_STRANDS_THEME_WORDS_MARKER_END = "<!-- TN_STRANDS_THEME_WORDS_END -->";
const DEFAULT_STRANDS_CURRENT_DATE_MARKER_START = "<!-- TN_STRANDS_CURRENT_DATE_START -->";
const DEFAULT_STRANDS_CURRENT_DATE_MARKER_END = "<!-- TN_STRANDS_CURRENT_DATE_END -->";
const DEFAULT_STRANDS_CLUE_MARKER_START = "<!-- TN_STRANDS_CLUE_START -->";
const DEFAULT_STRANDS_CLUE_MARKER_END = "<!-- TN_STRANDS_CLUE_END -->";
const SPELLING_BEE_SOURCE_URL = "https://www.nytimes.com/puzzles/spelling-bee";
const LETTER_BOXED_SOURCE_URL = "https://www.nytimes.com/puzzles/letter-boxed";
const SUDOKU_SOURCE_URL = "https://www.nytimes.com/puzzles/sudoku/easy";
const PIPS_SOURCE_URL = "https://www.nytimes.com/svc/pips/v1";
const WORDLE_SOURCE_URL = "https://www.nytimes.com/svc/wordle/v2";
const CONNECTIONS_SOURCE_URL = "https://www.nytimes.com/svc/connections/v2";
const STRANDS_SOURCE_URL = "https://www.nytimes.com/svc/strands/v2";
const NYT_BOT_USER_AGENT = "Mozilla/5.0 (compatible; TechNerdinessBot/1.0)";
const CONNECTIONS_COLORS = ["yellow", "green", "blue", "purple"] as const;
const ALL_NYT_PUZZLES = [
  "wordle",
  "connections",
  "strands",
  "spelling-bee",
  "letter-boxed",
  "sudoku",
  "pips",
] as const satisfies readonly PuzzleName[];

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
  return ALL_NYT_PUZZLES.includes(value as PuzzleName);
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

function getGwSpellingBeeArticleUrl(): string {
  return getEnvValue(
    "GW_WORDPRESS_SPELLING_BEE_ARTICLE_URL",
    DEFAULT_GW_SPELLING_BEE_ARTICLE_URL
  );
}

function getGwLetterBoxedArticleUrl(): string {
  return getEnvValue(
    "GW_WORDPRESS_LETTER_BOXED_ARTICLE_URL",
    DEFAULT_GW_LETTER_BOXED_ARTICLE_URL
  );
}

function getGwSudokuArticleUrl(): string {
  return getEnvValue("GW_WORDPRESS_SUDOKU_ARTICLE_URL", DEFAULT_GW_SUDOKU_ARTICLE_URL);
}

function getGwPipsArticleUrl(): string {
  return getEnvValue("GW_WORDPRESS_PIPS_ARTICLE_URL", DEFAULT_GW_PIPS_ARTICLE_URL);
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

function getSpellingBeeTimezone(override?: string): string {
  return override || getEnvValue("SPELLING_BEE_TIMEZONE") || getEnvValue("WORDPRESS_UPDATE_TIMEZONE") || "UTC";
}

function getLetterBoxedTimezone(override?: string): string {
  return override || getEnvValue("LETTER_BOXED_TIMEZONE") || getEnvValue("WORDPRESS_UPDATE_TIMEZONE") || "UTC";
}

function getSudokuTimezone(override?: string): string {
  return override || getEnvValue("SUDOKU_TIMEZONE") || getEnvValue("WORDPRESS_UPDATE_TIMEZONE") || "UTC";
}

function getPipsTimezone(override?: string): string {
  return override || getEnvValue("PIPS_TIMEZONE") || getEnvValue("WORDPRESS_UPDATE_TIMEZONE") || "UTC";
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

function getRequestedAnswerDate(answerDateOverride: string | undefined, timezoneId: string): string {
  const answerDate = answerDateOverride || formatDateInTimezone(new Date(), timezoneId);
  validateAnswerDate(answerDate);
  return answerDate;
}

async function fetchNytJson<T>(sourceUrl: string): Promise<T> {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": NYT_BOT_USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchNytJsonIfExists<T>(sourceUrl: string): Promise<T | null> {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": NYT_BOT_USER_AGENT,
    },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchNytHtml(sourceUrl: string): Promise<string> {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": NYT_BOT_USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  }

  return await response.text();
}

function extractWindowGameData<T>(html: string, sourceUrl: string): T {
  const marker = "window.gameData = ";
  const startIndex = html.indexOf(marker);
  if (startIndex === -1) {
    throw new Error(`Could not find window.gameData in ${sourceUrl}.`);
  }

  const scriptEndIndex = html.indexOf("</script>", startIndex);
  if (scriptEndIndex === -1) {
    throw new Error(`Could not find the end of the gameData script in ${sourceUrl}.`);
  }

  const rawJson = html
    .slice(startIndex + marker.length, scriptEndIndex)
    .trim()
    .replace(/;$/, "");

  try {
    return JSON.parse(rawJson) as T;
  } catch (error) {
    throw new Error(
      `Could not parse window.gameData from ${sourceUrl}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function ensureAnswerDatePresent(actualAnswerDate: string | undefined, sourceUrl: string): string {
  const normalizedAnswerDate = actualAnswerDate?.trim();
  if (!normalizedAnswerDate) {
    throw new Error(`Response from ${sourceUrl} did not include a print date.`);
  }

  validateAnswerDate(normalizedAnswerDate);
  return normalizedAnswerDate;
}

function ensureExactAnswerDate(
  actualAnswerDate: string | undefined,
  expectedAnswerDate: string,
  sourceUrl: string
): string {
  const normalizedAnswerDate = ensureAnswerDatePresent(actualAnswerDate, sourceUrl);
  if (normalizedAnswerDate !== expectedAnswerDate) {
    throw new Error(
      `Source ${sourceUrl} returned ${normalizedAnswerDate}, but ${expectedAnswerDate} was requested.`
    );
  }

  return normalizedAnswerDate;
}

function renderWordPressHtmlMarkerSection(innerHtml: string): string {
  return [
    "</p>",
    "<!-- /wp:paragraph -->",
    "",
    "<!-- wp:html -->",
    innerHtml,
    "<!-- /wp:html -->",
    "",
    "<!-- wp:paragraph -->",
    "<p>",
  ].join("\n");
}

function normalizeWordList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => normalizeAnswer(String(value)))
    .filter((value) => value.length > 0);
}

function normalizeLetterList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
}

function collectSpellingBeeCandidates(pageData: NytSpellingBeePageData): NytSpellingBeePuzzleData[] {
  const candidates: NytSpellingBeePuzzleData[] = [];

  if (pageData.today) candidates.push(pageData.today);
  if (pageData.yesterday) candidates.push(pageData.yesterday);

  const pastPuzzles = pageData.pastPuzzles;
  if (pastPuzzles && typeof pastPuzzles === "object") {
    for (const value of Object.values(pastPuzzles)) {
      if (Array.isArray(value)) {
        candidates.push(...value);
      } else if (value) {
        candidates.push(value);
      }
    }
  }

  return candidates;
}

function resolveSpellingBeePuzzleForDate(
  pageData: NytSpellingBeePageData,
  answerDate: string,
  sourceUrl: string
): NytSpellingBeePuzzleData {
  const candidates = collectSpellingBeeCandidates(pageData);

  const matchedPuzzle = candidates.find((candidate) => candidate.printDate?.trim() === answerDate);
  if (!matchedPuzzle) {
    throw new Error(`Spelling Bee page data from ${sourceUrl} did not include puzzle ${answerDate}.`);
  }

  return matchedPuzzle;
}

function resolveCurrentSpellingBeePuzzle(
  pageData: NytSpellingBeePageData,
  sourceUrl: string
): NytSpellingBeePuzzleData {
  if (pageData.today) {
    return pageData.today;
  }

  const candidates = collectSpellingBeeCandidates(pageData);
  if (!candidates.length) {
    throw new Error(`Spelling Bee page data from ${sourceUrl} did not include any puzzles.`);
  }

  return [...candidates].sort((a, b) => b.printDate.localeCompare(a.printDate))[0];
}

function normalizeSudokuDifficulty(
  difficulty: DailyDifficultyName,
  data: NytSudokuDifficultyData
): SudokuDifficultyResult {
  const answerDate = data.print_date?.trim();
  if (!answerDate) {
    throw new Error(`Sudoku ${difficulty} payload did not include print_date.`);
  }
  validateAnswerDate(answerDate);

  return {
    difficulty,
    dayOfWeek: data.day_of_week?.trim() || null,
    answerDate,
    publishedAt: data.published?.trim() || null,
    puzzleId: data.puzzle_id,
    version: data.version,
    hints: Array.isArray(data.puzzle_data?.hints) ? [...data.puzzle_data.hints] : [],
    puzzle: Array.isArray(data.puzzle_data?.puzzle) ? [...data.puzzle_data.puzzle] : [],
    solution: Array.isArray(data.puzzle_data?.solution) ? [...data.puzzle_data.solution] : [],
  };
}

function normalizePipsDifficulty(
  difficulty: DailyDifficultyName,
  data: NytPipsDifficultyData
): PipsDifficultyResult {
  return {
    difficulty,
    puzzleId: data.id,
    backendId: data.backendId,
    constructors: data.constructors?.trim() || null,
    dominoes: Array.isArray(data.dominoes) ? toPlainObject(data.dominoes) : [],
    regions: Array.isArray(data.regions) ? toPlainObject(data.regions) : [],
    solution: Array.isArray(data.solution) ? toPlainObject(data.solution) : [],
  };
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
        content: (card.content ?? card.image_alt_text ?? "").trim(),
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

async function revealSpellingBeeAnswer(
  answerDateOverride: string | undefined,
  timezoneId: string
): Promise<SpellingBeeAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const sourceUrl = SPELLING_BEE_SOURCE_URL;
  const html = await fetchNytHtml(sourceUrl);
  const pageData = extractWindowGameData<NytSpellingBeePageData>(html, sourceUrl);
  const payload = answerDateOverride
    ? resolveSpellingBeePuzzleForDate(
        pageData,
        getRequestedAnswerDate(answerDateOverride, timezoneId),
        sourceUrl
      )
    : resolveCurrentSpellingBeePuzzle(pageData, sourceUrl);
  const normalizedAnswerDate = answerDateOverride
    ? ensureExactAnswerDate(payload.printDate, getRequestedAnswerDate(answerDateOverride, timezoneId), sourceUrl)
    : ensureAnswerDatePresent(payload.printDate, sourceUrl);
  const centerLetter = normalizeLetterList([payload.centerLetter])[0];
  const outerLetters = normalizeLetterList(payload.outerLetters);
  const validLetters = normalizeLetterList(payload.validLetters ?? [payload.centerLetter, ...payload.outerLetters]);
  const pangrams = normalizeWordList(payload.pangrams);
  const answers = normalizeWordList(payload.answers);

  if (!centerLetter || outerLetters.length === 0 || answers.length === 0) {
    throw new Error(`Spelling Bee page data from ${sourceUrl} was missing required answer fields.`);
  }

  return {
    sourceUrl,
    fetchedAt,
    answerDate: normalizedAnswerDate,
    answerDateSource: "page:print-date",
    puzzleId: payload.id,
    centerLetter,
    outerLetters,
    validLetters,
    pangrams,
    answers,
    editor: payload.editor?.trim() || null,
    extractedFrom: "nyt:spelling-bee-window-gameData",
  };
}

async function revealLetterBoxedAnswer(
  answerDateOverride: string | undefined,
  timezoneId: string
): Promise<LetterBoxedAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const sourceUrl = LETTER_BOXED_SOURCE_URL;
  const html = await fetchNytHtml(sourceUrl);
  const payload = extractWindowGameData<NytLetterBoxedPageData>(html, sourceUrl);
  const normalizedAnswerDate = answerDateOverride
    ? ensureExactAnswerDate(payload.printDate, getRequestedAnswerDate(answerDateOverride, timezoneId), sourceUrl)
    : ensureAnswerDatePresent(payload.printDate, sourceUrl);
  const sides = normalizeLetterList(payload.sides);
  const solution = normalizeWordList(payload.ourSolution);

  if (sides.length === 0 || solution.length === 0) {
    throw new Error(`Letter Boxed page data from ${sourceUrl} was missing required answer fields.`);
  }

  return {
    sourceUrl,
    fetchedAt,
    answerDate: normalizedAnswerDate,
    answerDateSource: "page:print-date",
    puzzleId: payload.id,
    sides,
    solution,
    par: typeof payload.par === "number" ? payload.par : null,
    editor: payload.editor?.trim() || null,
    extractedFrom: "nyt:letter-boxed-window-gameData",
  };
}

async function revealSudokuAnswer(
  answerDateOverride: string | undefined,
  timezoneId: string
): Promise<SudokuAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const sourceUrl = SUDOKU_SOURCE_URL;
  const html = await fetchNytHtml(sourceUrl);
  const pageData = extractWindowGameData<NytSudokuPageData>(html, sourceUrl);
  const easy = normalizeSudokuDifficulty("easy", pageData.easy);
  const medium = normalizeSudokuDifficulty("medium", pageData.medium);
  const hard = normalizeSudokuDifficulty("hard", pageData.hard);

  const expectedAnswerDate = answerDateOverride
    ? getRequestedAnswerDate(answerDateOverride, timezoneId)
    : easy.answerDate;

  for (const puzzle of [easy, medium, hard]) {
    if (puzzle.answerDate !== expectedAnswerDate) {
      throw new Error(
        `Sudoku ${puzzle.difficulty} data from ${sourceUrl} returned ${puzzle.answerDate}, but ${expectedAnswerDate} was requested.`
      );
    }
    if (puzzle.solution.length === 0) {
      throw new Error(`Sudoku ${puzzle.difficulty} data from ${sourceUrl} did not include a solution.`);
    }
  }

  return {
    sourceUrl,
    fetchedAt,
    answerDate: expectedAnswerDate,
    answerDateSource: "page:print-date",
    easy,
    medium,
    hard,
    extractedFrom: "nyt:sudoku-window-gameData",
  };
}

async function revealPipsAnswer(
  answerDateOverride: string | undefined,
  timezoneId: string
): Promise<PipsAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const requestedAnswerDate = getRequestedAnswerDate(answerDateOverride, timezoneId);
  let sourceUrl = `${PIPS_SOURCE_URL}/${requestedAnswerDate}.json`;
  let payload: NytPipsApiResponse | null = null;
  let normalizedAnswerDate = "";

  if (answerDateOverride) {
    payload = await fetchNytJson<NytPipsApiResponse>(sourceUrl);
    normalizedAnswerDate = ensureExactAnswerDate(payload.printDate, requestedAnswerDate, sourceUrl);
  } else {
    for (const candidateDate of [requestedAnswerDate, getPreviousIsoDate(requestedAnswerDate)]) {
      const candidateUrl = `${PIPS_SOURCE_URL}/${candidateDate}.json`;
      const candidatePayload = await fetchNytJsonIfExists<NytPipsApiResponse>(candidateUrl);
      if (!candidatePayload) {
        continue;
      }
      payload = candidatePayload;
      sourceUrl = candidateUrl;
      normalizedAnswerDate = ensureAnswerDatePresent(candidatePayload.printDate, candidateUrl);
      break;
    }
    if (!payload) {
      throw new Error(`Could not find a current Pips payload at ${sourceUrl} or the previous day.`);
    }
  }

  const easy = normalizePipsDifficulty("easy", payload.easy);
  const medium = normalizePipsDifficulty("medium", payload.medium);
  const hard = normalizePipsDifficulty("hard", payload.hard);

  return {
    sourceUrl,
    fetchedAt,
    answerDate: normalizedAnswerDate,
    answerDateSource: "api:print-date",
    editor: payload.editor?.trim() || null,
    easy,
    medium,
    hard,
    extractedFrom: "nyt:pips-endpoint",
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

function renderWordPressSpellingBeePostTitle(answerDate: string, puzzleId: number): string {
  return `Today's NYT Spelling Bee Answers and Pangrams for ${formatIsoDateMonthDay(answerDate)} (Puzzle #${puzzleId})`;
}

function renderWordPressLetterBoxedPostTitle(answerDate: string, puzzleId: number): string {
  return `Today's NYT Letter Boxed Answer for ${formatIsoDateMonthDay(answerDate)} (Puzzle #${puzzleId})`;
}

function renderWordPressSudokuPostTitle(answerDate: string): string {
  return `Today's NYT Sudoku Answers for ${formatIsoDateMonthDay(answerDate)} (Easy, Medium, Hard)`;
}

function renderWordPressPipsPostTitle(answerDate: string): string {
  return `Today's NYT Pips Answers for ${formatIsoDateMonthDay(answerDate)} (Easy, Medium, Hard)`;
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
  ctx: ActionCtx,
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
  ctx: ActionCtx,
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

type StrandsVisualMode = "spangram" | "solution";

interface StrandsHighlightWord {
  kind: "spangram" | "theme";
  word: string;
  coords: StrandsCoordinate[];
  fill: string;
}

function getStrandsCoordinateKey([row, col]: StrandsCoordinate): string {
  return `${row},${col}`;
}

function buildStrandsHighlightWords(
  result: StrandsAnswerResult,
  mode: StrandsVisualMode
): StrandsHighlightWord[] {
  const words: StrandsHighlightWord[] = [];

  if (mode === "solution") {
    for (const word of result.themeWords) {
      const coords = result.themeCoords[word] ?? [];
      if (coords.length) {
        words.push({
          kind: "theme",
          word,
          coords,
          fill: "#aedfee",
        });
      }
    }
  }

  if (result.spangramCoords.length) {
    words.push({
      kind: "spangram",
      word: result.spangram,
      coords: result.spangramCoords,
      fill: "#f8cd05",
    });
  }

  return mode === "spangram" ? words.filter((word) => word.kind === "spangram") : words;
}

function renderWordPressStrandsBoardSvg(
  result: StrandsAnswerResult,
  mode: StrandsVisualMode
): string | null {
  const rows = result.startingBoard.length;
  const cols = result.startingBoard.reduce((max, row) => Math.max(max, row.length), 0);

  if (!rows || !cols) {
    return null;
  }

  const step = 54;
  const radius = 21;
  const padding = 28;
  const svgWidth = padding * 2 + (cols - 1) * step + radius * 2;
  const svgHeight = padding * 2 + (rows - 1) * step + radius * 2;
  const words = buildStrandsHighlightWords(result, mode);
  const highlights = new Map<string, StrandsHighlightWord>();

  for (const word of words) {
    for (const coord of word.coords) {
      highlights.set(getStrandsCoordinateKey(coord), word);
    }
  }

  const connectors = words
    .filter((word) => word.coords.length > 1)
    .map((word) => {
      const path = word.coords
        .map(([row, col], index) => {
          const x = padding + col * step + radius;
          const y = padding + row * step + radius;
          return `${index === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");
      return `<path d="${path}" fill="none" stroke="${word.fill}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");

  const circles = result.startingBoard
    .flatMap((boardRow, rowIndex) =>
      boardRow.split("").map((letter, colIndex) => {
        const x = padding + colIndex * step + radius;
        const y = padding + rowIndex * step + radius;
        const highlight = highlights.get(getStrandsCoordinateKey([rowIndex, colIndex]));
        const fill = highlight?.fill ?? "#ffffff";

        return [
          `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${highlight ? "none" : "#dbd8c5"}" stroke-width="2"/>`,
          `<text x="${x}" y="${y + 1}" text-anchor="middle" dominant-baseline="middle" font-size="20" font-weight="700" fill="#111111" font-family="Arial, Helvetica, sans-serif">${escapeHtml(
            letter
          )}</text>`,
        ].join("");
      })
    )
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-label="${escapeHtml(
      mode === "spangram"
        ? `NYT Strands spangram board for ${result.answerDate}`
        : `NYT Strands solution board for ${result.answerDate}`
    )}">`,
    `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" rx="28" fill="#f8f7f2"/>`,
    connectors,
    circles,
    `</svg>`,
  ].join("");
}

function renderWordPressStrandsBoardHtml(
  result: StrandsAnswerResult,
  mode: StrandsVisualMode
): string {
  const svg = renderWordPressStrandsBoardSvg(result, mode);
  return svg ? `<div class="tn-strands-board">${svg}</div>` : "";
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
    ".tn-strands-board{margin:1rem 0;overflow-x:auto;-webkit-overflow-scrolling:touch;}",
    ".tn-strands-board svg{display:block;width:100%;height:auto;min-width:320px;}",
    ".tn-strands-answer-list li{margin:.35rem 0;}",
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
    [
      `<p><strong>Spangram:</strong> ${escapeHtml(result.spangram)}</p>`,
      `<p>The board below traces the spangram across the same NYT Strands grid, so you can see its exact route instead of guessing the path from the answer alone.</p>`,
      renderWordPressStrandsBoardHtml(result, "spangram"),
    ].join("\n"),
    `data-answer="${escapeHtml(result.spangram)}"`
  );
}

function renderWordPressStrandsThemeWordsHtml(result: StrandsAnswerResult): string {
  const items = result.themeWords.map((word) => `<li>${escapeHtml(word)}</li>`).join("");
  return renderWordPressStrandsRevealHtml(
    "Reveal Theme Words",
    [
      `<p>The solved grid below highlights the theme words in blue and the spangram in yellow, matching the way Strands separates the full answer set.</p>`,
      renderWordPressStrandsBoardHtml(result, "solution"),
      `<ul class="wp-block-list tn-strands-answer-list">${items}</ul>`,
    ].join("\n"),
    `data-answer-signature="${escapeHtml(buildStrandsAnswerSignature(result))}"`
  );
}

function buildSpellingBeeAnswerSignature(result: SpellingBeeAnswerResult): string {
  return normalizeComparisonValue(
    [
      String(result.puzzleId),
      result.answerDate,
      result.centerLetter,
      result.outerLetters.join(","),
      result.answers.join("|"),
    ].join("::")
  ) as string;
}

function renderWordPressSpellingBeePangramsHtml(result: SpellingBeeAnswerResult): string {
  const items = result.pangrams.map((word) => `<li><strong>${escapeHtml(word)}</strong></li>`).join("\n");
  return renderWordPressHtmlMarkerSection(
    [
      "<style>",
      ".tn-spelling-bee-reveal{margin:1rem 0;}",
      ".tn-spelling-bee-reveal summary{display:inline-flex;align-items:center;justify-content:center;padding:.8rem 1.25rem;border:0;border-radius:999px;background:#111827;color:#fff;font-weight:700;cursor:pointer;list-style:none;}",
      ".tn-spelling-bee-reveal summary::-webkit-details-marker{display:none;}",
      ".tn-spelling-bee-reveal[open] summary{display:none;}",
      ".tn-spelling-bee-reveal__content{margin-top:1rem;padding:1rem 1.1rem;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;}",
      ".tn-spelling-bee-reveal__content p:last-child,.tn-spelling-bee-reveal__content ul:last-child,.tn-spelling-bee-reveal__content ol:last-child{margin-bottom:0;}",
      "</style>",
      `<details class="tn-spelling-bee-reveal" data-answer-signature="${escapeHtml(
        `${result.puzzleId}::${result.answerDate}::${result.pangrams.join("::")}`
      )}">`,
      "<summary>Reveal Pangrams</summary>",
      '<div class="tn-spelling-bee-reveal__content">',
      `<p><strong>Pangrams for ${escapeHtml(formatIsoDateLong(result.answerDate))}</strong></p>`,
      `<ul class="wp-block-list">\n${items}\n</ul>`,
      "</div>",
      "</details>",
    ].join("\n")
  );
}

function renderWordPressSpellingBeeAnswersHtml(result: SpellingBeeAnswerResult): string {
  const pangrams = new Set(result.pangrams);
  const items = result.answers
    .map((word) => (pangrams.has(word) ? `<li><strong>${escapeHtml(word)}</strong></li>` : `<li>${escapeHtml(word)}</li>`))
    .join("\n");

  return renderWordPressHtmlMarkerSection(
    [
      "<style>",
      ".tn-spelling-bee-answer-list{margin:1rem 0;}",
      ".tn-spelling-bee-answer-list summary{display:inline-flex;align-items:center;justify-content:center;padding:.8rem 1.25rem;border:0;border-radius:999px;background:#111827;color:#fff;font-weight:700;cursor:pointer;list-style:none;}",
      ".tn-spelling-bee-answer-list summary::-webkit-details-marker{display:none;}",
      ".tn-spelling-bee-answer-list[open] summary{display:none;}",
      ".tn-spelling-bee-answer-list__content{margin-top:1rem;padding:1rem 1.1rem;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;}",
      ".tn-spelling-bee-answer-list__content p:last-child,.tn-spelling-bee-answer-list__content ul:last-child,.tn-spelling-bee-answer-list__content ol:last-child{margin-bottom:0;}",
      "</style>",
      `<details class="tn-spelling-bee-answer-list" data-answer-signature="${escapeHtml(
        buildSpellingBeeAnswerSignature(result)
      )}">`,
      "<summary>Reveal Full Answer List</summary>",
      '<div class="tn-spelling-bee-answer-list__content">',
      `<p><strong>Accepted answers for ${escapeHtml(formatIsoDateLong(result.answerDate))}</strong></p>`,
      `<ul class="wp-block-list">\n${items}\n</ul>`,
      "</div>",
      "</details>",
    ].join("\n")
  );
}

function buildLetterBoxedAnswerSignature(result: LetterBoxedAnswerResult): string {
  return normalizeComparisonValue(
    [String(result.puzzleId), result.answerDate, ...result.solution].join("::")
  ) as string;
}

function renderWordPressLetterBoxedAnswerHtml(result: LetterBoxedAnswerResult): string {
  const items = result.solution.map((word) => `<li>${escapeHtml(word)}</li>`).join("\n");
  return renderWordPressHtmlMarkerSection(
    [
      "<style>",
      ".tn-letter-boxed-reveal{margin:1rem 0;}",
      ".tn-letter-boxed-reveal summary{display:inline-flex;align-items:center;justify-content:center;padding:.8rem 1.25rem;border:0;border-radius:999px;background:#111827;color:#fff;font-weight:700;cursor:pointer;list-style:none;}",
      ".tn-letter-boxed-reveal summary::-webkit-details-marker{display:none;}",
      ".tn-letter-boxed-reveal[open] summary{display:none;}",
      ".tn-letter-boxed-reveal__content{margin-top:1rem;padding:1rem 1.1rem;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;}",
      ".tn-letter-boxed-reveal__content p:last-child,.tn-letter-boxed-reveal__content ul:last-child,.tn-letter-boxed-reveal__content ol:last-child{margin-bottom:0;}",
      "</style>",
      `<details class="tn-letter-boxed-reveal" data-answer-signature="${escapeHtml(
        buildLetterBoxedAnswerSignature(result)
      )}">`,
      "<summary>Reveal Answer</summary>",
      '<div class="tn-letter-boxed-reveal__content">',
      `<p><strong>Official solution for ${escapeHtml(formatIsoDateLong(result.answerDate))}</strong></p>`,
      `<ol class="wp-block-list">\n${items}\n</ol>`,
      "<p>The chain works because the final letter of the first word becomes the opening letter of the second.</p>",
      "</div>",
      "</details>",
    ].join("\n")
  );
}

function buildSudokuAnswerSignature(result: SudokuDifficultyResult): string {
  return `${result.puzzleId}::${result.solution.join("")}`;
}

function renderWordPressSudokuGrid(solution: number[]): string {
  const rows = [];
  for (let rowIndex = 0; rowIndex < 9; rowIndex += 1) {
    const cells = [];
    for (let colIndex = 0; colIndex < 9; colIndex += 1) {
      cells.push(`<td>${escapeHtml(String(solution[rowIndex * 9 + colIndex] ?? ""))}</td>`);
    }
    rows.push(`<tr>\n${cells.join("\n")}\n</tr>`);
  }

  return `<table class="tn-sudoku-grid">\n<tbody>\n${rows.join("\n")}\n</tbody>\n</table>`;
}

function renderWordPressSudokuDifficultyHtml(result: SudokuDifficultyResult, label: string): string {
  return renderWordPressHtmlMarkerSection(
    [
      "<style>",
      ".tn-sudoku-answer-reveal{margin:1rem 0;}",
      ".tn-sudoku-answer-reveal summary{display:inline-flex;align-items:center;justify-content:center;padding:.8rem 1.25rem;border:0;border-radius:999px;background:#111827;color:#fff;font-weight:700;cursor:pointer;list-style:none;}",
      ".tn-sudoku-answer-reveal summary::-webkit-details-marker{display:none;}",
      ".tn-sudoku-answer-reveal[open] summary{display:none;}",
      ".tn-sudoku-answer-reveal__content{margin-top:1rem;padding:1rem 1.1rem;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;overflow-x:auto;}",
      ".tn-sudoku-answer-reveal__content p:last-child,.tn-sudoku-answer-reveal__content ul:last-child,.tn-sudoku-answer-reveal__content ol:last-child{margin-bottom:0;}",
      ".tn-sudoku-grid{border-collapse:collapse;margin:0 auto;}",
      ".tn-sudoku-grid td{width:2rem;height:2rem;border:1px solid #cbd5e1;text-align:center;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;}",
      ".tn-sudoku-grid tr:nth-child(3n) td{border-bottom:2px solid #111827;}",
      ".tn-sudoku-grid tr:first-child td{border-top:2px solid #111827;}",
      ".tn-sudoku-grid td:nth-child(3n){border-right:2px solid #111827;}",
      ".tn-sudoku-grid td:first-child{border-left:2px solid #111827;}",
      "</style>",
      `<details class="tn-sudoku-answer-reveal" data-answer-signature="${escapeHtml(
        buildSudokuAnswerSignature(result)
      )}">`,
      `<summary>Reveal ${escapeHtml(label)} Solution</summary>`,
      '<div class="tn-sudoku-answer-reveal__content">',
      `<p><strong>${escapeHtml(label)} puzzle #${result.puzzleId}</strong></p>`,
      renderWordPressSudokuGrid(result.solution),
      "</div>",
      "</details>",
    ].join("\n")
  );
}

interface PipsRegionPalette {
  fill: string;
  stroke: string;
  badge: string;
}

interface StyledPipsRegion extends PipsRegion {
  palette: PipsRegionPalette | null;
}

interface PipsBoardMetrics {
  cell: number;
  gap: number;
  boardPad: number;
  radius: number;
  dashRadius: number;
}

interface PipsRenderContext {
  difficulty: PipsDifficultyResult;
  occupied: Set<string>;
  styledRegions: StyledPipsRegion[];
  maxRow: number;
  maxCol: number;
  metrics: PipsBoardMetrics;
  originX: number;
  originY: number;
}

const PIPS_REGION_PALETTES: readonly PipsRegionPalette[] = [
  { fill: "#c7a8c8", stroke: "#7617d6", badge: "#9251ca" },
  { fill: "#e49baa", stroke: "#c70042", badge: "#db137a" },
  { fill: "#a8bec4", stroke: "#006c7b", badge: "#008ea4" },
  { fill: "#ebbf97", stroke: "#b94b00", badge: "#d35a08" },
  { fill: "#b5b0bf", stroke: "#0c386a", badge: "#124076" },
  { fill: "#bcb589", stroke: "#486700", badge: "#618200" },
] as const;

function getPipsCoordKey(row: number, col: number): string {
  return `${row},${col}`;
}

function formatPipsCoordLabel([row, col]: number[]): string {
  return `R${row + 1}C${col + 1}`;
}

function buildPipsAnswerSignature(difficulty: PipsDifficultyResult): string {
  return `${difficulty.puzzleId}::${difficulty.dominoes
    .map((domino, index) => {
      const [firstCell, secondCell] = difficulty.solution[index];
      return `${domino[0]}-${domino[1]}:${formatPipsCoordLabel(firstCell)}-${formatPipsCoordLabel(secondCell)}`;
    })
    .join("|")}`;
}

function buildPipsContext(difficulty: PipsDifficultyResult): PipsRenderContext {
  const occupied = new Set<string>();
  const rows: number[] = [];
  const cols: number[] = [];

  difficulty.regions.forEach((region) => {
    for (const [row, col] of region.indices) {
      occupied.add(getPipsCoordKey(row, col));
      rows.push(row);
      cols.push(col);
    }
  });

  difficulty.solution.forEach(([firstCell, secondCell]) => {
    for (const [row, col] of [firstCell, secondCell]) {
      occupied.add(getPipsCoordKey(row, col));
      rows.push(row);
      cols.push(col);
    }
  });

  let paletteIndex = 0;
  const styledRegions: StyledPipsRegion[] = difficulty.regions.map((region) => {
    if (region.type === "empty") {
      return { ...region, palette: null };
    }

    const palette = PIPS_REGION_PALETTES[paletteIndex % PIPS_REGION_PALETTES.length];
    paletteIndex += 1;
    return { ...region, palette };
  });

  const maxRow = Math.max(...rows);
  const maxCol = Math.max(...cols);
  const metrics: PipsBoardMetrics =
    maxRow >= 7
      ? { cell: 72, gap: 10, boardPad: 14, radius: 15, dashRadius: 15 }
      : maxCol >= 4
        ? { cell: 76, gap: 10, boardPad: 14, radius: 16, dashRadius: 16 }
        : { cell: 82, gap: 10, boardPad: 14, radius: 17, dashRadius: 17 };

  return {
    difficulty,
    occupied,
    styledRegions,
    maxRow,
    maxCol,
    metrics,
    originX: 30,
    originY: 30,
  };
}

function getPipsCellTopLeft(row: number, col: number, context: PipsRenderContext): { x: number; y: number } {
  return {
    x: context.originX + col * (context.metrics.cell + context.metrics.gap),
    y: context.originY + row * (context.metrics.cell + context.metrics.gap),
  };
}

function renderPipsLine(x1: number, y1: number, x2: number, y2: number, stroke: string): string {
  return `<path d="M ${x1} ${y1} L ${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="10 10"/>`;
}

function renderPipsArc(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  sweepFlag: 0 | 1,
  radius: number,
  stroke: string
): string {
  return `<path d="M ${startX} ${startY} A ${radius} ${radius} 0 0 ${sweepFlag} ${endX} ${endY}" fill="none" stroke="${stroke}" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="10 10"/>`;
}

function renderPipsRegionOutlines(context: PipsRenderContext): string {
  const segments: string[] = [];

  for (const region of context.styledRegions) {
    if (!region.palette) continue;
    const sameRegion = new Set(region.indices.map(([row, col]) => getPipsCoordKey(row, col)));
    const stroke = region.palette.stroke;

    for (const [row, col] of region.indices) {
      const { x, y } = getPipsCellTopLeft(row, col, context);
      const top = !sameRegion.has(getPipsCoordKey(row - 1, col));
      const right = !sameRegion.has(getPipsCoordKey(row, col + 1));
      const bottom = !sameRegion.has(getPipsCoordKey(row + 1, col));
      const left = !sameRegion.has(getPipsCoordKey(row, col - 1));
      const r = context.metrics.dashRadius;
      const size = context.metrics.cell;

      if (top) segments.push(renderPipsLine(x + r, y, x + size - r, y, stroke));
      if (right) segments.push(renderPipsLine(x + size, y + r, x + size, y + size - r, stroke));
      if (bottom) segments.push(renderPipsLine(x + r, y + size, x + size - r, y + size, stroke));
      if (left) segments.push(renderPipsLine(x, y + r, x, y + size - r, stroke));

      if (top && left) segments.push(renderPipsArc(x + r, y, x, y + r, 0, r, stroke));
      if (top && right) segments.push(renderPipsArc(x + size - r, y, x + size, y + r, 1, r, stroke));
      if (bottom && right) segments.push(renderPipsArc(x + size, y + size - r, x + size - r, y + size, 1, r, stroke));
      if (bottom && left) segments.push(renderPipsArc(x + r, y + size, x, y + size - r, 1, r, stroke));

      const rightNeighbor = sameRegion.has(getPipsCoordKey(row, col + 1));
      const bottomNeighbor = sameRegion.has(getPipsCoordKey(row + 1, col));

      if (rightNeighbor) {
        const neighborTop = !sameRegion.has(getPipsCoordKey(row - 1, col + 1));
        const neighborBottom = !sameRegion.has(getPipsCoordKey(row + 1, col + 1));
        if (top && neighborTop) {
          segments.push(renderPipsLine(x + size - r, y, x + size + context.metrics.gap + r, y, stroke));
        }
        if (bottom && neighborBottom) {
          segments.push(
            renderPipsLine(x + size - r, y + size, x + size + context.metrics.gap + r, y + size, stroke)
          );
        }
      }

      if (bottomNeighbor) {
        const neighborLeft = !sameRegion.has(getPipsCoordKey(row + 1, col - 1));
        const neighborRight = !sameRegion.has(getPipsCoordKey(row + 1, col + 1));
        if (left && neighborLeft) {
          segments.push(renderPipsLine(x, y + size - r, x, y + size + context.metrics.gap + r, stroke));
        }
        if (right && neighborRight) {
          segments.push(
            renderPipsLine(x + size, y + size - r, x + size, y + size + context.metrics.gap + r, stroke)
          );
        }
      }
    }
  }

  return segments.join("");
}

function getPipsClueLabel(region: PipsRegion): string {
  if (region.type === "equals") return "=";
  if (region.type === "unequal") return "&#8800;";
  if (region.type === "sum") return String(region.target ?? "");
  if (region.type === "greater") return `&gt;${region.target ?? ""}`;
  if (region.type === "less") return `&lt;${region.target ?? ""}`;
  return "";
}

function getPipsClueAnchor(region: StyledPipsRegion, context: PipsRenderContext): {
  anchor: number[];
  placement: "right" | "bottom";
} {
  const anchor = [...region.indices].sort((a, b) => (a[0] !== b[0] ? b[0] - a[0] : b[1] - a[1]))[0];
  const [row, col] = anchor;
  const belowOpen = !context.occupied.has(getPipsCoordKey(row + 1, col));
  return { anchor, placement: row === context.maxRow || belowOpen ? "bottom" : "right" };
}

function renderPipsBadge(label: string, centerX: number, centerY: number, palette: PipsRegionPalette): string {
  const squareSide = 40;
  const fontSize = label.length >= 3 ? 18 : label.length === 2 ? 22 : 30;
  return [
    "<g>",
    `<rect x="${centerX - squareSide / 2}" y="${centerY - squareSide / 2}" width="${squareSide}" height="${squareSide}" rx="7" fill="${palette.badge}" transform="rotate(45 ${centerX} ${centerY})"/>`,
    `<text x="${centerX}" y="${centerY + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="800" fill="#ffffff" font-family="Arial, Helvetica, sans-serif">${label}</text>`,
    "</g>",
  ].join("");
}

function renderPipsClueBadges(context: PipsRenderContext): string {
  const badges: string[] = [];

  for (const region of context.styledRegions) {
    if (!region.palette || region.type === "empty") continue;
    const label = getPipsClueLabel(region);
    const { anchor, placement } = getPipsClueAnchor(region, context);
    const { x, y } = getPipsCellTopLeft(anchor[0], anchor[1], context);
    const cornerX = x + context.metrics.cell;
    const cornerY = y + context.metrics.cell;
    const centerX = placement === "right" ? cornerX + 18 : cornerX - 18;
    const centerY = placement === "right" ? cornerY - 18 : cornerY + 18;
    badges.push(renderPipsBadge(label, centerX, centerY, region.palette));
  }

  return badges.join("");
}

function getPipsDotOffsets(value: number, spreadX: number, spreadY: number): [number, number][] {
  const left = -spreadX;
  const center = 0;
  const right = spreadX;
  const top = -spreadY;
  const middle = 0;
  const bottom = spreadY;

  switch (value) {
    case 0:
      return [];
    case 1:
      return [[center, middle]];
    case 2:
      return [[left, top], [right, bottom]];
    case 3:
      return [[left, top], [center, middle], [right, bottom]];
    case 4:
      return [[left, top], [right, top], [left, bottom], [right, bottom]];
    case 5:
      return [[left, top], [right, top], [center, middle], [left, bottom], [right, bottom]];
    case 6:
      return [
        [left, top],
        [right, top],
        [left, middle],
        [right, middle],
        [left, bottom],
        [right, bottom],
      ];
    default:
      return [];
  }
}

function renderPipsDominoes(context: PipsRenderContext): string {
  const output: string[] = [];
  const inset = Math.round(context.metrics.cell * 0.12);
  const pipRadius = Math.max(3.5, context.metrics.cell * 0.055);
  const spreadX = context.metrics.cell * 0.15;
  const spreadY = context.metrics.cell * 0.15;

  context.difficulty.dominoes.forEach((domino, index) => {
    const [firstCell, secondCell] = context.difficulty.solution[index];
    const [r1, c1] = firstCell;
    const [r2, c2] = secondCell;
    const firstPos = getPipsCellTopLeft(r1, c1, context);
    const secondPos = getPipsCellTopLeft(r2, c2, context);
    const horizontal = r1 === r2;
    const x = Math.min(firstPos.x, secondPos.x) + inset;
    const y = Math.min(firstPos.y, secondPos.y) + inset;
    const width = horizontal
      ? context.metrics.cell * 2 + context.metrics.gap - inset * 2
      : context.metrics.cell - inset * 2;
    const height = horizontal
      ? context.metrics.cell - inset * 2
      : context.metrics.cell * 2 + context.metrics.gap - inset * 2;
    const dividerX = horizontal
      ? Math.min(firstPos.x, secondPos.x) + context.metrics.cell + context.metrics.gap / 2
      : null;
    const dividerY = horizontal
      ? null
      : Math.min(firstPos.y, secondPos.y) + context.metrics.cell + context.metrics.gap / 2;

    output.push(
      "<g>",
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.max(
        11,
        context.metrics.radius - 3
      )}" fill="#f6f6f6" stroke="#444444" stroke-width="3"/>`
    );

    if (horizontal && dividerX !== null) {
      output.push(
        `<path d="M ${dividerX} ${y + 8} L ${dividerX} ${y + height - 8}" fill="none" stroke="#e2dbdb" stroke-width="3" stroke-linecap="round"/>`
      );
    } else if (dividerY !== null) {
      output.push(
        `<path d="M ${x + 8} ${dividerY} L ${x + width - 8} ${dividerY}" fill="none" stroke="#e2dbdb" stroke-width="3" stroke-linecap="round"/>`
      );
    }

    [firstCell, secondCell].forEach(([row, col], valueIndex) => {
      const center = {
        x: context.originX + col * (context.metrics.cell + context.metrics.gap) + context.metrics.cell / 2,
        y: context.originY + row * (context.metrics.cell + context.metrics.gap) + context.metrics.cell / 2,
      };
      getPipsDotOffsets(domino[valueIndex], spreadX, spreadY).forEach(([dx, dy]) => {
        output.push(`<circle cx="${center.x + dx}" cy="${center.y + dy}" r="${pipRadius}" fill="#2c2c2c"/>`);
      });
    });

    output.push("</g>");
  });

  return output.join("");
}

function renderWordPressPipsBoardSvg(answerDate: string, difficulty: PipsDifficultyResult, label: string): string {
  const context = buildPipsContext(difficulty);
  const gridWidth = (context.maxCol + 1) * context.metrics.cell + context.maxCol * context.metrics.gap;
  const gridHeight = (context.maxRow + 1) * context.metrics.cell + context.maxRow * context.metrics.gap;
  const svgWidth = context.originX + gridWidth + 86;
  const svgHeight = context.originY + gridHeight + 86;
  const cells: string[] = [];

  for (let row = 0; row <= context.maxRow; row += 1) {
    for (let col = 0; col <= context.maxCol; col += 1) {
      const key = getPipsCoordKey(row, col);
      if (!context.occupied.has(key)) continue;
      const region = context.styledRegions.find((candidate) =>
        candidate.indices.some(([candidateRow, candidateCol]) => candidateRow === row && candidateCol === col)
      );
      const { x, y } = getPipsCellTopLeft(row, col, context);
      cells.push(
        `<rect x="${x}" y="${y}" width="${context.metrics.cell}" height="${context.metrics.cell}" rx="${context.metrics.radius}" fill="#e1cbc5"/>`
      );
      if (region?.palette) {
        cells.push(
          `<rect x="${x}" y="${y}" width="${context.metrics.cell}" height="${context.metrics.cell}" rx="${context.metrics.radius}" fill="${region.palette.fill}"/>`
        );
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-label="${escapeHtml(
      `Solved ${label} NYT Pips board for ${formatIsoDateLong(answerDate)}`
    )}">`,
    `<rect x="${context.originX - context.metrics.boardPad}" y="${context.originY - context.metrics.boardPad}" width="${
      gridWidth + context.metrics.boardPad * 2
    }" height="${gridHeight + context.metrics.boardPad * 2}" rx="26" fill="#dbc2b9"/>`,
    cells.join(""),
    renderPipsRegionOutlines(context),
    renderPipsDominoes(context),
    renderPipsClueBadges(context),
    "</svg>",
  ].join("");
}

function renderWordPressPipsPlacementList(difficulty: PipsDifficultyResult): string {
  return difficulty.dominoes
    .map((domino, index) => {
      const [firstCell, secondCell] = difficulty.solution[index];
      if (domino[0] === domino[1]) {
        return `<li><strong>${domino[0]}-${domino[1]}:</strong> ${domino[0]}s fill ${formatPipsCoordLabel(
          firstCell
        )} and ${formatPipsCoordLabel(secondCell)}.</li>`;
      }

      return `<li><strong>${domino[0]}-${domino[1]}:</strong> ${domino[0]} goes in ${formatPipsCoordLabel(
        firstCell
      )}, and ${domino[1]} goes in ${formatPipsCoordLabel(secondCell)}.</li>`;
    })
    .join("");
}

function getWordPressPipsIntro(label: string): string {
  if (label === "Easy") {
    return "The solved board below keeps the NYT region layout intact, so you can compare the answer without decoding raw coordinates first.";
  }
  if (label === "Medium") {
    return "This version works best as a visual cross-check: the clue regions stay in place, and every finished domino sits exactly where it belongs.";
  }
  return "Hard Pips is much easier to verify when the full board is visible, so the answer below pairs the NYT-style board with the exact solved placement of every domino.";
}

function renderWordPressPipsDifficultyHtml(
  answerDate: string,
  difficulty: PipsDifficultyResult,
  label: "Easy" | "Medium" | "Hard"
): string {
  return renderWordPressHtmlMarkerSection(
    [
      "<style>",
      ".tn-pips-answer-reveal{margin:1rem 0;}",
      ".tn-pips-answer-reveal summary{display:inline-flex;align-items:center;justify-content:center;padding:.8rem 1.25rem;border:0;border-radius:999px;background:#111827;color:#fff;font-weight:700;cursor:pointer;list-style:none;}",
      ".tn-pips-answer-reveal summary::-webkit-details-marker{display:none;}",
      ".tn-pips-answer-reveal[open] summary{display:none;}",
      ".tn-pips-answer-reveal__content{margin-top:1rem;padding:1rem 1.1rem;border:1px solid #e5e7eb;border-radius:16px;background:#f9fafb;}",
      ".tn-pips-answer-reveal__content p:last-child,.tn-pips-answer-reveal__content ul:last-child,.tn-pips-answer-reveal__content ol:last-child{margin-bottom:0;}",
      ".tn-pips-answer-figure{margin:1rem 0;overflow-x:auto;-webkit-overflow-scrolling:touch;}",
      ".tn-pips-answer-figure svg{display:block;width:100%;height:auto;min-width:280px;}",
      ".tn-pips-answer-list{margin-top:1rem;}",
      ".tn-pips-answer-list li{margin:.4rem 0;}",
      "</style>",
      `<details class="tn-pips-answer-reveal" data-answer-signature="${escapeHtml(
        buildPipsAnswerSignature(difficulty)
      )}">`,
      `<summary>Reveal ${label} Solution</summary>`,
      '<div class="tn-pips-answer-reveal__content">',
      `<p><strong>${label} puzzle #${difficulty.puzzleId}</strong></p>`,
      `<p>${escapeHtml(getWordPressPipsIntro(label))}</p>`,
      `<div class="tn-pips-answer-figure">${renderWordPressPipsBoardSvg(answerDate, difficulty, label)}</div>`,
      "<p>The placement list below matches the solved board cell by cell, so you can confirm one domino at a time if you would rather not scan the whole puzzle at once.</p>",
      `<ul class="wp-block-list tn-pips-answer-list">${renderWordPressPipsPlacementList(difficulty)}</ul>`,
      "</div>",
      "</details>",
    ].join("\n")
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
  ctx: ActionCtx,
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
      const currentSpangramSection = extractMarkedSectionContent(
        post.contentRaw,
        getStrandsSpangramMarkerStart(),
        getStrandsSpangramMarkerEnd()
      );
      const currentThemeWordsSection = extractMarkedSectionContent(
        post.contentRaw,
        getStrandsThemeWordsMarkerStart(),
        getStrandsThemeWordsMarkerEnd()
      );
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
      const hasVisualBoardMarkup =
        currentSpangramSection?.includes("tn-strands-board") &&
        currentThemeWordsSection?.includes("tn-strands-board");

      if (
        currentSignature === nextSignature &&
        post.titleRaw === updatedTitle &&
        isCurrentDateUpToDate &&
        isClueUpToDate &&
        hasVisualBoardMarkup
      ) {
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

async function syncSpellingBee(
  ctx: ActionCtx,
  answerDateOverride: string | undefined,
  timezoneId: string,
  dryRun: boolean
): Promise<Record<string, unknown>> {
  const result = await revealSpellingBeeAnswer(answerDateOverride, timezoneId);
  const summary: Record<string, unknown> = {
    answerDate: result.answerDate,
    puzzleId: result.puzzleId,
    centerLetter: result.centerLetter,
    answerCount: result.answers.length,
    pangramCount: result.pangrams.length,
    database: dryRun ? "skipped:dry-run" : "saved",
    wordpress: "skipped:not-configured",
    wordpress_gw: dryRun ? "skipped:dry-run" : "updated",
  };

  if (!dryRun) {
    await ctx.runMutation(internal.nytAnswers.upsertSpellingBeeAnswer, {
      answerDate: result.answerDate,
      answerDateSource: result.answerDateSource,
      sourceUrl: result.sourceUrl,
      puzzleId: result.puzzleId,
      centerLetter: result.centerLetter,
      outerLetters: [...result.outerLetters],
      validLetters: [...result.validLetters],
      pangrams: [...result.pangrams],
      pangramCount: result.pangrams.length,
      answers: [...result.answers],
      answerCount: result.answers.length,
      editor: result.editor ?? undefined,
      fetchedAt: result.fetchedAt,
      extractedFrom: result.extractedFrom,
      payload: toPlainObject(result),
    });

    const updatedTitle = renderWordPressSpellingBeePostTitle(result.answerDate, result.puzzleId);
    const updatedContentDate = escapeHtml(formatIsoDateLong(result.answerDate));
    const updatedCenterLetter = escapeHtml(result.centerLetter);
    const updatedOuterLetters = escapeHtml(result.outerLetters.join(", "));
    const renderedPangramsHtml = renderWordPressSpellingBeePangramsHtml(result);
    const renderedAnswersHtml = renderWordPressSpellingBeeAnswersHtml(result);

    try {
      const gwLoadedPost = await fetchWordPressPost(getGwSpellingBeeArticleUrl(), "GW");
      const withDate = replaceInlineMarkedText(
        gwLoadedPost.contentRaw,
        updatedContentDate,
        SPELLING_BEE_MARKERS.currentDateStart,
        SPELLING_BEE_MARKERS.currentDateEnd
      );
      const withCenterLetter = replaceInlineMarkedText(
        withDate,
        updatedCenterLetter,
        SPELLING_BEE_MARKERS.centerLetterStart,
        SPELLING_BEE_MARKERS.centerLetterEnd
      );
      const withOuterLetters = replaceInlineMarkedText(
        withCenterLetter,
        updatedOuterLetters,
        SPELLING_BEE_MARKERS.outerLettersStart,
        SPELLING_BEE_MARKERS.outerLettersEnd
      );
      const withPangrams = replaceMarkedSection(
        withOuterLetters,
        renderedPangramsHtml,
        SPELLING_BEE_MARKERS.pangramsStart,
        SPELLING_BEE_MARKERS.pangramsEnd
      );
      const updatedContent = replaceMarkedSection(
        withPangrams,
        renderedAnswersHtml,
        SPELLING_BEE_MARKERS.answersStart,
        SPELLING_BEE_MARKERS.answersEnd
      );

      if (updatedContent === gwLoadedPost.contentRaw && gwLoadedPost.titleRaw === updatedTitle) {
        summary.wordpress_gw = "skipped:no-change";
      } else {
        await updateWordPressPost(gwLoadedPost, updatedContent, updatedTitle, "GW");
      }
    } catch (error) {
      summary.wordpress_gw = `error:${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return summary;
}

async function syncLetterBoxed(
  ctx: ActionCtx,
  answerDateOverride: string | undefined,
  timezoneId: string,
  dryRun: boolean
): Promise<Record<string, unknown>> {
  const result = await revealLetterBoxedAnswer(answerDateOverride, timezoneId);
  const summary: Record<string, unknown> = {
    answerDate: result.answerDate,
    puzzleId: result.puzzleId,
    solution: [...result.solution],
    par: result.par,
    database: dryRun ? "skipped:dry-run" : "saved",
    wordpress: "skipped:not-configured",
    wordpress_gw: dryRun ? "skipped:dry-run" : "updated",
  };

  if (!dryRun) {
    await ctx.runMutation(internal.nytAnswers.upsertLetterBoxedAnswer, {
      answerDate: result.answerDate,
      answerDateSource: result.answerDateSource,
      sourceUrl: result.sourceUrl,
      puzzleId: result.puzzleId,
      sides: [...result.sides],
      solution: [...result.solution],
      solutionCount: result.solution.length,
      par: result.par ?? undefined,
      editor: result.editor ?? undefined,
      fetchedAt: result.fetchedAt,
      extractedFrom: result.extractedFrom,
      payload: toPlainObject(result),
    });

    const updatedTitle = renderWordPressLetterBoxedPostTitle(result.answerDate, result.puzzleId);
    const updatedContentDate = escapeHtml(formatIsoDateLong(result.answerDate));
    const updatedSides = escapeHtml(result.sides.join(" | "));
    const renderedAnswerHtml = renderWordPressLetterBoxedAnswerHtml(result);

    try {
      const gwLoadedPost = await fetchWordPressPost(getGwLetterBoxedArticleUrl(), "GW");
      const withDate = replaceInlineMarkedText(
        gwLoadedPost.contentRaw,
        updatedContentDate,
        LETTER_BOXED_MARKERS.currentDateStart,
        LETTER_BOXED_MARKERS.currentDateEnd
      );
      const withSides = replaceInlineMarkedText(
        withDate,
        updatedSides,
        LETTER_BOXED_MARKERS.sidesStart,
        LETTER_BOXED_MARKERS.sidesEnd
      );
      const updatedContent = replaceMarkedSection(
        withSides,
        renderedAnswerHtml,
        LETTER_BOXED_MARKERS.answerStart,
        LETTER_BOXED_MARKERS.answerEnd
      );

      if (updatedContent === gwLoadedPost.contentRaw && gwLoadedPost.titleRaw === updatedTitle) {
        summary.wordpress_gw = "skipped:no-change";
      } else {
        await updateWordPressPost(gwLoadedPost, updatedContent, updatedTitle, "GW");
      }
    } catch (error) {
      summary.wordpress_gw = `error:${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return summary;
}

async function syncSudoku(
  ctx: ActionCtx,
  answerDateOverride: string | undefined,
  timezoneId: string,
  dryRun: boolean
): Promise<Record<string, unknown>> {
  const result = await revealSudokuAnswer(answerDateOverride, timezoneId);
  const summary: Record<string, unknown> = {
    answerDate: result.answerDate,
    easyPuzzleId: result.easy.puzzleId,
    mediumPuzzleId: result.medium.puzzleId,
    hardPuzzleId: result.hard.puzzleId,
    database: dryRun ? "skipped:dry-run" : "saved",
    wordpress: "skipped:not-configured",
    wordpress_gw: dryRun ? "skipped:dry-run" : "updated",
  };

  if (!dryRun) {
    await ctx.runMutation(internal.nytAnswers.upsertSudokuAnswer, {
      answerDate: result.answerDate,
      answerDateSource: result.answerDateSource,
      sourceUrl: result.sourceUrl,
      easyPuzzleId: result.easy.puzzleId,
      mediumPuzzleId: result.medium.puzzleId,
      hardPuzzleId: result.hard.puzzleId,
      easy: toPlainObject(result.easy),
      medium: toPlainObject(result.medium),
      hard: toPlainObject(result.hard),
      fetchedAt: result.fetchedAt,
      extractedFrom: result.extractedFrom,
      payload: toPlainObject(result),
    });

    const updatedTitle = renderWordPressSudokuPostTitle(result.answerDate);
    const updatedContentDate = escapeHtml(formatIsoDateLong(result.answerDate));
    const renderedEasyHtml = renderWordPressSudokuDifficultyHtml(result.easy, "Easy");
    const renderedMediumHtml = renderWordPressSudokuDifficultyHtml(result.medium, "Medium");
    const renderedHardHtml = renderWordPressSudokuDifficultyHtml(result.hard, "Hard");

    try {
      const gwLoadedPost = await fetchWordPressPost(getGwSudokuArticleUrl(), "GW");
      const withDate = replaceInlineMarkedText(
        gwLoadedPost.contentRaw,
        updatedContentDate,
        SUDOKU_MARKERS.currentDateStart,
        SUDOKU_MARKERS.currentDateEnd
      );
      const withEasy = replaceMarkedSection(
        withDate,
        renderedEasyHtml,
        SUDOKU_MARKERS.easyStart,
        SUDOKU_MARKERS.easyEnd
      );
      const withMedium = replaceMarkedSection(
        withEasy,
        renderedMediumHtml,
        SUDOKU_MARKERS.mediumStart,
        SUDOKU_MARKERS.mediumEnd
      );
      const updatedContent = replaceMarkedSection(
        withMedium,
        renderedHardHtml,
        SUDOKU_MARKERS.hardStart,
        SUDOKU_MARKERS.hardEnd
      );

      if (updatedContent === gwLoadedPost.contentRaw && gwLoadedPost.titleRaw === updatedTitle) {
        summary.wordpress_gw = "skipped:no-change";
      } else {
        await updateWordPressPost(gwLoadedPost, updatedContent, updatedTitle, "GW");
      }
    } catch (error) {
      summary.wordpress_gw = `error:${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return summary;
}

async function syncPips(
  ctx: ActionCtx,
  answerDateOverride: string | undefined,
  timezoneId: string,
  dryRun: boolean
): Promise<Record<string, unknown>> {
  const result = await revealPipsAnswer(answerDateOverride, timezoneId);
  const summary: Record<string, unknown> = {
    answerDate: result.answerDate,
    easyPuzzleId: result.easy.puzzleId,
    mediumPuzzleId: result.medium.puzzleId,
    hardPuzzleId: result.hard.puzzleId,
    database: dryRun ? "skipped:dry-run" : "saved",
    wordpress: "skipped:not-configured",
    wordpress_gw: dryRun ? "skipped:dry-run" : "updated",
  };

  if (!dryRun) {
    await ctx.runMutation(internal.nytAnswers.upsertPipsAnswer, {
      answerDate: result.answerDate,
      answerDateSource: result.answerDateSource,
      sourceUrl: result.sourceUrl,
      editor: result.editor ?? undefined,
      easyPuzzleId: result.easy.puzzleId,
      mediumPuzzleId: result.medium.puzzleId,
      hardPuzzleId: result.hard.puzzleId,
      easy: toPlainObject(result.easy),
      medium: toPlainObject(result.medium),
      hard: toPlainObject(result.hard),
      fetchedAt: result.fetchedAt,
      extractedFrom: result.extractedFrom,
      payload: toPlainObject(result),
    });

    const updatedTitle = renderWordPressPipsPostTitle(result.answerDate);
    const updatedContentDate = escapeHtml(formatIsoDateLong(result.answerDate));
    const renderedEasyHtml = renderWordPressPipsDifficultyHtml(result.answerDate, result.easy, "Easy");
    const renderedMediumHtml = renderWordPressPipsDifficultyHtml(result.answerDate, result.medium, "Medium");
    const renderedHardHtml = renderWordPressPipsDifficultyHtml(result.answerDate, result.hard, "Hard");

    try {
      const gwLoadedPost = await fetchWordPressPost(getGwPipsArticleUrl(), "GW");
      const withDate = replaceInlineMarkedText(
        gwLoadedPost.contentRaw,
        updatedContentDate,
        PIPS_MARKERS.currentDateStart,
        PIPS_MARKERS.currentDateEnd
      );
      const withEasy = replaceMarkedSection(
        withDate,
        renderedEasyHtml,
        PIPS_MARKERS.easyStart,
        PIPS_MARKERS.easyEnd
      );
      const withMedium = replaceMarkedSection(
        withEasy,
        renderedMediumHtml,
        PIPS_MARKERS.mediumStart,
        PIPS_MARKERS.mediumEnd
      );
      const updatedContent = replaceMarkedSection(
        withMedium,
        renderedHardHtml,
        PIPS_MARKERS.hardStart,
        PIPS_MARKERS.hardEnd
      );

      if (updatedContent === gwLoadedPost.contentRaw && gwLoadedPost.titleRaw === updatedTitle) {
        summary.wordpress_gw = "skipped:no-change";
      } else {
        await updateWordPressPost(gwLoadedPost, updatedContent, updatedTitle, "GW");
      }
    } catch (error) {
      summary.wordpress_gw = `error:${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return summary;
}

async function handleSync(
  ctx: ActionCtx,
  payload: SyncRequestPayload
): Promise<SyncSummary> {
  const dryRun = Boolean(payload.dryRun);
  const requestedPuzzles = payload.puzzles?.filter(isPuzzleName).length
    ? payload.puzzles!.filter(isPuzzleName)
    : [...ALL_NYT_PUZZLES];

  const summary: SyncSummary = {
    answerDate: payload.answerDate || "",
    dryRun,
    puzzles: {},
  };

  for (const puzzle of requestedPuzzles) {
    try {
      if (puzzle === "wordle") {
        const wordleSummary = await syncWordle(ctx, payload.answerDate, getWordleTimezone(payload.timezoneId), dryRun);
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
        const strandsSummary = await syncStrands(ctx, payload.answerDate, getStrandsTimezone(payload.timezoneId), dryRun);
        summary.puzzles.strands = strandsSummary;
        summary.answerDate = String(strandsSummary.answerDate || summary.answerDate);
      } else if (puzzle === "spelling-bee") {
        const spellingBeeSummary = await syncSpellingBee(
          ctx,
          payload.answerDate,
          getSpellingBeeTimezone(payload.timezoneId),
          dryRun
        );
        summary.puzzles["spelling-bee"] = spellingBeeSummary;
        summary.answerDate = String(spellingBeeSummary.answerDate || summary.answerDate);
      } else if (puzzle === "letter-boxed") {
        const letterBoxedSummary = await syncLetterBoxed(
          ctx,
          payload.answerDate,
          getLetterBoxedTimezone(payload.timezoneId),
          dryRun
        );
        summary.puzzles["letter-boxed"] = letterBoxedSummary;
        summary.answerDate = String(letterBoxedSummary.answerDate || summary.answerDate);
      } else if (puzzle === "sudoku") {
        const sudokuSummary = await syncSudoku(ctx, payload.answerDate, getSudokuTimezone(payload.timezoneId), dryRun);
        summary.puzzles.sudoku = sudokuSummary;
        summary.answerDate = String(sudokuSummary.answerDate || summary.answerDate);
      } else if (puzzle === "pips") {
        const pipsSummary = await syncPips(ctx, payload.answerDate, getPipsTimezone(payload.timezoneId), dryRun);
        summary.puzzles.pips = pipsSummary;
        summary.answerDate = String(pipsSummary.answerDate || summary.answerDate);
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

  if (!dryRun) {
    const issues: { group: string; identifier: string; reason: string }[] = [];
    let updatedCount = 0;

    for (const [puzzleName, puzzleSummary] of Object.entries(summary.puzzles)) {
      const ps = puzzleSummary as Record<string, unknown>;
      if (ps.status === "error" && typeof ps.error === "string") {
        issues.push({ group: "NYT puzzle sync", identifier: puzzleName, reason: ps.error });
      } else {
        // Check per-site wordpress errors (stored as "error:..." strings)
        for (const siteKey of ["wordpress", "wordpress_gw"]) {
          const val = ps[siteKey];
          if (typeof val === "string" && val.startsWith("error:")) {
            const site = siteKey === "wordpress" ? "Tech Nerdiness" : "Gaming Wize";
            issues.push({ group: `${site} update`, identifier: puzzleName, reason: val.slice(6) });
          } else if (val === "updated") {
            updatedCount++;
          }
        }
      }
    }

    await ctx.runMutation(internal.syncRuns.record, {
      automationType: "nyt_puzzles",
      ranAt: new Date().toISOString(),
      updatedCount,
      issueCount: issues.length,
      issues,
    });
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
