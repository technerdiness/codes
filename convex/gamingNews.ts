import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getNextPendingArticle = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("gamingNews")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();
  },
});

export const getAllPendingArticles = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("gamingNews")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const getRecentSlugs = internalQuery({
  args: { sinceDaysAgo: v.number() },
  handler: async (ctx, args) => {
    const cutoff = new Date(
      Date.now() - args.sinceDaysAgo * 24 * 60 * 60 * 1000
    ).toISOString();
    const items = await ctx.db
      .query("gamingNews")
      .withIndex("by_collected_at")
      .order("desc")
      .take(200);
    return items
      .filter((item) => item.collectedAt >= cutoff)
      .map((item) => ({ slug: item.slug, title: item.title }));
  },
});

export const insertNewsItems = internalMutation({
  args: {
    items: v.array(
      v.object({
        title: v.string(),
        slug: v.string(),
        summary: v.string(),
        sourceUrls: v.array(v.string()),
        sourceSnippets: v.array(
          v.object({
            source: v.string(),
            title: v.string(),
            snippet: v.string(),
            fullContent: v.optional(v.string()),
            url: v.string(),
            publishedAt: v.optional(v.string()),
          })
        ),
        collectedAt: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    for (const item of args.items) {
      // Check for duplicate slug
      const existing = await ctx.db
        .query("gamingNews")
        .withIndex("by_slug", (q) => q.eq("slug", item.slug))
        .first();
      if (existing) {
        continue;
      }
      await ctx.db.insert("gamingNews", {
        ...item,
        status: "pending",
      });
      inserted++;
    }
    return { inserted, skipped: args.items.length - inserted };
  },
});

export const markWriting = internalMutation({
  args: { id: v.id("gamingNews") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "writing" });
  },
});

export const markCompleted = internalMutation({
  args: {
    id: v.id("gamingNews"),
    articleTitle: v.string(),
    articleHtml: v.string(),
    metaDescription: v.string(),
    wordpressPostId: v.number(),
    wordpressUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "completed",
      articleTitle: args.articleTitle,
      articleHtml: args.articleHtml,
      metaDescription: args.metaDescription,
      wordpressPostId: args.wordpressPostId,
      wordpressUrl: args.wordpressUrl,
      writtenAt: new Date().toISOString(),
    });
  },
});

export const markFailed = internalMutation({
  args: { id: v.id("gamingNews"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "failed",
      error: args.error,
    });
  },
});
