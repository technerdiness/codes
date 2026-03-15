import "dotenv/config";

import {
  fetchWordleAnswerFromSupabase,
  saveWordleAnswerToSupabase,
} from "../integrations/supabase/wordle-storage.ts";
import { updateWordPressWordleAnswerSection } from "../integrations/wordpress.ts";
import { revealWordleAnswer } from "../providers/nyt-wordle.ts";
import type { WordleAnswerResult } from "../types/wordle.ts";

interface WordleRunSummary {
  sourceUrl: string;
  answerDate: string;
  answer: string;
  extractedFrom: string;
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
    "Usage: npm run reveal:wordle -- [--date 2026-03-15] [--timezone Asia/Kolkata] [--no-save] [--no-wordpress] [--word-only] [--json]"
  );
  console.error(
    "       npm run reveal:wordle:supabase -- [--date 2026-03-15] [--dry-run] [--no-wordpress] [--word-only] [--json]"
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
  const allowedFlags = new Set([
    "--save",
    "--no-save",
    "--no-wordpress",
    "--dry-run",
    "--help",
    "-h",
    "--word-only",
    "--json",
    "--date",
    "--timezone",
  ]);
  const unknownFlags = args.filter((value) => value.startsWith("-") && !allowedFlags.has(value));

  if (shouldShowHelp) {
    printUsage();
    return;
  }

  if (unknownFlags.length) {
    throw new Error(`Unsupported option(s): ${unknownFlags.join(", ")}`);
  }

  const answerDate = readFlagValue(args, "--date");
  const timezoneId = readFlagValue(args, "--timezone") ?? process.env.WORDLE_TIMEZONE;

  if (!shouldShowJson && !shouldShowWordOnly) {
    logInfo(`Wordle sync start: mode=${isDryRun ? "dry-run" : "write"}`);
    if (answerDate) {
      logInfo(`Date override: ${answerDate}`);
    }
    if (timezoneId) {
      logInfo(`Timezone override: ${timezoneId}`);
    }
  }

  const result = await revealWordleAnswer({
    answerDate,
    timezoneId,
  });
  const summary: WordleRunSummary = {
    sourceUrl: result.sourceUrl,
    answerDate: result.answerDate,
    answer: result.answer,
    extractedFrom: result.extractedFrom,
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
        logInfo(`Fetched answer: ${result.answer} for ${result.answerDate}`);
        logInfo("Supabase skipped: --dry-run");
      }
    } else {
      const supabaseResult = await saveWordleAnswerToSupabase(result);
      summary.supabase = {
        status: "saved",
        table: supabaseResult.table,
      };

      if (!shouldShowJson && !shouldShowWordOnly) {
        logInfo(`Fetched answer: ${result.answer} for ${result.answerDate}`);
        logInfo(`Supabase updated: ${supabaseResult.table}`);
      }
    }
  } else if (!shouldShowJson && !shouldShowWordOnly) {
    logInfo(`Fetched answer: ${result.answer} for ${result.answerDate}`);
    logInfo("Supabase skipped: --no-save");
  }

  let previousResult: WordleAnswerResult | null = null;
  if (shouldUpdateWordPress && !isDryRun) {
    try {
      previousResult = await fetchWordleAnswerFromSupabase(getPreviousIsoDate(result.answerDate));
      if (!previousResult && !shouldShowJson && !shouldShowWordOnly) {
        logInfo("Yesterday's Wordle answer not found in Supabase");
      }
    } catch (error) {
      if (!shouldShowJson && !shouldShowWordOnly) {
        const message = error instanceof Error ? error.message : String(error);
        logInfo(`Yesterday's Wordle answer unavailable: ${message}`);
      }
    }
  }

  if (shouldUpdateWordPress) {
    if (isDryRun) {
      if (!shouldShowJson && !shouldShowWordOnly) {
        logInfo("WordPress skipped: --dry-run");
      }
    } else {
      const wordpressResult = await updateWordPressWordleAnswerSection({
        result,
        previousResult,
      });
      if (wordpressResult.updated) {
        summary.wordpress = {
          status: "updated",
          articleUrl: wordpressResult.articleUrl,
          wordpressPostId: wordpressResult.wordpressPostId,
        };

        if (!shouldShowJson && !shouldShowWordOnly) {
          logInfo(`WordPress updated: post ${wordpressResult.wordpressPostId}`);
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
          summary,
        },
        null,
        2
      )
    );
    return;
  }

  logInfo(
    `Wordle sync complete: answer=${summary.answer}, date=${summary.answerDate}, supabase=${summary.supabase.status}, wordpress=${summary.wordpress.status}`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

function getPreviousIsoDate(answerDate: string): string {
  const date = new Date(`${answerDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid answer date: ${answerDate}. Expected YYYY-MM-DD.`);
  }

  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
