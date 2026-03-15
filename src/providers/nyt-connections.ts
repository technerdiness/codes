import type {
  ConnectionsAnswerDateSource,
  ConnectionsAnswerResult,
  ConnectionsCategory,
  ConnectionsCategoryCard,
  ConnectionsCategoryColor,
} from "../types/connections.ts";

const DEFAULT_CONNECTIONS_TIMEZONE = "UTC";
const DEFAULT_CONNECTIONS_SOURCE_URL = "https://www.nytimes.com/svc/connections/v2";
const CONNECTIONS_COLORS = ["yellow", "green", "blue", "purple"] as const;

interface NytConnectionsApiCard {
  content: string;
  position?: number;
}

interface NytConnectionsApiCategory {
  title: string;
  cards: NytConnectionsApiCard[];
}

interface NytConnectionsApiResponse {
  status?: string;
  id: number;
  print_date: string;
  editor?: string;
  categories: NytConnectionsApiCategory[];
}

export interface RevealConnectionsAnswerOptions {
  answerDate?: string;
  timezoneId?: string;
}

export async function revealConnectionsAnswer(
  options: RevealConnectionsAnswerOptions = {}
): Promise<ConnectionsAnswerResult> {
  const fetchedAt = new Date().toISOString();
  const timezoneId = options.timezoneId?.trim() || getDefaultConnectionsTimezone();
  const answerDate = options.answerDate?.trim() || formatDateInTimezone(new Date(), timezoneId);
  validateAnswerDate(answerDate);

  const sourceUrl = `${DEFAULT_CONNECTIONS_SOURCE_URL}/${answerDate}.json`;
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; CodesAutomationsBot/1.0)",
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
    answerDateSource: resolveAnswerDateSource(payload.print_date, answerDate),
    puzzleId: payload.id,
    editor: payload.editor?.trim() || null,
    categories: payload.categories.map((category, index) =>
      normalizeCategory(category, CONNECTIONS_COLORS[index] ?? "purple")
    ),
    extractedFrom: "nyt:connections-endpoint",
  };
}

function normalizeCategory(
  category: NytConnectionsApiCategory,
  color: ConnectionsCategoryColor
): ConnectionsCategory {
  return {
    color,
    title: category.title.trim(),
    cards: category.cards.map(normalizeCard),
  };
}

function normalizeCard(card: NytConnectionsApiCard): ConnectionsCategoryCard {
  return {
    content: card.content.trim(),
    position:
      typeof card.position === "number" && Number.isInteger(card.position) ? card.position : null,
  };
}

function resolveAnswerDateSource(
  printDate: string | undefined,
  requestedDate: string
): ConnectionsAnswerDateSource {
  if (printDate?.trim() && printDate.trim() === requestedDate) {
    return "api:print-date";
  }

  return "fetched-at";
}

function getDefaultConnectionsTimezone(): string {
  return (
    process.env.CONNECTIONS_TIMEZONE?.trim() ||
    process.env.TZ ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    DEFAULT_CONNECTIONS_TIMEZONE
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
