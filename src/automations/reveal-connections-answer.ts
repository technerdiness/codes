import "dotenv/config";

import { revealConnectionsAnswer } from "../providers/nyt-connections.ts";
import type { ConnectionsAnswerResult, ConnectionsCategoryColor } from "../types/connections.ts";

const CONNECTIONS_COLOR_LABELS: Record<ConnectionsCategoryColor, string> = {
  yellow: "YELLOW",
  green: "GREEN",
  blue: "BLUE",
  purple: "PURPLE",
};

function printUsage(): void {
  console.error(
    "Usage: npm run reveal:connections -- [--date 2026-03-15] [--timezone Asia/Kolkata] [--json]"
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
  const timezoneId = readFlagValue(args, "--timezone") ?? process.env.CONNECTIONS_TIMEZONE;
  const result = await revealConnectionsAnswer({
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
