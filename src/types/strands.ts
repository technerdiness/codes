export type StrandsAnswerSource = "nyt:strands-endpoint";

export type StrandsAnswerDateSource = "api:print-date" | "fetched-at";

export type StrandsCoordinate = [number, number];

export interface StrandsAnswerResult {
  sourceUrl: string;
  fetchedAt: string;
  answerDate: string;
  answerDateSource: StrandsAnswerDateSource;
  puzzleId: number;
  clue: string;
  spangram: string;
  spangramCoords: StrandsCoordinate[];
  themeWords: string[];
  themeCoords: Record<string, StrandsCoordinate[]>;
  editor: string | null;
  constructors: string | null;
  startingBoard: string[];
  extractedFrom: StrandsAnswerSource;
}
