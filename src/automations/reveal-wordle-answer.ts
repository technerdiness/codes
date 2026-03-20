import "dotenv/config";

import { revealWordleAnswer } from "../providers/nyt-wordle.ts";

function printUsage(): void {
  console.error(
    "Usage: npm run reveal:wordle -- [--date 2026-03-15] [--timezone Asia/Kolkata] [--word-only] [--json]"
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldShowHelp = args.includes("--help") || args.includes("-h");
  const shouldShowWordOnly = args.includes("--word-only");
  const shouldShowJson = args.includes("--json");
  const allowedFlags = new Set(["--help", "-h", "--word-only", "--json", "--date", "--timezone"]);
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
  const result = await revealWordleAnswer({
    answerDate,
    timezoneId,
  });

  if (shouldShowWordOnly) {
    console.log(result.answer);
    return;
  }

  if (shouldShowJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Wordle #${result.daysSinceLaunch} - ${result.answerDate}`);
  console.log(`Answer: ${result.answer}`);

  if (result.editor) {
    console.log(`Editor: ${result.editor}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
