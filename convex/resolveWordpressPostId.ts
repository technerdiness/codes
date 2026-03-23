"use node";

import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";

type WordPressEntityType = "post" | "page";
type SiteKey = "technerdiness" | "gamingwize";
type LookupStatus = "processing" | "resolved" | "not_found" | "error";
type SiteLookupResultStatus = LookupStatus | "skipped";

interface WordPressEntity {
  id: number;
  link: string;
  slug: string;
  type: WordPressEntityType;
}

interface SiteLookupResult {
  siteKey: SiteKey;
  articleUrl: string | null;
  status: SiteLookupResultStatus;
  resolved: boolean;
  wordpressPostId: number | null;
  wordpressPostType: WordPressEntityType | null;
  reason?: string;
  error?: string;
}

const SITE_KEYS = ["technerdiness", "gamingwize"] as const;

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url.toString();
}

function trimOptionalUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function deriveSlugFromArticleUrl(articleUrl: string): string {
  const url = new URL(articleUrl);
  const slug = url.pathname.split("/").filter(Boolean).pop();

  if (!slug) {
    throw new Error(`Could not derive a WordPress slug from URL: ${articleUrl}`);
  }

  return slug;
}

async function fetchWordPressEntities(
  articleUrl: string,
  endpoint: "posts" | "pages"
): Promise<WordPressEntity[]> {
  const origin = new URL(articleUrl).origin;
  const slug = deriveSlugFromArticleUrl(articleUrl);
  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}`, origin);
  requestUrl.searchParams.set("slug", slug);
  requestUrl.searchParams.set("_fields", "id,link,slug,type");
  requestUrl.searchParams.set("per_page", "10");

  const response = await fetch(requestUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`WordPress ${endpoint} lookup failed with status ${response.status}`);
  }

  const data = (await response.json()) as WordPressEntity[];
  return Array.isArray(data) ? data : [];
}

function chooseWordPressEntity(
  articleUrl: string,
  entities: WordPressEntity[]
): WordPressEntity | null {
  if (!entities.length) {
    return null;
  }

  const normalizedTarget = normalizeUrl(articleUrl);
  const exact = entities.find((entity) => normalizeUrl(entity.link) === normalizedTarget);
  if (exact) {
    return exact;
  }

  if (entities.length === 1) {
    return entities[0];
  }

  return null;
}

async function resolveWordPressEntity(articleUrl: string): Promise<WordPressEntity | null> {
  const posts = await fetchWordPressEntities(articleUrl, "posts");
  const exactPost = chooseWordPressEntity(articleUrl, posts);
  if (exactPost) {
    return exactPost;
  }

  const pages = await fetchWordPressEntities(articleUrl, "pages");
  const exactPage = chooseWordPressEntity(articleUrl, pages);
  if (exactPage) {
    return exactPage;
  }

  const combined = [...posts, ...pages];
  return combined.length === 1 ? combined[0] : null;
}

async function resolveSiteArticle(
  ctx: any,
  siteKey: SiteKey,
  articleId: string,
  articleUrl: string | null
): Promise<SiteLookupResult> {
  if (!articleUrl) {
    // Clear state for missing URL
    await ctx.runMutation(internal.wordpressState.upsertState, {
      articleId,
      siteKey,
      patch: {
        wordpressPostId: undefined,
        wordpressPostType: undefined,
        wordpressLookupStatus: "pending",
        wordpressLookupError: undefined,
        wordpressLookupRequestedAt: undefined,
        wordpressLookupCompletedAt: undefined,
        lastWordpressCodesHash: undefined,
        lastWordpressSyncAt: undefined,
        lastWordpressSyncError: undefined,
      },
    });
    return {
      siteKey,
      articleUrl: null,
      status: "skipped",
      resolved: false,
      wordpressPostId: null,
      wordpressPostType: null,
      reason: "missing_article_url",
    };
  }

  const requestedAt = new Date().toISOString();
  // Mark as processing
  await ctx.runMutation(internal.wordpressState.upsertState, {
    articleId,
    siteKey,
    patch: {
      wordpressPostId: undefined,
      wordpressPostType: undefined,
      wordpressLookupStatus: "processing",
      wordpressLookupError: undefined,
      wordpressLookupRequestedAt: requestedAt,
      wordpressLookupCompletedAt: undefined,
      lastWordpressCodesHash: undefined,
      lastWordpressSyncAt: undefined,
      lastWordpressSyncError: undefined,
    },
  });

  try {
    const entity = await resolveWordPressEntity(articleUrl);

    if (!entity) {
      const completedAt = new Date().toISOString();
      await ctx.runMutation(internal.wordpressState.upsertState, {
        articleId,
        siteKey,
        patch: {
          wordpressPostId: undefined,
          wordpressPostType: undefined,
          wordpressLookupStatus: "not_found",
          wordpressLookupError: `No WordPress post matched ${articleUrl}`,
          wordpressLookupCompletedAt: completedAt,
          lastWordpressCodesHash: undefined,
          lastWordpressSyncAt: undefined,
          lastWordpressSyncError: undefined,
        },
      });
      return {
        siteKey,
        articleUrl,
        status: "not_found",
        resolved: false,
        wordpressPostId: null,
        wordpressPostType: null,
        reason: "not_found",
      };
    }

    const completedAt = new Date().toISOString();
    await ctx.runMutation(internal.wordpressState.upsertState, {
      articleId,
      siteKey,
      patch: {
        wordpressPostId: entity.id,
        wordpressPostType: entity.type,
        wordpressLookupStatus: "resolved",
        wordpressLookupError: undefined,
        wordpressLookupCompletedAt: completedAt,
      },
    });
    return {
      siteKey,
      articleUrl,
      status: "resolved",
      resolved: true,
      wordpressPostId: entity.id,
      wordpressPostType: entity.type,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const completedAt = new Date().toISOString();
    await ctx.runMutation(internal.wordpressState.upsertState, {
      articleId,
      siteKey,
      patch: {
        wordpressPostId: undefined,
        wordpressPostType: undefined,
        wordpressLookupStatus: "error",
        wordpressLookupError: message,
        wordpressLookupCompletedAt: completedAt,
        lastWordpressCodesHash: undefined,
        lastWordpressSyncAt: undefined,
        lastWordpressSyncError: undefined,
      },
    });
    return {
      siteKey,
      articleUrl,
      status: "error",
      resolved: false,
      wordpressPostId: null,
      wordpressPostType: null,
      error: message,
    };
  }
}

async function handleResolveWordpressPostId(
  ctx: any,
  args: {
    articleId: string;
    technerdinessArticleUrl?: string;
    gamingwizeArticleUrl?: string;
    ourArticleUrl?: string;
  }
) {
  if (!args.articleId) {
    throw new Error("Missing articleId");
  }

  const article = await ctx.runQuery(internal.articlesInternal.getArticle, {
    id: args.articleId,
  });
  if (!article) {
    throw new Error(`Article not found: ${args.articleId}`);
  }

  const articleUrls: Record<SiteKey, string | null> = {
    technerdiness:
      trimOptionalUrl(args.technerdinessArticleUrl) ??
      (article.technerdinessArticleUrl ? trimOptionalUrl(article.technerdinessArticleUrl) : null) ??
      trimOptionalUrl(args.ourArticleUrl),
    gamingwize:
      trimOptionalUrl(args.gamingwizeArticleUrl) ??
      (article.gamingwizeArticleUrl ? trimOptionalUrl(article.gamingwizeArticleUrl) : null),
  };

  const results = await Promise.all(
    SITE_KEYS.map((siteKey) =>
      resolveSiteArticle(ctx, siteKey, args.articleId, articleUrls[siteKey])
    )
  );

  const resolvedCount = results.filter((result) => result.resolved).length;
  const errorResults = results.filter((result) => result.status === "error");
  const configuredCount = results.filter((result) => result.articleUrl).length;

  const responseBody = {
    articleId: args.articleId,
    resolved: resolvedCount > 0,
    configuredSites: configuredCount,
    resolvedSites: resolvedCount,
    sites: results,
  };

  if (errorResults.length) {
    return {
      ...responseBody,
      error: "One or more site lookups failed",
    };
  }

  if (configuredCount === 0) {
    return {
      ...responseBody,
      reason: "No Tech Nerdiness or Gaming Wize article URL is configured for this row",
    };
  }

  return responseBody;
}

export const run = internalAction({
  args: {
    articleId: v.id("articles"),
    technerdinessArticleUrl: v.optional(v.string()),
    gamingwizeArticleUrl: v.optional(v.string()),
    ourArticleUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await handleResolveWordpressPostId(ctx, args);
  },
});

export const resolveWordpressPostId = action({
  args: {
    articleId: v.id("articles"),
    technerdinessArticleUrl: v.optional(v.string()),
    gamingwizeArticleUrl: v.optional(v.string()),
    ourArticleUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await handleResolveWordpressPostId(ctx, args);
  },
});
