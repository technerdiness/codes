import { access, cp, mkdtemp, rm } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

import { chromium, type Page } from "playwright-core";
import type { LetrosoAnswerDateSource, LetrosoAnswerResult } from "../types/letroso.ts";

const PROFILE_COPY_SKIP_SEGMENTS = new Set([
  "blob_storage",
  "Cache",
  "Code Cache",
  "Crashpad",
  "DawnGraphiteCache",
  "DawnWebGPUCache",
  "GPUCache",
  "GrShaderCache",
  "Media Cache",
  "ShaderCache",
]);

const DEFAULT_LANGUAGE = "en";
const DEFAULT_CHROME_PROFILE = "Default";
const DEFAULT_WAIT_MS = 30_000;
const PAGE_STATE_EXTRACTION = "chrome:page-state" as const;
const DEFAULT_SECTION_HEADING = "Letroso daily page state";
const DEFAULT_SECTION_SELECTOR = "#root";

interface BrowserStateHit {
  answer: string;
  gameId: string | null;
  gameTitle: string | null;
  language: string | null;
  mode: string | null;
  path: string;
}

interface BrowserStateSnapshot {
  answer: string | null;
  hits: BrowserStateHit[];
  locationHref: string;
  pageTitle: string;
  pageTextPreview: string;
  timezoneId: string;
}

export interface ChromeLetrosoRevealOptions {
  chromeExecutablePath?: string;
  chromeUserDataDir?: string;
  chromeProfile?: string;
  headless?: boolean;
  keepProfileCopy?: boolean;
  language?: string;
  locale?: string;
  pageUrl?: string;
  timezoneId?: string;
  waitMs?: number;
}

export interface ChromeLetrosoRevealResult {
  chromeExecutablePath: string;
  chromeProfile: string;
  chromeUserDataDir: string;
  gameId: string;
  language: string;
  pageTextPreview: string;
  profileCopyDir?: string;
  result: LetrosoAnswerResult;
  timezoneId: string;
}

export function getDefaultChromeExecutablePath(): string {
  switch (process.platform) {
    case "darwin":
      return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    case "win32":
      return path.join(
        process.env.PROGRAMFILES ?? "C:\\Program Files",
        "Google",
        "Chrome",
        "Application",
        "chrome.exe"
      );
    default:
      return "/usr/bin/google-chrome";
  }
}

export function getDefaultChromeUserDataDir(): string {
  switch (process.platform) {
    case "darwin":
      return path.join(homedir(), "Library", "Application Support", "Google", "Chrome");
    case "win32":
      return path.join(
        process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local"),
        "Google",
        "Chrome",
        "User Data"
      );
    default:
      return path.join(homedir(), ".config", "google-chrome");
  }
}

export function buildLetrosoDailyUrl(language = DEFAULT_LANGUAGE): string {
  return `https://letroso.com/${language}/daily`;
}

export async function revealLetrosoAnswerFromChrome(
  options: ChromeLetrosoRevealOptions = {}
): Promise<ChromeLetrosoRevealResult> {
  const chromeExecutablePath =
    options.chromeExecutablePath?.trim() || getDefaultChromeExecutablePath();
  const chromeUserDataDir = options.chromeUserDataDir?.trim() || getDefaultChromeUserDataDir();
  const chromeProfile = options.chromeProfile?.trim() || DEFAULT_CHROME_PROFILE;
  const language = normalizeLanguage(options.language);
  const pageUrl = options.pageUrl?.trim() || buildLetrosoDailyUrl(language);
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  const fetchedAt = new Date().toISOString();

  await assertReadable(chromeExecutablePath, "Chrome executable");
  await assertReadable(chromeUserDataDir, "Chrome user data directory");

  const sourceProfileDir = path.join(chromeUserDataDir, chromeProfile);
  await assertReadable(sourceProfileDir, "Chrome profile directory");

  const profileCopyDir = await cloneChromeProfile({
    chromeProfile,
    chromeUserDataDir,
    sourceProfileDir,
  });

  try {
    const context = await chromium.launchPersistentContext(profileCopyDir, {
      executablePath: chromeExecutablePath,
      headless: options.headless ?? true,
      locale: options.locale?.trim() || undefined,
      timezoneId: options.timezoneId?.trim() || undefined,
      viewport: {
        width: 1440,
        height: 1600,
      },
      args: ["--disable-blink-features=AutomationControlled"],
    });

    try {
      const page = await openWorkingPage(context);
      await page.goto(pageUrl, {
        timeout: waitMs,
        waitUntil: "domcontentloaded",
      });

      const snapshot = await waitForBrowserState(page, waitMs);
      const primaryHit = snapshot.hits.find((hit) => hit.answer) ?? null;

      if (!primaryHit) {
        throw new Error("Letroso page loaded but no answer was found in browser state.");
      }

      const answer = normalizeAnswer(primaryHit.answer);
      const { answerDate, answerDateSource } = resolveAnswerDate(
        primaryHit.gameTitle,
        snapshot.timezoneId
      );
      const gameId = primaryHit.gameId?.trim() || "unknown";
      const result: LetrosoAnswerResult = {
        sourceUrl: snapshot.locationHref || pageUrl,
        fetchedAt,
        answerDate,
        answerDateSource,
        pageTitle: snapshot.pageTitle,
        ogTitle: null,
        publishedAt: null,
        modifiedAt: null,
        sectionHeading: DEFAULT_SECTION_HEADING,
        sectionSelector: DEFAULT_SECTION_SELECTOR,
        answer,
        meaning: null,
        tiles: [],
        extractedFrom: PAGE_STATE_EXTRACTION,
      };

      return {
        chromeExecutablePath,
        chromeProfile,
        chromeUserDataDir,
        gameId,
        language: primaryHit.language?.trim() || language,
        pageTextPreview: snapshot.pageTextPreview,
        profileCopyDir: options.keepProfileCopy ? profileCopyDir : undefined,
        result,
        timezoneId: snapshot.timezoneId || options.timezoneId?.trim() || "unknown",
      };
    } finally {
      await context.close();
    }
  } finally {
    if (!options.keepProfileCopy) {
      await rm(profileCopyDir, {
        force: true,
        recursive: true,
      });
    }
  }
}

async function assertReadable(targetPath: string, label: string): Promise<void> {
  try {
    await access(targetPath, fsConstants.R_OK);
  } catch (error) {
    const suffix = error instanceof Error && error.message ? ` (${error.message})` : "";
    throw new Error(`${label} is not readable at ${targetPath}${suffix}`);
  }
}

async function cloneChromeProfile(input: {
  chromeProfile: string;
  chromeUserDataDir: string;
  sourceProfileDir: string;
}): Promise<string> {
  const destinationRoot = await mkdtemp(path.join(tmpdir(), "letroso-chrome-profile-"));
  const localStatePath = path.join(input.chromeUserDataDir, "Local State");
  const destinationProfileDir = path.join(destinationRoot, input.chromeProfile);

  try {
    await access(localStatePath, fsConstants.R_OK);
    await cp(localStatePath, path.join(destinationRoot, "Local State"));
  } catch {
    // Local State is optional for this workflow.
  }

  await cp(input.sourceProfileDir, destinationProfileDir, {
    filter: (sourcePath) => shouldCopyProfileEntry(input.sourceProfileDir, sourcePath),
    recursive: true,
  });

  return destinationRoot;
}

function shouldCopyProfileEntry(sourceRoot: string, sourcePath: string): boolean {
  const relativePath = path.relative(sourceRoot, sourcePath);

  if (!relativePath || relativePath === ".") {
    return true;
  }

  const parts = relativePath.split(path.sep);
  return !parts.some((part) => PROFILE_COPY_SKIP_SEGMENTS.has(part));
}

async function openWorkingPage(
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>
): Promise<Page> {
  return context.newPage();
}

async function waitForBrowserState(page: Page, waitMs: number): Promise<BrowserStateSnapshot> {
  const deadline = Date.now() + waitMs;
  let latestSnapshot: BrowserStateSnapshot | null = null;

  while (Date.now() < deadline) {
    latestSnapshot = await readBrowserState(page);
    if (latestSnapshot.answer) {
      return latestSnapshot;
    }

    await page.waitForTimeout(500);
  }

  const detail =
    latestSnapshot?.pageTextPreview?.trim() ||
    latestSnapshot?.pageTitle?.trim() ||
    "page did not expose any answer-bearing state";

  throw new Error(`Timed out waiting for Letroso page state. Last snapshot: ${detail}`);
}

async function readBrowserState(page: Page): Promise<BrowserStateSnapshot> {
  return page.evaluate(() => {
    type LocalBrowserStateHit = {
      answer: string;
      gameId: string | null;
      gameTitle: string | null;
      language: string | null;
      mode: string | null;
      path: string;
    };

    const hits: LocalBrowserStateHit[] = [];
    const root = document.getElementById("root");
    const seeds = [root, window].filter(Boolean);
    const seen = new WeakSet<object>();
    const queue: Array<{
      depth: number;
      path: string;
      value: unknown;
    }> = seeds.map((value) => ({
      depth: 0,
      path: value === root ? "root" : "window",
      value,
    }));

    while (queue.length > 0 && hits.length < 50) {
      const item = queue.shift();
      if (!item) {
        break;
      }

      const { value, path, depth } = item;
      if (!value || (typeof value !== "object" && typeof value !== "function")) {
        continue;
      }

      if (seen.has(value as object)) {
        continue;
      }

      seen.add(value as object);

      try {
        const candidate = value as {
          answer?: unknown;
          id?: unknown;
          language?: unknown;
          mode?: unknown;
          props?: {
            id?: unknown;
            language?: unknown;
            mode?: unknown;
            spec?: {
              answer?: unknown;
            };
            title?: unknown;
          };
          spec?: {
            answer?: unknown;
          };
          title?: unknown;
        };

        if (candidate.spec && typeof candidate.spec.answer === "string") {
          hits.push({
            answer: candidate.spec.answer,
            gameId: candidate.id == null ? null : String(candidate.id),
            gameTitle: candidate.title == null ? null : String(candidate.title),
            language: candidate.language == null ? null : String(candidate.language),
            mode: candidate.mode == null ? null : String(candidate.mode),
            path,
          });
        }

        if (candidate.props?.spec && typeof candidate.props.spec.answer === "string") {
          hits.push({
            answer: candidate.props.spec.answer,
            gameId: candidate.props.id == null ? null : String(candidate.props.id),
            gameTitle: candidate.props.title == null ? null : String(candidate.props.title),
            language: candidate.props.language == null ? null : String(candidate.props.language),
            mode: candidate.props.mode == null ? null : String(candidate.props.mode),
            path,
          });
        }
      } catch {
        // Keep scanning despite opaque React nodes or accessors.
      }

      if (depth >= 12) {
        continue;
      }

      let entries: Array<[string, unknown]> = [];
      try {
        entries = Object.entries(value).slice(0, 120);
      } catch {
        entries = [];
      }

      for (const [key, child] of entries) {
        if (!child || (typeof child !== "object" && typeof child !== "function")) {
          continue;
        }

        queue.push({
          depth: depth + 1,
          path: `${path}.${key}`,
          value: child,
        });
      }
    }

    return {
      answer: hits[0]?.answer ?? null,
      hits,
      locationHref: location.href,
      pageTextPreview: document.body.innerText.slice(0, 1200),
      pageTitle: document.title,
      timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  });
}

function normalizeLanguage(value: string | undefined): string {
  return value?.trim() || DEFAULT_LANGUAGE;
}

function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function resolveAnswerDate(
  gameTitle: string | null,
  timezoneId: string
): {
  answerDate: string;
  answerDateSource: LetrosoAnswerDateSource;
} {
  if (gameTitle && /^\d{4}-\d{2}-\d{2}$/.test(gameTitle)) {
    return {
      answerDate: gameTitle,
      answerDateSource: "chrome:state-title",
    };
  }

  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezoneId || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return {
    answerDate: `${year}-${month}-${day}`,
    answerDateSource: "fetched-at",
  };
}
