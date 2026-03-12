import * as cheerio from "cheerio";
import type { ScrapeResult, ScrapedCode } from "./scraper-types";

const USER_AGENT = "Mozilla/5.0 (compatible; RobloxCodesBot/1.0)";
const LIST_SEPARATOR_REGEX = /\s*:\s*|\s*[–—]\s*|(?:\s+-\s*|\s*-\s+)/;
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";

function normalizeCode(raw: string): string | null {
  if (!raw) return null;
  let code = raw.replace(/[`"'“”‘’]/g, "").trim();
  code = code.replace(/^code[:\s-]*/i, "").trim();

  // 🧹 Remove anything inside parentheses
  code = code.replace(/\(.*?\)/g, "").trim();

  if (!code) return null;

  const spacedParts = code.split(/\s+/).filter(Boolean);
  const hasSingleLetterSegments =
    spacedParts.length > 1 && spacedParts.every((segment) => segment.length === 1);
  if (hasSingleLetterSegments) return null;

  return code.replace(/\s+/g, "");
}

const NEW_REGEX = /\(\s*new\s*(?:code)?\s*\)/i;

function stripNewFlag(value: string): { cleaned: string; isNew: boolean } {
  const hasNew = NEW_REGEX.test(value);
  const cleaned = value.replace(NEW_REGEX, "").trim();
  return { cleaned, isNew: hasNew };
}

/**
 * Finds the correct code list or table
 * - Looks only inside .beebom-single-content.entry-content.highlight
 * - Skips divider lists and menus
 * - No regex restriction for code patterns (Beebom may list codes without rewards)
 */
function findCodesContainer($: cheerio.CheerioAPI): cheerio.Cheerio<cheerio.Element> | null {
  const content = $(".beebom-single-content.entry-content.highlight");
  if (!content.length) return null;

  // 1️⃣ Try headings like "Active Codes" / "Working Codes"
  let section = content.find(
    "h2:contains('Active Codes'), h3:contains('Active Codes'), h2:contains('Working Codes'), h3:contains('Working Codes')"
  ).first();

  // 2️⃣ Fallback: find any list/table that isn't a menu, divider, or redeem section
  if (!section.length) {
    const candidates = content.find("ul, ol, table");

    // ✅ Fix: initialize as an empty Cheerio collection instead of null
    let probable: cheerio.Cheerio<cheerio.Element> = $([]);

    candidates.each((_: number, el: cheerio.Element) => {
      const elem = $(el);

      if (
        elem.hasClass("is-style-inline-divider-list") ||
        elem.hasClass("menu") ||
        elem.attr("id") === "primary-menu"
      ) {
        return;
      }

      const text = elem.text().trim();
      if (!text) return;

      const prevHeading = elem.prevAll("h2, h3").first().text().toLowerCase();
      if (prevHeading.includes("redeem") || prevHeading.includes("expired")) return;

      probable = elem;
      return false; // stop at the first valid one
    });

    if (probable.length) return probable;
  }

  // 3️⃣ If found via heading, locate the list/table below it
  if (section.length) {
    const next = section
      .nextAll("ul, ol, table")
      .not(".is-style-inline-divider-list")
      .not(".menu")
      .filter((_: number, el: cheerio.Element) => $(el).attr("id") !== "primary-menu")
      .first();

    if (next.length) return next;
  }

  return null;
}

function findExpiredCodes($: cheerio.CheerioAPI): { code: string; provider: "beebom" }[] {
  const content = $(".beebom-single-content.entry-content.highlight");
  if (!content.length) return [];

  const expired: { code: string; provider: "beebom" }[] = [];

  const headings = content.find(HEADING_SELECTOR).filter((_, el) => {
    const text = $(el).text().toLowerCase();
    return text.includes("expired");
  });

  headings.each((_, headingEl) => {
    const heading = $(headingEl);
    let pointer = heading.next();
    let list: cheerio.Cheerio<cheerio.Element> | null = null;

    while (pointer.length) {
      if (pointer.is(HEADING_SELECTOR)) {
        break; // stop at next heading
      }
      if (pointer.is("ul, ol")) {
        list = pointer;
        break;
      }
      pointer = pointer.next();
    }

    if (!list || !list.length) {
      return;
    }

    list.find("li").each((_: number, li: cheerio.Element) => {
      const text = $(li).text().trim();
      if (!text) return;
      expired.push({ code: text, provider: "beebom" });
    });
  });

  return expired;
}

export async function scrapeBeebomPage(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const container = findCodesContainer($);
  const codes: ScrapedCode[] = [];
  const expiredCodes = findExpiredCodes($);

  if (container && container.length) {
    if (container.is("table")) {
      const rows = container.find("tbody tr");
      const targetRows = rows.length ? rows : container.find("tr");

      targetRows.each((_: number, row: cheerio.Element) => {
        const cells = $(row).find("td");
        if (!cells.length) return;

        const codeCell = $(cells[0]);
        const rewardCell = cells.length > 1 ? $(cells[1]) : null;

        const codeText =
          codeCell.find("strong").first().text().trim() || codeCell.text().trim();
        const rewardText = rewardCell ? rewardCell.text().trim() : "";

        const { cleaned: codeClean, isNew: codeNew } = stripNewFlag(codeText);
        const normalized = normalizeCode(codeClean);
        if (!normalized) return;

        const entry: ScrapedCode = {
          code: normalized,
          status: "active",
          provider: "beebom",
        };

        if (rewardText) entry.rewardsText = rewardText;
        if (codeNew) entry.isNew = true;

        codes.push(entry);
      });
    } else {
      container.find("li").each((_: number, li: cheerio.Element) => {
        const text = $(li).text().trim();
        if (!text) return;

        const [beforeSeparator, rewardPart = ""] = text.split(LIST_SEPARATOR_REGEX, 2);
        const rewardRaw = rewardPart.trim();

        const { cleaned: codeClean, isNew: codeNew } = stripNewFlag(beforeSeparator);
        const normalized = normalizeCode(codeClean);
        if (!normalized) return;
        const entry: ScrapedCode = {
          code: normalized,
          status: "active",
          provider: "beebom",
        };

        if (rewardRaw) entry.rewardsText = rewardRaw;
        if (codeNew) entry.isNew = true;

        codes.push(entry);
      });
    }
  }

  return {
    codes,
    expiredCodes,
  };
}