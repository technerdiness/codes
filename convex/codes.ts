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

// syncCodesForArticle: Called by sync actions after scraping both sources.
// Merges incoming codes with existing DB codes:
// - New codes not in DB → insert
// - Codes in DB still in sources → update lastSeenAt (don't touch otherwise)
// - Codes in DB removed from all sources → delete
// - Expired codes: update status to expired
export const syncCodesForArticle = internalMutation({
  args: {
    articleId: v.id("articles"),
    gameName: v.string(),
    activeCodes: v.array(v.object({
      code: v.string(),
      provider: v.string(),
      rewardsText: v.optional(v.string()),
      isNew: v.boolean(),
    })),
    expiredCodes: v.array(v.object({
      code: v.string(),
      provider: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    // Build lookup maps from incoming data
    const activeMap = new Map<string, typeof args.activeCodes[number]>();
    for (const c of args.activeCodes) {
      activeMap.set(c.code, c);
    }
    const expiredSet = new Set(args.expiredCodes.map((c) => c.code));

    // All code strings from sources
    const allSourceCodes = new Set([...activeMap.keys(), ...expiredSet]);

    // Load existing DB codes for this article
    const existingCodes = await ctx.db.query("codes")
      .withIndex("by_article_id", (q) => q.eq("articleId", args.articleId))
      .collect();

    const existingMap = new Map(existingCodes.map((c) => [c.code, c]));

    let inserted = 0;
    let updated = 0;
    let removed = 0;

    // 1. Insert or update codes from sources
    for (const [code, incoming] of activeMap) {
      const existing = existingMap.get(code);
      if (existing) {
        // Code exists in DB — only update lastSeenAt and isNew flag if newly detected
        const patch: any = { lastSeenAt: now };
        if (existing.status !== "active") {
          patch.status = "active";
        }
        if (incoming.isNew && !existing.isNew) {
          patch.isNew = true;
        }
        // Fill in rewards text if we didn't have it before
        if (incoming.rewardsText && !existing.rewardsText) {
          patch.rewardsText = incoming.rewardsText;
        }
        await ctx.db.patch(existing._id, patch);
        updated++;
      } else {
        // New code — insert
        await ctx.db.insert("codes", {
          articleId: args.articleId,
          gameName: args.gameName,
          provider: incoming.provider,
          code,
          status: "active",
          rewardsText: incoming.rewardsText,
          isNew: incoming.isNew,
          firstSeenAt: now,
          lastSeenAt: now,
        });
        inserted++;
      }
    }

    // 2. Handle expired codes from sources
    for (const code of expiredSet) {
      if (activeMap.has(code)) continue; // active takes precedence
      const existing = existingMap.get(code);
      if (existing) {
        if (existing.status !== "expired") {
          await ctx.db.patch(existing._id, { status: "expired", lastSeenAt: now });
          updated++;
        }
      } else {
        // Expired code not in DB — insert as expired
        const provider = args.expiredCodes.find((c) => c.code === code)?.provider ?? "beebom";
        await ctx.db.insert("codes", {
          articleId: args.articleId,
          gameName: args.gameName,
          provider,
          code,
          status: "expired",
          rewardsText: undefined,
          isNew: false,
          firstSeenAt: now,
          lastSeenAt: now,
        });
        inserted++;
      }
    }

    // 3. Remove codes that are no longer in any source
    for (const existing of existingCodes) {
      if (!allSourceCodes.has(existing.code)) {
        await ctx.db.delete(existing._id);
        removed++;
      }
    }

    return { inserted, updated, removed };
  },
});
