import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import type {
  LetrosoAnswerDateSource,
  LetrosoAnswerResult,
  LetrosoAnswerSource,
  LetrosoRevealTile,
} from "../types/letroso.ts";

const USER_AGENT = "Mozilla/5.0 (compatible; RobloxCodesBot/1.0)";
const DEFAULT_SECTION_HEADING = "What is Today’s Letroso Answer?";
const ANSWER_SECTION_SELECTOR =
  ".wp-block-beebom-puzzle-features-answer-reveal .answer-reveal__container";
const ANSWER_HEADING_ID = "#h-what-is-today-s-letroso-answer";
const HUMAN_DATE_REGEX =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i;
const MONTH_NUMBERS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

export const DEFAULT_LETROSO_URL = "https://beebom.com/puzzle/letroso-answer-today/";

interface SchemaGraphEntry {
  "@type"?: string | string[];
  articleBody?: string;
  mainEntity?: Array<{
    name?: string;
    acceptedAnswer?: {
      text?: string;
    };
  }>;
}

interface SchemaGraph {
  "@graph"?: SchemaGraphEntry[];
}

export async function revealLetrosoAnswer(url: string): Promise<LetrosoAnswerResult> {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  const fetchedAt = new Date().toISOString();
  const $ = cheerio.load(html);
  const pageTitle = readPageTitle($);
  const ogTitle = readMetaContent($, "og:title");
  const publishedAt = readMetaContent($, "article:published_time");
  const modifiedAt = readMetaContent($, "article:modified_time");
  const { answerDate, answerDateSource } = resolveAnswerDate({
    pageTitle,
    ogTitle,
    publishedAt,
    modifiedAt,
    fetchedAt,
  });
  const { container, headingText } = findAnswerContainer($);
  const tiles = container ? extractTiles($, container) : [];
  const answerFromData = normalizeAnswer(container?.attr("data-answer"));

  let answer = answerFromData;
  let extractedFrom: LetrosoAnswerSource | null = answer ? "answer-reveal:data-answer" : null;

  if (!answer && tiles.length) {
    answer = normalizeAnswer(tiles.map((tile) => tile.letter).join(""));
    extractedFrom = answer ? "answer-reveal:tiles" : null;
  }

  if (!answer || !extractedFrom) {
    const fallback = extractAnswerFromSchema($);
    if (fallback) {
      answer = fallback.answer;
      extractedFrom = fallback.extractedFrom;
    }
  }

  if (!answer || !extractedFrom) {
    throw new Error(
      `Could not extract the Letroso answer from ${url} using ${ANSWER_SECTION_SELECTOR} or schema fallbacks.`
    );
  }

  return {
    sourceUrl: url,
    fetchedAt,
    answerDate,
    answerDateSource,
    pageTitle,
    ogTitle,
    publishedAt,
    modifiedAt,
    sectionHeading: headingText,
    sectionSelector: ANSWER_SECTION_SELECTOR,
    answer,
    meaning: extractMeaning($, answer),
    tiles,
    extractedFrom,
  };
}

function findAnswerContainer($: cheerio.CheerioAPI): {
  container: cheerio.Cheerio<Element> | null;
  headingText: string;
} {
  const heading = $(ANSWER_HEADING_ID).first();

  if (heading.length) {
    const section = heading.nextAll(".wp-block-beebom-puzzle-features-answer-reveal").first();
    const container = section.find(".answer-reveal__container").first();

    if (container.length) {
      return {
        container,
        headingText: normalizeWhitespace(heading.text()) || DEFAULT_SECTION_HEADING,
      };
    }
  }

  const container = $(ANSWER_SECTION_SELECTOR).first();
  if (container.length) {
    return {
      container,
      headingText: DEFAULT_SECTION_HEADING,
    };
  }

  return {
    container: null,
    headingText: DEFAULT_SECTION_HEADING,
  };
}

function extractTiles(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<Element>
): LetrosoRevealTile[] {
  return container
    .find(".answer-reveal__tiles .answer-reveal__tile")
    .toArray()
    .map((tileElement, fallbackIndex) => {
      const tile = $(tileElement);
      const letter =
        normalizeAnswer(tile.attr("data-letter")) ??
        normalizeAnswer(tile.find(".answer-reveal__tile-letter").text());

      if (!letter) {
        return null;
      }

      const indexValue = tile.attr("data-index");
      const parsedIndex =
        typeof indexValue === "string" && indexValue.trim()
          ? Number.parseInt(indexValue, 10)
          : fallbackIndex;

      return {
        index: Number.isNaN(parsedIndex) ? fallbackIndex : parsedIndex,
        clue: normalizeWhitespace(tile.find(".answer-reveal__tile-question").text()),
        letter,
      };
    })
    .filter((tile): tile is LetrosoRevealTile => tile !== null);
}

function extractAnswerFromSchema($: cheerio.CheerioAPI): {
  answer: string;
  extractedFrom: LetrosoAnswerSource;
} | null {
  const rawSchema = $("script.yoast-schema-graph").first().contents().text().trim();
  if (!rawSchema) {
    return null;
  }

  try {
    const schema = JSON.parse(rawSchema) as SchemaGraph;
    const graph = Array.isArray(schema["@graph"]) ? schema["@graph"] : [];
    const faqText = extractFaqAnswerText(graph);
    const faqAnswer = faqText ? extractLastUppercaseWord(faqText) : null;

    if (faqAnswer) {
      return {
        answer: faqAnswer,
        extractedFrom: "schema:faq",
      };
    }

    const articleBody = graph.find((entry) => hasType(entry, "NewsArticle"))?.articleBody ?? "";
    const articleBodyAnswer = extractAnswerFromArticleBody(articleBody);

    if (articleBodyAnswer) {
      return {
        answer: articleBodyAnswer,
        extractedFrom: "schema:article-body",
      };
    }
  } catch {
    return null;
  }

  return null;
}

function extractFaqAnswerText(graph: SchemaGraphEntry[]): string | null {
  const faqEntry = graph.find((entry) => hasType(entry, "FAQPage"));
  const questions = faqEntry?.mainEntity;

  if (!Array.isArray(questions)) {
    return null;
  }

  const targetQuestion = questions.find((question) => {
    const name = question.name?.toLowerCase() ?? "";
    return name.includes("what is today's letroso") || name.includes("what is today’s letroso");
  });

  return normalizeWhitespace(targetQuestion?.acceptedAnswer?.text ?? "") || null;
}

function extractAnswerFromArticleBody(articleBody: string): string | null {
  const meaningMatch = articleBody.match(/Meaning of\s+([A-Z]{3,12})\s*:/);
  return normalizeAnswer(meaningMatch?.[1]);
}

function extractMeaning($: cheerio.CheerioAPI, answer: string): string | null {
  const matchingParagraph = $("p")
    .toArray()
    .map((element) => normalizeWhitespace($(element).text()))
    .find((text) => text.startsWith(`Meaning of ${answer}:`));

  if (matchingParagraph) {
    return normalizeWhitespace(matchingParagraph.replace(`Meaning of ${answer}:`, ""));
  }

  const articleBody = extractArticleBodyFromSchema($);
  if (!articleBody) {
    return null;
  }

  const escapedAnswer = escapeRegex(answer);
  const regex = new RegExp(`Meaning of\\s+${escapedAnswer}\\s*:\\s*([^\\n]+)`, "i");
  const match = articleBody.match(regex);
  return normalizeWhitespace(match?.[1] ?? "") || null;
}

function extractLastUppercaseWord(value: string): string | null {
  const matches = [...value.matchAll(/\b([A-Z]{3,12})\b/g)];
  return normalizeAnswer(matches.at(-1)?.[1]);
}

function extractArticleBodyFromSchema($: cheerio.CheerioAPI): string | null {
  const rawSchema = $("script.yoast-schema-graph").first().contents().text().trim();
  if (!rawSchema) {
    return null;
  }

  try {
    const schema = JSON.parse(rawSchema) as SchemaGraph;
    const graph = Array.isArray(schema["@graph"]) ? schema["@graph"] : [];
    return graph.find((entry) => hasType(entry, "NewsArticle"))?.articleBody ?? null;
  } catch {
    return null;
  }
}

function hasType(entry: SchemaGraphEntry, type: string): boolean {
  if (Array.isArray(entry["@type"])) {
    return entry["@type"].includes(type);
  }

  return entry["@type"] === type;
}

function readPageTitle($: cheerio.CheerioAPI): string | null {
  const title = normalizeWhitespace($("title").first().text());
  return title || null;
}

function readMetaContent($: cheerio.CheerioAPI, property: string): string | null {
  const content = $(`meta[property="${property}"]`).attr("content");
  return normalizeWhitespace(content ?? "") || null;
}

function resolveAnswerDate(input: {
  pageTitle: string | null;
  ogTitle: string | null;
  publishedAt: string | null;
  modifiedAt: string | null;
  fetchedAt: string;
}): {
  answerDate: string;
  answerDateSource: LetrosoAnswerDateSource;
} {
  const pageTitleDate = parseHumanDate(input.pageTitle);
  if (pageTitleDate) {
    return {
      answerDate: pageTitleDate,
      answerDateSource: "page-title",
    };
  }

  const ogTitleDate = parseHumanDate(input.ogTitle);
  if (ogTitleDate) {
    return {
      answerDate: ogTitleDate,
      answerDateSource: "og-title",
    };
  }

  const publishedDate = extractIsoDate(input.publishedAt);
  if (publishedDate) {
    return {
      answerDate: publishedDate,
      answerDateSource: "published-at",
    };
  }

  const modifiedDate = extractIsoDate(input.modifiedAt);
  if (modifiedDate) {
    return {
      answerDate: modifiedDate,
      answerDateSource: "modified-at",
    };
  }

  return {
    answerDate: input.fetchedAt.slice(0, 10),
    answerDateSource: "fetched-at",
  };
}

function parseHumanDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(HUMAN_DATE_REGEX);
  if (!match) {
    return null;
  }

  const [, monthName, dayValue, yearValue] = match;
  const monthNumber = MONTH_NUMBERS[monthName.toLowerCase()];
  const dayNumber = dayValue.padStart(2, "0");

  if (!monthNumber) {
    return null;
  }

  return `${yearValue}-${monthNumber}-${dayNumber}`;
}

function extractIsoDate(value: string | null): string | null {
  const match = value?.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match?.[1] ?? null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAnswer(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, "").trim().toUpperCase();
  return normalized || null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
