import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import type { ScrapeResult, ScrapedCode, ExpiredCode } from "../types";

const USER_AGENT = "Mozilla/5.0 (compatible; RobloxCodesBot/1.0)";
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";
const LIST_SEPARATOR_REGEX = /\s*:\s*|\s*[–—]\s*|(?:\s+-\s*|\s*-\s+)/;

function normalizeCode(raw: string): string | null {
  if (!raw) return null;
  let code = raw.replace(/[`"'""'']/g, "").trim();
  code = code.replace(/^code[:\s-]*/i, "").trim();
  code = code.replace(/\(.*?\)/g, "").trim();

  if (!code) return null;

  const spacedParts = code.split(/\s+/).filter(Boolean);
  const hasSingleLetterSegments =
    spacedParts.length > 1 && spacedParts.every((segment) => segment.length === 1);
  if (hasSingleLetterSegments) return null;

  return code.replace(/\s+/g, "");
}

function hasNewMarker($: cheerio.CheerioAPI, li: Element): boolean {
  const el = $(li);
  // TechWiser uses <mark class="has-inline-color has-vivid-cyan-blue-color">new</mark>
  const marks = el.find("mark");
  let found = false;
  marks.each((_, mark) => {
    if ($(mark).text().trim().toLowerCase() === "new") {
      found = true;
      return false;
    }
  });
  return found;
}

function stripNewText(text: string): string {
  // Remove (new), (New), (NEW), (new code) patterns left over after tag stripping
  return text.replace(/\(\s*new\s*(?:code)?\s*\)/gi, "").trim();
}

function findActiveSection($: cheerio.CheerioAPI): cheerio.Cheerio<Element> | null {
  const headings = $(HEADING_SELECTOR);
  let activeHeading: cheerio.Cheerio<Element> | null = null;

  headings.each((_, el) => {
    const text = $(el).text().toLowerCase();
    if (text.includes("active") || text.includes("working")) {
      activeHeading = $(el);
      return false;
    }
  });

  if (!activeHeading) return null;

  // Walk forward from the heading to find the next <ul>
  let pointer = (activeHeading as cheerio.Cheerio<Element>).next();
  while (pointer.length) {
    if (pointer.is(HEADING_SELECTOR)) break;
    if (pointer.is("ul")) return pointer;
    pointer = pointer.next();
  }

  return null;
}

function findExpiredSection($: cheerio.CheerioAPI): cheerio.Cheerio<Element> | null {
  const headings = $(HEADING_SELECTOR);
  let expiredHeading: cheerio.Cheerio<Element> | null = null;

  headings.each((_, el) => {
    const text = $(el).text().toLowerCase();
    if (text.includes("expired")) {
      expiredHeading = $(el);
      return false;
    }
  });

  if (!expiredHeading) return null;

  let pointer = (expiredHeading as cheerio.Cheerio<Element>).next();
  while (pointer.length) {
    if (pointer.is(HEADING_SELECTOR)) break;
    if (pointer.is("ul")) return pointer;
    pointer = pointer.next();
  }

  return null;
}

function parseActiveListItem($: cheerio.CheerioAPI, li: Element): ScrapedCode | null {
  const el = $(li);
  const isNew = hasNewMarker($, li);

  // Get the code from <strong> tag
  const strongEl = el.find("strong").first();
  let codeRaw = "";
  if (strongEl.length) {
    // Get only the direct text of the first strong, excluding nested marks
    codeRaw = strongEl.clone().find("mark").remove().end().text().trim();
  }

  // Get the full text to extract rewards
  const fullText = stripNewText(el.text().trim());

  // Split on separator to get code and rewards
  const [beforeSeparator, rewardPart = ""] = fullText.split(LIST_SEPARATOR_REGEX, 2);

  // Use strong text if available, otherwise use before-separator text
  const rawCode = codeRaw || stripNewText(beforeSeparator);
  const normalized = normalizeCode(rawCode);
  if (!normalized) return null;

  const rewardRaw = rewardPart.replace(/\(\s*new\s*(?:code)?\s*\)/gi, "").trim();

  const entry: ScrapedCode = {
    code: normalized,
    status: "active",
    provider: "techwiser",
  };

  if (rewardRaw) entry.rewardsText = rewardRaw;
  if (isNew) entry.isNew = true;

  return entry;
}

function parseExpiredListItem($: cheerio.CheerioAPI, li: Element): ExpiredCode | null {
  const el = $(li);
  const strongEl = el.find("strong").first();
  let codeRaw = strongEl.length
    ? strongEl.clone().find("mark").remove().end().text().trim()
    : "";

  if (!codeRaw) {
    // Expired codes sometimes don't have <strong>, just plain text
    const fullText = el.text().trim();
    const [beforeSeparator] = fullText.split(LIST_SEPARATOR_REGEX, 2);
    codeRaw = beforeSeparator.trim();
  }

  // Clean separator chars that might be stuck to the code
  codeRaw = codeRaw.replace(/[–—:]\s*$/, "").trim();

  if (!codeRaw) return null;

  return { code: codeRaw, provider: "techwiser" };
}

export async function scrapeTechwiserPage(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const codes: ScrapedCode[] = [];
  const expiredCodes: ExpiredCode[] = [];

  // Parse active codes
  const activeList = findActiveSection($);
  if (activeList?.length) {
    activeList.find("li").each((_: number, li: Element) => {
      const code = parseActiveListItem($, li);
      if (code) codes.push(code);
    });
  }

  // Parse expired codes
  const expiredList = findExpiredSection($);
  if (expiredList?.length) {
    expiredList.find("li").each((_: number, li: Element) => {
      const code = parseExpiredListItem($, li);
      if (code) expiredCodes.push(code);
    });
  }

  return { codes, expiredCodes };
}
