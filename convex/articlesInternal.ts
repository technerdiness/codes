import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const getArticle = internalQuery({
  args: { id: v.id("articles") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const listArticlesForSync = internalQuery({
  args: { gameName: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let articles = await ctx.db.query("articles").collect();
    articles = articles.filter((a) => a.sourceBeebomUrl);
    if (args.gameName) {
      articles = articles.filter((a) => a.gameName === args.gameName);
    }
    articles.sort((a, b) => a.gameName.localeCompare(b.gameName));
    if (args.limit) {
      articles = articles.slice(0, args.limit);
    }

    // Load site states for each article
    const result = [];
    for (const article of articles) {
      const tnState = await ctx.db.query("technerdinessWordpressState")
        .withIndex("by_article_id", (q) => q.eq("articleId", article._id))
        .first();
      const gwState = await ctx.db.query("gamingwizeWordpressState")
        .withIndex("by_article_id", (q) => q.eq("articleId", article._id))
        .first();
      result.push({
        articleId: article._id,
        gameName: article.gameName,
        sourceBeebomUrl: article.sourceBeebomUrl!,
        lastScrapedAt: article.lastScrapedAt ?? null,
        siteStates: {
          technerdiness: {
            siteKey: "technerdiness" as const,
            articleUrl: article.technerdinessArticleUrl ?? null,
            wordpressPostId: tnState?.wordpressPostId ?? null,
            wordpressPostType: tnState?.wordpressPostType ?? null,
            lastWordpressCodesHash: tnState?.lastWordpressCodesHash ?? null,
            lastWordpressSyncAt: tnState?.lastWordpressSyncAt ?? null,
            lastWordpressSyncError: tnState?.lastWordpressSyncError ?? null,
          },
          gamingwize: {
            siteKey: "gamingwize" as const,
            articleUrl: article.gamingwizeArticleUrl ?? null,
            wordpressPostId: gwState?.wordpressPostId ?? null,
            wordpressPostType: gwState?.wordpressPostType ?? null,
            lastWordpressCodesHash: gwState?.lastWordpressCodesHash ?? null,
            lastWordpressSyncAt: gwState?.lastWordpressSyncAt ?? null,
            lastWordpressSyncError: gwState?.lastWordpressSyncError ?? null,
          },
        },
      });
    }
    return result;
  },
});
