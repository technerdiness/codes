"use node";

import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { TwitterApi } from "twitter-api-v2";

// Twitter always counts URLs as 23 characters (t.co shortening)
const TWITTER_URL_LENGTH = 23;
const MAX_TWEET_LENGTH = 280;

/**
 * Formats a tweet for a game's active codes.
 *
 * Structure:
 *   New codes for {Game Name}
 *
 *   CODE1
 *   CODE2
 *   ...
 *   +N more codes   (if truncated)
 *
 *   {gamingwize url}
 *
 * The URL is counted as TWITTER_URL_LENGTH chars regardless of actual length.
 * Codes are included in order; if they don't all fit, the last line becomes "+N more codes".
 */
function formatTweet(
  gameName: string,
  codes: { code: string }[],
  gameUrl: string | null
): string {
  const header = `New codes for ${gameName}`;
  // \n\n + url, but url always counts as 23 chars on Twitter
  const urlSuffixChars = gameUrl ? 2 + TWITTER_URL_LENGTH : 0;
  const urlSuffix = gameUrl ? `\n\n${gameUrl}` : "";

  // Budget available for the codes section (between header \n\n and \n\n url)
  const budget = MAX_TWEET_LENGTH - header.length - 2 - urlSuffixChars;

  const allLines = codes.map((c) => c.code);

  function joinedLength(lines: string[]): number {
    return lines.join("\n").length;
  }

  // Try fitting all codes
  if (joinedLength(allLines) <= budget) {
    return header + "\n\n" + allLines.join("\n") + urlSuffix;
  }

  // Find max N codes that fit alongside "+M more codes"
  for (let n = allLines.length - 1; n >= 0; n--) {
    const remaining = allLines.length - n;
    const moreLine = `+${remaining} more codes`;
    const lines = n > 0 ? [...allLines.slice(0, n), moreLine] : [moreLine];
    if (joinedLength(lines) <= budget) {
      return header + "\n\n" + lines.join("\n") + urlSuffix;
    }
  }

  // Last resort: just header + url (shouldn't happen in practice)
  return header + urlSuffix;
}

async function handlePostCodesToX(ctx: any) {
  // 1. Find the game with the oldest unposted active code
  const gameInfo = await ctx.runQuery(internal.twitterCodes.findUnpostedGame, {});
  if (!gameInfo) {
    console.log("No unposted active codes found — nothing to post.");
    return null;
  }

  // 2. Get all active codes for that game + the gamingwize article URL
  const { codes, gameUrl } = (await ctx.runQuery(
    internal.twitterCodes.getGameDataForTweet,
    { gameName: gameInfo.gameName, articleId: gameInfo.articleId }
  )) as { codes: { _id: Id<"codes">; code: string; rewardsText?: string }[]; gameUrl: string | null };

  if (codes.length === 0) {
    console.log(`No active codes for ${gameInfo.gameName} — skipping.`);
    return null;
  }

  // 3. Format the tweet
  const tweet = formatTweet(gameInfo.gameName, codes, gameUrl);
  console.log(
    `Posting tweet for ${gameInfo.gameName} (${codes.length} active codes):\n${tweet}`
  );

  // 4. Post to Twitter via API v2
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error(
      "Twitter API credentials missing. Set TWITTER_API_KEY, TWITTER_API_SECRET, " +
        "TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_SECRET in Convex environment variables."
    );
  }

  const client = new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken,
    accessSecret,
  });

  await client.v2.tweet(tweet);
  console.log(`Tweet posted for ${gameInfo.gameName}.`);

  // 5. Mark all active codes for this game as posted on X
  await ctx.runMutation(internal.twitterCodes.markCodesAsPosted, {
    codeIds: codes.map((c) => c._id),
  });

  return { gameName: gameInfo.gameName, codesPosted: codes.length };
}

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    return await handlePostCodesToX(ctx);
  },
});

// Public action for manual triggering from the admin panel.
export const postNextGame = action({
  args: {},
  handler: async (ctx) => {
    return await handlePostCodesToX(ctx);
  },
});
