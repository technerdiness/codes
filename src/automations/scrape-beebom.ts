import "dotenv/config";

import { scrapeBeebomPage } from "../providers/beebom.ts";

function printUsage(): void {
  console.error("Usage: npm run scrape -- <beebom-article-url>");
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldShowHelp = args.includes("--help") || args.includes("-h");
  const unknownFlags = args.filter(
    (value) => value.startsWith("-") && !["--help", "-h"].includes(value)
  );
  const url = readPositionalUrl(args);

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

  if (!url) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!isValidUrl(url)) {
    console.error(`Invalid URL: ${url}`);
    process.exitCode = 1;
    return;
  }

  const result = await scrapeBeebomPage(url);
  console.log(
    JSON.stringify(
      {
        sourceUrl: url,
        ...result,
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

function readPositionalUrl(args: string[]): string | undefined {
  return args.find((value) => !value.startsWith("-"));
}
