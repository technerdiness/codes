import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  articles: defineTable({
    gameName: v.string(),
    sourceBeebomUrl: v.optional(v.string()),
    sourceTechwiserUrl: v.optional(v.string()),
    technerdinessArticleUrl: v.optional(v.string()),
    gamingwizeArticleUrl: v.optional(v.string()),
    lastScrapedAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index("by_game_name", ["gameName"])
    .index("by_source_beebom_url", ["sourceBeebomUrl"])
    .index("by_source_techwiser_url", ["sourceTechwiserUrl"])
    .index("by_technerdiness_url", ["technerdinessArticleUrl"])
    .index("by_gamingwize_url", ["gamingwizeArticleUrl"]),

  codes: defineTable({
    articleId: v.id("articles"),
    gameName: v.string(),
    provider: v.string(),
    code: v.string(),
    status: v.string(),
    rewardsText: v.optional(v.string()),
    isNew: v.boolean(),
    firstSeenAt: v.string(),
    lastSeenAt: v.string(),
  })
    .index("by_article_id", ["articleId"])
    .index("by_article_and_code", ["articleId", "code"])
    .index("by_game_name", ["gameName"])
    .index("by_status", ["status"]),

  technerdinessWordpressState: defineTable({
    articleId: v.id("articles"),
    wordpressPostId: v.optional(v.number()),
    wordpressPostType: v.optional(v.string()),
    wordpressLookupStatus: v.string(),
    wordpressLookupError: v.optional(v.string()),
    wordpressLookupRequestedAt: v.optional(v.string()),
    wordpressLookupCompletedAt: v.optional(v.string()),
    lastWordpressCodesHash: v.optional(v.string()),
    lastWordpressSyncAt: v.optional(v.string()),
    lastWordpressSyncError: v.optional(v.string()),
  })
    .index("by_article_id", ["articleId"])
    .index("by_lookup_status", ["wordpressLookupStatus"])
    .index("by_wordpress_post_id", ["wordpressPostId"]),

  gamingwizeWordpressState: defineTable({
    articleId: v.id("articles"),
    wordpressPostId: v.optional(v.number()),
    wordpressPostType: v.optional(v.string()),
    wordpressLookupStatus: v.string(),
    wordpressLookupError: v.optional(v.string()),
    wordpressLookupRequestedAt: v.optional(v.string()),
    wordpressLookupCompletedAt: v.optional(v.string()),
    lastWordpressCodesHash: v.optional(v.string()),
    lastWordpressSyncAt: v.optional(v.string()),
    lastWordpressSyncError: v.optional(v.string()),
  })
    .index("by_article_id", ["articleId"])
    .index("by_lookup_status", ["wordpressLookupStatus"])
    .index("by_wordpress_post_id", ["wordpressPostId"]),

  letrosoAnswers: defineTable({
    answerDate: v.string(),
    answerDateSource: v.string(),
    answer: v.string(),
    sourceUrl: v.string(),
    pageTitle: v.optional(v.string()),
    ogTitle: v.optional(v.string()),
    publishedAt: v.optional(v.string()),
    modifiedAt: v.optional(v.string()),
    fetchedAt: v.string(),
    sectionHeading: v.string(),
    sectionSelector: v.string(),
    extractedFrom: v.string(),
    tileCount: v.number(),
    payload: v.any(),
  })
    .index("by_answer_date", ["answerDate"])
    .index("by_fetched_at", ["fetchedAt"]),

  wordleAnswers: defineTable({
    answerDate: v.string(),
    answerDateSource: v.string(),
    answer: v.string(),
    sourceUrl: v.string(),
    puzzleId: v.number(),
    daysSinceLaunch: v.number(),
    editor: v.optional(v.string()),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  })
    .index("by_answer_date", ["answerDate"])
    .index("by_fetched_at", ["fetchedAt"]),

  connectionsAnswers: defineTable({
    answerDate: v.string(),
    answerDateSource: v.string(),
    sourceUrl: v.string(),
    puzzleId: v.number(),
    editor: v.optional(v.string()),
    categoryCount: v.number(),
    categories: v.any(),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  })
    .index("by_answer_date", ["answerDate"])
    .index("by_puzzle_id", ["puzzleId"])
    .index("by_fetched_at", ["fetchedAt"]),

  strandsAnswers: defineTable({
    answerDate: v.string(),
    answerDateSource: v.string(),
    sourceUrl: v.string(),
    puzzleId: v.number(),
    clue: v.string(),
    spangram: v.string(),
    themeWordCount: v.number(),
    themeWords: v.array(v.string()),
    themeCoords: v.any(),
    spangramCoords: v.any(),
    editor: v.optional(v.string()),
    constructors: v.optional(v.string()),
    startingBoard: v.array(v.string()),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  })
    .index("by_answer_date", ["answerDate"])
    .index("by_puzzle_id", ["puzzleId"])
    .index("by_fetched_at", ["fetchedAt"]),
});
