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
