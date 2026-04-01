import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

export const insert = internalMutation({
  args: {
    sourceUrls: v.array(v.string()),
    articleType: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("normalArticles", {
      sourceUrls: args.sourceUrls,
      articleType: args.articleType,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  },
});

export const markWriting = internalMutation({
  args: { id: v.id("normalArticles") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "writing" });
  },
});

export const markCompleted = internalMutation({
  args: {
    id: v.id("normalArticles"),
    articleTitle: v.string(),
    articleHtml: v.string(),
    metaDescription: v.string(),
    wordpressPostId: v.number(),
    wordpressUrl: v.string(),
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
  args: { id: v.id("normalArticles"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "failed", error: args.error });
  },
});

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("normalArticles")
      .order("desc")
      .take(30);
  },
});
