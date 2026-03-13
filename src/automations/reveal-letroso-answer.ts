import "dotenv/config";

import { saveLetrosoAnswerToSupabase } from "../integrations/supabase/letroso-storage.ts";
import { updateWordPressLetrosoAnswerSection } from "../integrations/wordpress.ts";
import {
  DEFAULT_LETROSO_URL,
  revealLetrosoAnswer,
} from "../providers/beebom-letroso.ts";

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
    "Usage: npm run reveal:letroso -- [beebom-letroso-url] [--no-save] [--no-wordpress] [--word-only] [--json]"
  );
  console.error(
    "       npm run reveal:letroso:supabase -- [beebom-letroso-url] [--dry-run] [--no-wordpress] [--word-only] [--json]"
  );
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
  const unknownFlags = args.filter(
    (value) =>
      value.startsWith("-") &&
      ![
        "--save",
        "--no-save",
        "--no-wordpress",
        "--dry-run",
        "--help",
        "-h",
        "--word-only",
        "--json",
      ].includes(value)
  );
  const url = args.find((value) => !value.startsWith("-")) ?? DEFAULT_LETROSO_URL;

  if (shouldShowHelp) {
    printUsage();
    process.exitCode = 0;
    return;
  }

  if (unknownFlags.length) {
    console.error(`Unsupported option(s): ${unknownFlags.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  if (!isValidUrl(url)) {
    console.error(`Invalid URL: ${url}`);
    process.exitCode = 1;
    return;
  }

  if (!shouldShowJson && !shouldShowWordOnly) {
    logInfo(`Letroso sync start: mode=${isDryRun ? "dry-run" : "write"}`);
    logInfo(`Source: ${url}`);
  }

  const result = await revealLetrosoAnswer(url);
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
      const wordpressResult = await updateWordPressLetrosoAnswerSection(result);
      summary.wordpress = {
        status: "updated",
        articleUrl: wordpressResult.articleUrl,
        wordpressPostId: wordpressResult.wordpressPostId,
      };

      if (!shouldShowJson && !shouldShowWordOnly) {
        logInfo(`WordPress updated: post ${wordpressResult.wordpressPostId}`);
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
    `Letroso sync complete: answer=${summary.answer}, date=${summary.answerDate}, supabase=${summary.supabase.status}, wordpress=${summary.wordpress.status}`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
