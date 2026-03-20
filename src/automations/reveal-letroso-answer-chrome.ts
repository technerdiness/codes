import "dotenv/config";

import {
  buildLetrosoDailyUrl,
  getDefaultChromeExecutablePath,
  getDefaultChromeUserDataDir,
  revealLetrosoAnswerFromChrome,
} from "../providers/chrome-letroso.ts";

function printUsage(): void {
  console.error(
    "Usage: npm run reveal:letroso:chrome -- [--timezone Asia/Tokyo] [--language en] [--word-only] [--json]"
  );
  console.error(
    '       npm run reveal:letroso:chrome -- --chrome-user-data-dir "$HOME/Library/Application Support/Google/Chrome" --chrome-profile Default'
  );
  console.error(
    '       npm run reveal:letroso:chrome -- --chrome-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headful'
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
  const shouldShowHelp = args.includes("--help") || args.includes("-h");
  const shouldShowWordOnly = args.includes("--word-only");
  const shouldShowJson = args.includes("--json");
  const isHeadful = args.includes("--headful");
  const shouldKeepProfileCopy = args.includes("--keep-profile-copy");
  const allowedFlags = new Set([
    "--help",
    "-h",
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
    readFlagValue(args, "--chrome-profile") ?? process.env.LETROSO_CHROME_PROFILE ?? "Default";
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
        },
        null,
        2
      )
    );
    return;
  }

  logInfo(`Letroso Chrome answer: ${result.answer}`);
  logInfo(`Answer date: ${result.answerDate}`);
  logInfo(`Game ID: ${revealResult.gameId}`);
  logInfo(`Source: ${result.sourceUrl}`);

  if (revealResult.profileCopyDir) {
    logInfo(`Profile copy kept at: ${revealResult.profileCopyDir}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
