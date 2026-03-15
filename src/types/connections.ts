export type ConnectionsAnswerSource = "nyt:connections-endpoint";

export type ConnectionsAnswerDateSource = "api:print-date" | "fetched-at";

export type ConnectionsCategoryColor = "yellow" | "green" | "blue" | "purple";

export interface ConnectionsCategoryCard {
  content: string;
  position: number | null;
}

export interface ConnectionsCategory {
  color: ConnectionsCategoryColor;
  title: string;
  cards: ConnectionsCategoryCard[];
}

export interface ConnectionsAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  answerDateSource: ConnectionsAnswerDateSource;
  puzzleId: number;
  editor: string | null;
  categories: ConnectionsCategory[];
  extractedFrom: ConnectionsAnswerSource;
}
