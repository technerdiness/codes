"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { TwitterApi } from "twitter-api-v2";

const MAX_TWEET_LENGTH = 280;
const TWITTER_URL_LENGTH = 23;

function formatNewsTweet(excerpt: string, url: string): string {
  const urlCharCost = 2 + TWITTER_URL_LENGTH; // \n\n + url
  const maxLength = MAX_TWEET_LENGTH - urlCharCost;
  const truncated =
    excerpt.length <= maxLength ? excerpt : excerpt.slice(0, maxLength - 1) + "…";
  return truncated + `\n\n${url}`;
}

export const tweetNewsArticle = internalAction({
  args: { title: v.string(), excerpt: v.string(), url: v.string() },
  handler: async (_ctx, args) => {
    const tweet = formatNewsTweet(args.excerpt || args.title, args.url);
    console.log(`Posting news tweet:\n${tweet}`);

    const client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    });

    await client.v2.tweet(tweet);
    console.log(`News tweet posted: "${args.title}"`);
  },
});
