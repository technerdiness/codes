import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

type SiteKey = "technerdiness" | "gamingwize";

const TABLE_MAP = {
  technerdiness: "technerdinessWordpressState",
  gamingwize: "gamingwizeWordpressState",
} as const;

// getState: Get WordPress state for an article+site
export const getState = internalQuery({
  args: { articleId: v.id("articles"), siteKey: v.string() },
  handler: async (ctx, args) => {
    const table = TABLE_MAP[args.siteKey as SiteKey];
    return ctx.db.query(table)
      .withIndex("by_article_id", (q) => q.eq("articleId", args.articleId))
      .first();
  },
});

// upsertState: Create or update WordPress state
export const upsertState = internalMutation({
  args: {
    articleId: v.id("articles"),
    siteKey: v.string(),
    patch: v.object({
      wordpressPostId: v.optional(v.number()),
      wordpressPostType: v.optional(v.string()),
      wordpressLookupStatus: v.optional(v.string()),
      wordpressLookupError: v.optional(v.string()),
      wordpressLookupRequestedAt: v.optional(v.string()),
      wordpressLookupCompletedAt: v.optional(v.string()),
      lastWordpressCodesHash: v.optional(v.string()),
      lastWordpressSyncAt: v.optional(v.string()),
      lastWordpressSyncError: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const table = TABLE_MAP[args.siteKey as SiteKey];
    const existing = await ctx.db.query(table)
      .withIndex("by_article_id", (q) => q.eq("articleId", args.articleId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args.patch);
    } else {
      await ctx.db.insert(table, {
        articleId: args.articleId,
        wordpressLookupStatus: "pending",
        ...args.patch,
      });
    }
  },
});

// updateSyncState: Update just the sync-related fields
export const updateSyncState = internalMutation({
  args: {
    articleId: v.id("articles"),
    siteKey: v.string(),
    lastWordpressCodesHash: v.optional(v.string()),
    lastWordpressSyncAt: v.optional(v.string()),
    lastWordpressSyncError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const table = TABLE_MAP[args.siteKey as SiteKey];
    const existing = await ctx.db.query(table)
      .withIndex("by_article_id", (q) => q.eq("articleId", args.articleId))
      .first();

    const patch: Record<string, unknown> = {};
    if ("lastWordpressCodesHash" in args) patch.lastWordpressCodesHash = args.lastWordpressCodesHash;
    if ("lastWordpressSyncAt" in args) patch.lastWordpressSyncAt = args.lastWordpressSyncAt;
    if ("lastWordpressSyncError" in args) patch.lastWordpressSyncError = args.lastWordpressSyncError;

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert(table, {
        articleId: args.articleId,
        wordpressLookupStatus: "pending",
        ...patch,
      });
    }
  },
});
