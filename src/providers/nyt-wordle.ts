import type { WordleAnswerDateSource, WordleAnswerResult } from "../types/wordle.ts";

const DEFAULT_WORDLE_TIMEZONE = "UTC";
const DEFAULT_WORDLE_SOURCE_URL = "https://www.nytimes.com/svc/wordle/v2";

interface NytWordleApiResponse {
  id: number;
  solution: string;
  print_date: string;
  days_since_launch: number;
  editor?: string;
}

export interface RevealWordleAnswerOptions {
  answerDate?: string;
  timezoneId?: string;
}

export async function revealWordleAnswer(
  options: RevealWordleAnswerOptions = {}
): Promise<WordleAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const timezoneId = options.timezoneId?.trim() || getDefaultWordleTimezone();
  const answerDate = options.answerDate?.trim() || formatDateInTimezone(new Date(), timezoneId);
  validateAnswerDate(answerDate);

  const sourceUrl = `${DEFAULT_WORDLE_SOURCE_URL}/${answerDate}.json`;
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; CodesAutomationsBot/1.0)",
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
    answerDateSource: resolveAnswerDateSource(payload.print_date, answerDate),
    answer: normalizeAnswer(payload.solution),
    puzzleId: payload.id,
    daysSinceLaunch: payload.days_since_launch,
    editor: payload.editor?.trim() || null,
    extractedFrom: "nyt:solution-endpoint",
  };
}

function resolveAnswerDateSource(
  printDate: string | undefined,
  requestedDate: string
): WordleAnswerDateSource {
  if (printDate?.trim() && printDate.trim() === requestedDate) {
    return "api:print-date";
  }

  return "fetched-at";
}

function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function getDefaultWordleTimezone(): string {
  return (
    process.env.WORDLE_TIMEZONE?.trim() ||
    process.env.WORDPRESS_UPDATE_TIMEZONE?.trim() ||
    process.env.TZ ||
    DEFAULT_WORDLE_TIMEZONE
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
