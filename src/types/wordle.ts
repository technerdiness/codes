export type WordleAnswerSource = "nyt:solution-endpoint";

export type WordleAnswerDateSource = "api:print-date" | "fetched-at";

export interface WordleAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  answerDateSource: WordleAnswerDateSource;
  answer: string;
  puzzleId: number;
  daysSinceLaunch: number;
  editor: string | null;
  extractedFrom: WordleAnswerSource;
}

export interface WordleAnswerHistoryEntry {
  answerDate: string;
  answer: string;
}
