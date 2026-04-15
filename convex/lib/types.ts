export type ScrapeProvider = "beebom" | "techwiser";
export type WordPressSiteKey = "technerdiness" | "gamingwize";

export interface ScrapedCode {
  code: string;
  status: "active";
  provider: ScrapeProvider;
  rewardsText?: string;
  isNew?: boolean;
}

export interface ExpiredCode {
  code: string;
  provider: ScrapeProvider;
}

export interface ScrapeResult {
  codes: ScrapedCode[];
  expiredCodes: ExpiredCode[];
}

export type LetrosoAnswerSource =
  | "answer-reveal:data-answer"
  | "answer-reveal:tiles"
  | "schema:faq"
  | "schema:article-body"
  | "chrome:page-state";

export type LetrosoAnswerDateSource =
  | "page-title"
  | "og-title"
  | "published-at"
  | "modified-at"
  | "fetched-at"
  | "chrome:state-title";

export interface LetrosoRevealTile {
  index: number;
  clue: string;
  letter: string;
}

export interface LetrosoAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  answerDateSource: LetrosoAnswerDateSource;
  pageTitle: string | null;
  ogTitle: string | null;
  publishedAt: string | null;
  modifiedAt: string | null;
  sectionHeading: string;
  sectionSelector: string;
  answer: string;
  meaning: string | null;
  tiles: LetrosoRevealTile[];
  extractedFrom: LetrosoAnswerSource;
}

export interface LetrosoAnswerHistoryEntry {
  answerDate: string;
  answer: string;
}

export type ContextoAnswerSource =
  | "answer-reveal:data-answer"
  | "answer-reveal:tiles"
  | "schema:faq"
  | "schema:article-body";

export type ContextoAnswerDateSource =
  | "page-title"
  | "og-title"
  | "published-at"
  | "modified-at"
  | "fetched-at";

export interface ContextoRevealTile {
  index: number;
  letter: string;
}

export interface ContextoAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  answerDateSource: ContextoAnswerDateSource;
  pageTitle: string | null;
  ogTitle: string | null;
  publishedAt: string | null;
  modifiedAt: string | null;
  sectionHeading: string;
  sectionSelector: string;
  answer: string;
  tiles: ContextoRevealTile[];
  extractedFrom: ContextoAnswerSource;
}

export interface ContextoAnswerHistoryEntry {
  answerDate: string;
  answer: string;
}

export interface ZipWall {
  cellIdx: number;
  direction: "UP" | "DOWN" | "LEFT" | "RIGHT";
}

export interface ZipAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  puzzleId: number;
  gridSize: number;
  // solution: ordered list of all cell indices forming the path (start → end)
  solution: number[];
  // orderedSequence: indices of the numbered waypoint cells in order (1, 2, 3...)
  orderedSequence: number[];
  walls: ZipWall[];
  extractedFrom: "linkedin:voyager-api";
}
