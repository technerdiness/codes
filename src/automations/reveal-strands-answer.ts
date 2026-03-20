import "dotenv/config";

import { revealStrandsAnswer } from "../providers/nyt-strands.ts";
import type { StrandsAnswerResult } from "../types/strands.ts";

function printUsage(): void {
  console.error(
    "Usage: npm run reveal:strands -- [--date 2026-03-15] [--timezone Asia/Kolkata] [--json]"
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

function printTextResult(result: StrandsAnswerResult): void {
  console.log(`Strands #${result.puzzleId} - ${result.answerDate}`);
  console.log(`Clue: ${result.clue}`);

  if (result.editor) {
    console.log(`Editor: ${result.editor}`);
  }

  if (result.constructors) {
    console.log(`Constructor: ${result.constructors}`);
  }

  console.log("-------------------");
  console.log(`Spangram: ${result.spangram}`);
  console.log("Theme Words:");

  result.themeWords.forEach((word) => {
    console.log(`- ${word}`);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldShowHelp = args.includes("--help") || args.includes("-h");
  const shouldShowJson = args.includes("--json");
  const allowedFlags = new Set(["--help", "-h", "--json", "--date", "--timezone"]);
  const unknownFlags = args.filter((value) => value.startsWith("-") && !allowedFlags.has(value));

  if (shouldShowHelp) {
    printUsage();
    return;
  }

  if (unknownFlags.length) {
    throw new Error(`Unsupported option(s): ${unknownFlags.join(", ")}`);
  }

  const answerDate = readFlagValue(args, "--date");
  const timezoneId = readFlagValue(args, "--timezone") ?? process.env.STRANDS_TIMEZONE;
  const result = await revealStrandsAnswer({
    answerDate,
    timezoneId,
  });

  if (shouldShowJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printTextResult(result);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
