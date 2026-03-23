import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// listArticles: Returns all articles joined with their WordPress state from both site tables.

export const listArticles = query({
  args: {},
  handler: async (ctx) => {
    const articles = await ctx.db.query("articles").order("asc").collect();
    const result = [];
    for (const article of articles) {
      const tnState = await ctx.db.query("technerdinessWordpressState")
        .withIndex("by_article_id", (q) => q.eq("articleId", article._id))
        .first();
      const gwState = await ctx.db.query("gamingwizeWordpressState")
        .withIndex("by_article_id", (q) => q.eq("articleId", article._id))
        .first();
      result.push({
        ...article,
        siteStates: {
          technerdiness: tnState ? {
            wordpressPostId: tnState.wordpressPostId ?? null,
            wordpressPostType: tnState.wordpressPostType ?? null,
            wordpressLookupStatus: tnState.wordpressLookupStatus,
            wordpressLookupError: tnState.wordpressLookupError ?? null,
            lastWordpressCodesHash: tnState.lastWordpressCodesHash ?? null,
            lastWordpressSyncAt: tnState.lastWordpressSyncAt ?? null,
            lastWordpressSyncError: tnState.lastWordpressSyncError ?? null,
          } : {
            wordpressPostId: null,
            wordpressPostType: null,
            wordpressLookupStatus: "pending",
            wordpressLookupError: null,
            lastWordpressCodesHash: null,
            lastWordpressSyncAt: null,
            lastWordpressSyncError: null,
          },
          gamingwize: gwState ? {
            wordpressPostId: gwState.wordpressPostId ?? null,
            wordpressPostType: gwState.wordpressPostType ?? null,
            wordpressLookupStatus: gwState.wordpressLookupStatus,
            wordpressLookupError: gwState.wordpressLookupError ?? null,
            lastWordpressCodesHash: gwState.lastWordpressCodesHash ?? null,
            lastWordpressSyncAt: gwState.lastWordpressSyncAt ?? null,
            lastWordpressSyncError: gwState.lastWordpressSyncError ?? null,
          } : {
            wordpressPostId: null,
            wordpressPostType: null,
            wordpressLookupStatus: "pending",
            wordpressLookupError: null,
            lastWordpressCodesHash: null,
            lastWordpressSyncAt: null,
            lastWordpressSyncError: null,
          },
        },
      });
    }
    return result;
  },
});

// saveArticle: Create or update an article. Takes optional _id for update.
export const saveArticle = mutation({
  args: {
    id: v.optional(v.id("articles")),
    gameName: v.string(),
    sourceBeebomUrl: v.optional(v.string()),
    sourceTechwiserUrl: v.optional(v.string()),
    technerdinessArticleUrl: v.optional(v.string()),
    gamingwizeArticleUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const newTN = args.technerdinessArticleUrl || undefined;
    const newGW = args.gamingwizeArticleUrl || undefined;
    let articleId;
    let shouldResolve = false;

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      await ctx.db.patch(args.id, {
        gameName: args.gameName,
        ...(args.sourceBeebomUrl !== undefined && { sourceBeebomUrl: args.sourceBeebomUrl || undefined }),
        ...(args.sourceTechwiserUrl !== undefined && { sourceTechwiserUrl: args.sourceTechwiserUrl || undefined }),
        ...(args.technerdinessArticleUrl !== undefined && { technerdinessArticleUrl: newTN }),
        ...(args.gamingwizeArticleUrl !== undefined && { gamingwizeArticleUrl: newGW }),
        updatedAt: now,
      });
      articleId = args.id;
      // Resolve if TN or GW URLs changed
      if (existing) {
        const tnChanged = args.technerdinessArticleUrl !== undefined && (existing.technerdinessArticleUrl || undefined) !== newTN;
        const gwChanged = args.gamingwizeArticleUrl !== undefined && (existing.gamingwizeArticleUrl || undefined) !== newGW;
        shouldResolve = tnChanged || gwChanged;
      }
    } else {
      articleId = await ctx.db.insert("articles", {
        gameName: args.gameName,
        sourceBeebomUrl: args.sourceBeebomUrl || undefined,
        sourceTechwiserUrl: args.sourceTechwiserUrl || undefined,
        technerdinessArticleUrl: newTN,
        gamingwizeArticleUrl: newGW,
        updatedAt: now,
      });
      // Resolve if new article has any WP URLs
      shouldResolve = !!(newTN || newGW);
    }

    if (shouldResolve) {
      await ctx.scheduler.runAfter(0, internal.resolveWordpressPostId.run, {
        articleId,
      });
    }

    return articleId;
  },
});

// getArticle: Get a single article by ID
export const getArticle = query({
  args: { id: v.id("articles") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

// Internal mutations used by actions
export const updateLastScrapedAt = internalMutation({
  args: { articleId: v.id("articles"), lastScrapedAt: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.articleId, {
      lastScrapedAt: args.lastScrapedAt,
      updatedAt: args.lastScrapedAt,
    });
  },
});
