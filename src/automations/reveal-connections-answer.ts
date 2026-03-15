import "dotenv/config";

import { saveConnectionsAnswerToSupabase } from "../integrations/supabase/connections-storage.ts";
import { updateWordPressConnectionsAnswerSection } from "../integrations/wordpress.ts";
import { revealConnectionsAnswer } from "../providers/nyt-connections.ts";
import type { ConnectionsAnswerResult, ConnectionsCategoryColor } from "../types/connections.ts";

const CONNECTIONS_COLOR_LABELS: Record<ConnectionsCategoryColor, string> = {
  yellow: "YELLOW",
  green: "GREEN",
  blue: "BLUE",
  purple: "PURPLE",
};

interface ConnectionsRunSummary {
  sourceUrl: string;
  answerDate: string;
  puzzleId: number;
  extractedFrom: string;
  categoryCount: number;
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
    "Usage: npm run reveal:connections -- [--date 2026-03-15] [--timezone Asia/Kolkata] [--no-save] [--no-wordpress] [--dry-run] [--json]"
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

function printTextResult(result: ConnectionsAnswerResult): void {
  console.log(`Connections #${result.puzzleId} - ${result.answerDate}`);

  if (result.editor) {
    console.log(`Editor: ${result.editor}`);
  }

  console.log("-------------------");

  result.categories.forEach((category, index) => {
    if (index > 0) {
      console.log("");
    }

    console.log(`${CONNECTIONS_COLOR_LABELS[category.color]}: ${category.title}`);
    console.log(`Words: ${category.cards.map((card) => card.content).join(", ")}`);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldSave = !args.includes("--no-save");
  const shouldUpdateWordPress = !args.includes("--no-wordpress");
  const isDryRun = args.includes("--dry-run");
  const shouldShowHelp = args.includes("--help") || args.includes("-h");
  const shouldShowJson = args.includes("--json");
  const allowedFlags = new Set([
    "--save",
    "--no-save",
    "--no-wordpress",
    "--dry-run",
    "--help",
    "-h",
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
  const timezoneId = readFlagValue(args, "--timezone") ?? process.env.CONNECTIONS_TIMEZONE;

  if (!shouldShowJson) {
    logInfo(`Connections sync start: mode=${isDryRun ? "dry-run" : "write"}`);
    if (answerDate) {
      logInfo(`Date override: ${answerDate}`);
    }
    if (timezoneId) {
      logInfo(`Timezone override: ${timezoneId}`);
    }
  }

  const result = await revealConnectionsAnswer({
    answerDate,
    timezoneId,
  });
  const summary: ConnectionsRunSummary = {
    sourceUrl: result.sourceUrl,
    answerDate: result.answerDate,
    puzzleId: result.puzzleId,
    extractedFrom: result.extractedFrom,
    categoryCount: result.categories.length,
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
      if (!shouldShowJson) {
        logInfo(`Fetched puzzle: #${result.puzzleId} for ${result.answerDate}`);
        logInfo("Supabase skipped: --dry-run");
      }
    } else {
      const supabaseResult = await saveConnectionsAnswerToSupabase(result);
      summary.supabase = {
        status: "saved",
        table: supabaseResult.table,
      };

      if (!shouldShowJson) {
        logInfo(`Fetched puzzle: #${result.puzzleId} for ${result.answerDate}`);
        logInfo(`Supabase updated: ${supabaseResult.table}`);
      }
    }
  } else if (!shouldShowJson) {
    logInfo(`Fetched puzzle: #${result.puzzleId} for ${result.answerDate}`);
    logInfo("Supabase skipped: --no-save");
  }

  if (shouldUpdateWordPress) {
    if (isDryRun) {
      if (!shouldShowJson) {
        logInfo("WordPress skipped: --dry-run");
      }
    } else {
      const wordpressResult = await updateWordPressConnectionsAnswerSection({
        result,
      });
      if (wordpressResult.updated) {
        summary.wordpress = {
          status: "updated",
          articleUrl: wordpressResult.articleUrl,
          wordpressPostId: wordpressResult.wordpressPostId,
        };

        if (!shouldShowJson) {
          logInfo(`WordPress updated: post ${wordpressResult.wordpressPostId}`);
        }
      } else {
        const reason =
          wordpressResult.reason === "answer_unchanged" ? "answer unchanged" : "no change";
        summary.wordpress = {
          status: "skipped",
          reason,
        };

        if (!shouldShowJson) {
          logInfo(`WordPress skipped: ${reason}`);
        }
      }
    }
  } else if (!shouldShowJson) {
    logInfo("WordPress skipped: --no-wordpress");
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

  printTextResult(result);
  logInfo(
    `Connections sync complete: puzzle=${summary.puzzleId}, date=${summary.answerDate}, supabase=${summary.supabase.status}, wordpress=${summary.wordpress.status}`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
