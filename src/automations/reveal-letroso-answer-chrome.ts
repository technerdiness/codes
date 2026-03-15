import "dotenv/config";

import {
  fetchLetrosoAnswerHistoryFromSupabase,
  saveLetrosoAnswerToSupabase,
} from "../integrations/supabase/letroso-storage.ts";
import { updateWordPressLetrosoAnswerSection } from "../integrations/wordpress.ts";
import {
  buildLetrosoDailyUrl,
  getDefaultChromeExecutablePath,
  getDefaultChromeUserDataDir,
  revealLetrosoAnswerFromChrome,
} from "../providers/chrome-letroso.ts";

interface LetrosoRunSummary {
  sourceUrl: string;
  answerDate: string;
  answer: string;
  extractedFrom: string;
  meaning: string | null;
  supabase:
    | {
        status: "saved";
        table: string;
      }
    | {
        status: "skipped";
        reason: string;
      };
  wordpress:
    | {
        status: "updated";
        articleUrl: string;
        wordpressPostId: number;
      }
    | {
        status: "skipped";
        reason: string;
      };
}

function printUsage(): void {
  console.error(
    "Usage: npm run reveal:letroso:chrome -- [--timezone Asia/Tokyo] [--language en] [--no-save] [--no-wordpress] [--word-only] [--json]"
  );
  console.error(
    "       npm run reveal:letroso:chrome -- --dry-run --chrome-user-data-dir \"$HOME/Library/Application Support/Google/Chrome\" --chrome-profile Default"
  );
  console.error(
    "       npm run reveal:letroso:chrome -- --chrome-path \"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome\" --headful"
  );
}

function readFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    return undefined;
  }

  return value;
}

function parsePositiveInteger(value: string | undefined, flag: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return parsed;
}

function logInfo(message: string): void {
  console.log(message);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldSave = !args.includes("--no-save");
  const shouldUpdateWordPress = !args.includes("--no-wordpress");
  const isDryRun = args.includes("--dry-run");
  const shouldShowHelp = args.includes("--help") || args.includes("-h");
  const shouldShowWordOnly = args.includes("--word-only");
  const shouldShowJson = args.includes("--json");
  const isHeadful = args.includes("--headful");
  const shouldKeepProfileCopy = args.includes("--keep-profile-copy");
  const allowedFlags = new Set([
    "--help",
    "-h",
    "--no-save",
    "--no-wordpress",
    "--dry-run",
    "--word-only",
    "--json",
    "--headful",
    "--keep-profile-copy",
    "--chrome-path",
    "--chrome-user-data-dir",
    "--chrome-profile",
    "--language",
    "--locale",
    "--timezone",
    "--url",
    "--wait-ms",
  ]);
  const unknownFlags = args.filter((value) => value.startsWith("-") && !allowedFlags.has(value));

  if (shouldShowHelp) {
    printUsage();
    return;
  }

  if (unknownFlags.length) {
    throw new Error(`Unsupported option(s): ${unknownFlags.join(", ")}`);
  }

  const language = readFlagValue(args, "--language") ?? process.env.LETROSO_CHROME_LANGUAGE ?? "en";
  const chromePath =
    readFlagValue(args, "--chrome-path") ??
    process.env.LETROSO_CHROME_EXECUTABLE_PATH ??
    getDefaultChromeExecutablePath();
  const chromeUserDataDir =
    readFlagValue(args, "--chrome-user-data-dir") ??
    process.env.LETROSO_CHROME_USER_DATA_DIR ??
    getDefaultChromeUserDataDir();
  const chromeProfile =
    readFlagValue(args, "--chrome-profile") ??
    process.env.LETROSO_CHROME_PROFILE ??
    "Default";
  const locale = readFlagValue(args, "--locale") ?? process.env.LETROSO_CHROME_LOCALE;
  const timezoneId = readFlagValue(args, "--timezone") ?? process.env.LETROSO_CHROME_TIMEZONE;
  const pageUrl =
    readFlagValue(args, "--url") ??
    process.env.LETROSO_CHROME_URL ??
    buildLetrosoDailyUrl(language);
  const waitMs = parsePositiveInteger(
    readFlagValue(args, "--wait-ms") ?? process.env.LETROSO_CHROME_WAIT_MS,
    "--wait-ms"
  );

  if (!shouldShowJson && !shouldShowWordOnly) {
    logInfo(`Letroso Chrome sync start: mode=${isDryRun ? "dry-run" : "write"}`);
    logInfo(`Source: ${pageUrl}`);
    logInfo(`Language: ${language}`);
    logInfo(`Chrome: ${chromePath}`);
    logInfo(`Profile: ${chromeUserDataDir} (${chromeProfile})`);

    if (timezoneId) {
      logInfo(`Timezone override: ${timezoneId}`);
    }
  }

  const revealResult = await revealLetrosoAnswerFromChrome({
    chromeExecutablePath: chromePath,
    chromeProfile,
    chromeUserDataDir,
    headless: !isHeadful,
    keepProfileCopy: shouldKeepProfileCopy,
    language,
    locale,
    pageUrl,
    timezoneId,
    waitMs,
  });
  const { result } = revealResult;

  const summary: LetrosoRunSummary = {
    sourceUrl: result.sourceUrl,
    answerDate: result.answerDate,
    answer: result.answer,
    extractedFrom: result.extractedFrom,
    meaning: result.meaning,
    supabase: shouldSave
      ? isDryRun
        ? {
            status: "skipped",
            reason: "--dry-run",
          }
        : {
            status: "saved",
            table: "",
          }
      : {
          status: "skipped",
          reason: "--no-save",
        },
    wordpress: shouldUpdateWordPress
      ? isDryRun
        ? {
            status: "skipped",
            reason: "--dry-run",
          }
        : {
            status: "updated",
            articleUrl: "",
            wordpressPostId: 0,
          }
      : {
          status: "skipped",
          reason: "--no-wordpress",
        },
  };

  if (shouldSave) {
    if (isDryRun) {
      if (!shouldShowJson && !shouldShowWordOnly) {
        logInfo(`Scraped answer: ${result.answer} for ${result.answerDate}`);
        logInfo("Supabase skipped: --dry-run");
      }
    } else {
      const supabaseResult = await saveLetrosoAnswerToSupabase(result);
      summary.supabase = {
        status: "saved",
        table: supabaseResult.table,
      };

      if (!shouldShowJson && !shouldShowWordOnly) {
        logInfo(`Scraped answer: ${result.answer} for ${result.answerDate}`);
        logInfo(`Supabase updated: ${supabaseResult.table}`);
      }
    }
  } else if (!shouldShowJson && !shouldShowWordOnly) {
    logInfo(`Scraped answer: ${result.answer} for ${result.answerDate}`);
    logInfo("Supabase skipped: --no-save");
  }

  if (shouldUpdateWordPress) {
    if (isDryRun) {
      if (!shouldShowJson && !shouldShowWordOnly) {
        logInfo("WordPress skipped: --dry-run");
      }
    } else {
      const history = (await fetchLetrosoAnswerHistoryFromSupabase()).filter(
        (entry) => entry.answerDate !== result.answerDate
      );
      const wordpressResult = await updateWordPressLetrosoAnswerSection({
        result,
        history,
      });
      if (wordpressResult.updated) {
        summary.wordpress = {
          status: "updated",
          articleUrl: wordpressResult.articleUrl,
          wordpressPostId: wordpressResult.wordpressPostId,
        };

        if (!shouldShowJson && !shouldShowWordOnly) {
          logInfo(
            `WordPress updated: post ${wordpressResult.wordpressPostId} (${history.length} history rows)`
          );
        }
      } else {
        const reason =
          wordpressResult.reason === "answer_unchanged" ? "answer unchanged" : "no change";
        summary.wordpress = {
          status: "skipped",
          reason,
        };

        if (!shouldShowJson && !shouldShowWordOnly) {
          logInfo(`WordPress skipped: ${reason}`);
        }
      }
    }
  } else if (!shouldShowJson && !shouldShowWordOnly) {
    logInfo("WordPress skipped: --no-wordpress");
  }

  if (shouldShowWordOnly) {
    console.log(result.answer);
    return;
  }

  if (shouldShowJson) {
    console.log(
      JSON.stringify(
        {
          ...result,
          chrome: {
            executablePath: revealResult.chromeExecutablePath,
            gameId: revealResult.gameId,
            language: revealResult.language,
            pageTextPreview: revealResult.pageTextPreview,
            profile: revealResult.chromeProfile,
            profileCopyDir: revealResult.profileCopyDir,
            userDataDir: revealResult.chromeUserDataDir,
            timezoneId: revealResult.timezoneId,
          },
          summary,
        },
        null,
        2
      )
    );
    return;
  }

  logInfo(
    `Letroso Chrome sync complete: answer=${summary.answer}, date=${summary.answerDate}, supabase=${summary.supabase.status}, wordpress=${summary.wordpress.status}`
  );

  if (revealResult.profileCopyDir) {
    logInfo(`Profile copy kept at: ${revealResult.profileCopyDir}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
