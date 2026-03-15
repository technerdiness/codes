import type {
  StrandsAnswerDateSource,
  StrandsAnswerResult,
  StrandsCoordinate,
} from "../types/strands.ts";

const DEFAULT_STRANDS_TIMEZONE = "UTC";
const DEFAULT_STRANDS_SOURCE_URL = "https://www.nytimes.com/svc/strands/v2";

interface NytStrandsApiResponse {
  status?: string;
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

export interface RevealStrandsAnswerOptions {
  answerDate?: string;
  timezoneId?: string;
}

export async function revealStrandsAnswer(
  options: RevealStrandsAnswerOptions = {}
): Promise<StrandsAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const timezoneId = options.timezoneId?.trim() || getDefaultStrandsTimezone();
  const answerDate = options.answerDate?.trim() || formatDateInTimezone(new Date(), timezoneId);
  validateAnswerDate(answerDate);

  const sourceUrl = `${DEFAULT_STRANDS_SOURCE_URL}/${answerDate}.json`;
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; CodesAutomationsBot/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
  }

  const payload = (await response.json()) as NytStrandsApiResponse;
  if (!Array.isArray(payload.themeWords) || payload.themeWords.length === 0) {
    throw new Error(`Strands response from ${sourceUrl} did not include theme words.`);
  }
  if (!payload.spangram?.trim()) {
    throw new Error(`Strands response from ${sourceUrl} did not include a spangram.`);
  }
  if (!payload.clue?.trim()) {
    throw new Error(`Strands response from ${sourceUrl} did not include a clue.`);
  }

  const normalizedAnswerDate = payload.printDate?.trim() || answerDate;
  validateAnswerDate(normalizedAnswerDate);

  const themeWords = payload.themeWords.map(normalizeWord);
  const themeCoords = Object.fromEntries(
    payload.themeWords.map((word, index) => [
      themeWords[index],
      normalizeCoords(payload.themeCoords?.[word]),
    ])
  ) as Record<string, StrandsCoordinate[]>;

  return {
    sourceUrl,
    fetchedAt,
    answerDate: normalizedAnswerDate,
    answerDateSource: resolveAnswerDateSource(payload.printDate, answerDate),
    puzzleId: payload.id,
    clue: payload.clue.trim(),
    spangram: normalizeWord(payload.spangram),
    spangramCoords: normalizeCoords(payload.spangramCoords),
    themeWords,
    themeCoords,
    editor: payload.editor?.trim() || null,
    constructors: payload.constructors?.trim() || null,
    startingBoard: Array.isArray(payload.startingBoard)
      ? payload.startingBoard.map((row) => row.trim())
      : [],
    extractedFrom: "nyt:strands-endpoint",
  };
}

function resolveAnswerDateSource(
  printDate: string | undefined,
  requestedDate: string
): StrandsAnswerDateSource {
  if (printDate?.trim() && printDate.trim() === requestedDate) {
    return "api:print-date";
  }

  return "fetched-at";
}

function normalizeWord(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
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

function getDefaultStrandsTimezone(): string {
  return (
    process.env.STRANDS_TIMEZONE?.trim() ||
    process.env.TZ ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    DEFAULT_STRANDS_TIMEZONE
  );
}

function validateAnswerDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid answer date: ${value}. Expected YYYY-MM-DD.`);
  }
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
