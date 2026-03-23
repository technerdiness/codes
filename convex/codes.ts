import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const listByArticle = query({
  args: { articleId: v.id("articles") },
  handler: async (ctx, args) => {
    return ctx.db.query("codes")
      .withIndex("by_article_id", (q) => q.eq("articleId", args.articleId))
      .collect();
  },
});

// upsertCodes: Called by sync actions after scraping. Handles dedup logic.
export const upsertCodes = internalMutation({
  args: {
    articleId: v.id("articles"),
    gameName: v.string(),
    codes: v.array(v.object({
      code: v.string(),
      status: v.string(),
      provider: v.string(),
      rewardsText: v.optional(v.string()),
      isNew: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    let upsertCount = 0;

    for (const codeEntry of args.codes) {
      const existing = await ctx.db.query("codes")
        .withIndex("by_article_and_code", (q) =>
          q.eq("articleId", args.articleId).eq("code", codeEntry.code)
        )
        .first();

      if (existing) {
        const preferIncoming = codeEntry.status === "active" && existing.status !== "active";
        await ctx.db.patch(existing._id, {
          status: preferIncoming ? codeEntry.status : existing.status,
          rewardsText: (preferIncoming ? codeEntry.rewardsText : existing.rewardsText) ?? codeEntry.rewardsText,
          isNew: existing.isNew || codeEntry.isNew,
          lastSeenAt: now,
        });
      } else {
        await ctx.db.insert("codes", {
          articleId: args.articleId,
          gameName: args.gameName,
          provider: codeEntry.provider,
          code: codeEntry.code,
          status: codeEntry.status,
          rewardsText: codeEntry.rewardsText,
          isNew: codeEntry.isNew,
          firstSeenAt: now,
          lastSeenAt: now,
        });
      }
      upsertCount++;
    }

    return { attemptedUpserts: upsertCount };
  },
});
