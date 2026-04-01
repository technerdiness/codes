import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// Find the gameName + articleId of the game with the oldest unposted active code.
// "Unposted" means postedOnX is false or undefined (field didn't exist before this feature).
export const findUnpostedGame = internalQuery({
  args: {},
  handler: async (ctx) => {
    const activeCodes = await ctx.db
      .query("codes")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("asc")
      .take(500);

    const firstUnposted = activeCodes.find((c) => c.postedOnX !== true);
    if (!firstUnposted) return null;
    return { gameName: firstUnposted.gameName, articleId: firstUnposted.articleId };
  },
});

// Get all active codes for a game and the gamingwize article URL.
export const getGameDataForTweet = internalQuery({
  args: { gameName: v.string(), articleId: v.id("articles") },
  handler: async (ctx, args) => {
    const allCodes = await ctx.db
      .query("codes")
      .withIndex("by_game_name", (q) => q.eq("gameName", args.gameName))
      .take(200);

    const activeCodes = allCodes.filter((c) => c.status === "active");
    const article = await ctx.db.get(args.articleId);

    return {
      codes: activeCodes.map((c) => ({ _id: c._id, code: c.code, rewardsText: c.rewardsText })),
      gameUrl: article?.gamingwizeArticleUrl ?? null,
    };
  },
});

// Public query: list all games that have unposted active codes, ordered by oldest first.
// Returns each game once, with the count of unposted codes and whether a GW URL exists.
export const listUnpostedGames = query({
  args: {},
  handler: async (ctx) => {
    const activeCodes = await ctx.db
      .query("codes")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("asc")
      .take(500);

    const unposted = activeCodes.filter((c) => c.postedOnX !== true);

    // Group by gameName, preserving insertion order (oldest-first from the query)
    const gameMap = new Map<string, { gameName: string; articleId: string; unpostedCount: number }>();
    for (const c of unposted) {
      if (!gameMap.has(c.gameName)) {
        gameMap.set(c.gameName, { gameName: c.gameName, articleId: c.articleId, unpostedCount: 0 });
      }
      gameMap.get(c.gameName)!.unpostedCount++;
    }

    // Fetch GW URLs for each game's article
    const result = [];
    for (const entry of gameMap.values()) {
      const article = await ctx.db.get(entry.articleId as any);
      result.push({
        gameName: entry.gameName,
        unpostedCount: entry.unpostedCount,
        hasGamingwizeUrl: !!article?.gamingwizeArticleUrl,
      });
    }

    return result;
  },
});

// Mark a list of codes as posted on X.
export const markCodesAsPosted = internalMutation({
  args: { codeIds: v.array(v.id("codes")) },
  handler: async (ctx, args) => {
    for (const id of args.codeIds) {
      await ctx.db.patch(id, { postedOnX: true });
    }
  },
});
