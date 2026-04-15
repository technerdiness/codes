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
    postedOnX: v.optional(v.boolean()),
  })
    .index("by_article_id", ["articleId"])
    .index("by_article_and_code", ["articleId", "code"])
    .index("by_game_name", ["gameName"])
    .index("by_status", ["status"])
    .index("by_status_and_postedOnX", ["status", "postedOnX"]),

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

  spellingBeeAnswers: defineTable({
    answerDate: v.string(),
    answerDateSource: v.string(),
    sourceUrl: v.string(),
    puzzleId: v.number(),
    centerLetter: v.string(),
    outerLetters: v.array(v.string()),
    validLetters: v.array(v.string()),
    pangrams: v.array(v.string()),
    pangramCount: v.number(),
    answers: v.array(v.string()),
    answerCount: v.number(),
    editor: v.optional(v.string()),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  })
    .index("by_answer_date", ["answerDate"])
    .index("by_puzzle_id", ["puzzleId"])
    .index("by_fetched_at", ["fetchedAt"]),

  letterBoxedAnswers: defineTable({
    answerDate: v.string(),
    answerDateSource: v.string(),
    sourceUrl: v.string(),
    puzzleId: v.number(),
    sides: v.array(v.string()),
    solution: v.array(v.string()),
    solutionCount: v.number(),
    par: v.optional(v.number()),
    editor: v.optional(v.string()),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  })
    .index("by_answer_date", ["answerDate"])
    .index("by_puzzle_id", ["puzzleId"])
    .index("by_fetched_at", ["fetchedAt"]),

  sudokuAnswers: defineTable({
    answerDate: v.string(),
    answerDateSource: v.string(),
    sourceUrl: v.string(),
    easyPuzzleId: v.number(),
    mediumPuzzleId: v.number(),
    hardPuzzleId: v.number(),
    easy: v.any(),
    medium: v.any(),
    hard: v.any(),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  })
    .index("by_answer_date", ["answerDate"])
    .index("by_fetched_at", ["fetchedAt"]),

  pipsAnswers: defineTable({
    answerDate: v.string(),
    answerDateSource: v.string(),
    sourceUrl: v.string(),
    editor: v.optional(v.string()),
    easyPuzzleId: v.number(),
    mediumPuzzleId: v.number(),
    hardPuzzleId: v.number(),
    easy: v.any(),
    medium: v.any(),
    hard: v.any(),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  })
    .index("by_answer_date", ["answerDate"])
    .index("by_fetched_at", ["fetchedAt"]),

  gamingNews: defineTable({
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
    status: v.string(), // "pending" | "writing" | "completed" | "failed"
    collectedAt: v.string(),
    articleTitle: v.optional(v.string()),
    articleHtml: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    wordpressPostId: v.optional(v.number()),
    wordpressUrl: v.optional(v.string()),
    writtenAt: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_slug", ["slug"])
    .index("by_collected_at", ["collectedAt"]),

  normalArticles: defineTable({
    sourceUrls: v.array(v.string()),
    articleType: v.string(), // "listicle" | "explainer" | "howto"
    status: v.string(), // "pending" | "writing" | "completed" | "failed"
    createdAt: v.string(),
    articleTitle: v.optional(v.string()),
    articleHtml: v.optional(v.string()),
    metaDescription: v.optional(v.string()),
    wordpressPostId: v.optional(v.number()),
    wordpressUrl: v.optional(v.string()),
    writtenAt: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_created_at", ["createdAt"]),

  syncRuns: defineTable({
    automationType: v.string(), // "game_codes" | "nyt_puzzles" | "letroso" | "collect_gaming_news" | "write_gaming_news"
    ranAt: v.string(),
    updatedCount: v.number(),
    issueCount: v.number(),
    issues: v.array(
      v.object({
        group: v.string(),   // e.g. "Beebom scraping", "Tech Nerdiness update", "Gaming Wize update"
        identifier: v.string(), // game name, puzzle name, article title, etc.
        reason: v.string(),
      })
    ),
  })
    .index("by_automation_type_and_ran_at", ["automationType", "ranAt"]),

  contextoAnswers: defineTable({
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

  linkedInCrossclimbAnswers: defineTable({
    puzzleId: v.number(),
    answerDate: v.string(),
    // words in order (top to bottom rung)
    words: v.array(v.string()),
    // clues in order matching words
    clues: v.array(v.string()),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  })
    .index("by_answer_date", ["answerDate"])
    .index("by_puzzle_id", ["puzzleId"])
    .index("by_fetched_at", ["fetchedAt"]),

  linkedInQueensAnswers: defineTable({
    puzzleId: v.number(),
    answerDate: v.string(),
    gridSize: v.number(),
    // queen positions: one per color region, in color-index order
    solution: v.array(v.object({ row: v.number(), col: v.number() })),
    // flat color grid: gridSize*gridSize numbers, row-major
    colorGrid: v.array(v.number()),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  })
    .index("by_answer_date", ["answerDate"])
    .index("by_puzzle_id", ["puzzleId"])
    .index("by_fetched_at", ["fetchedAt"]),

  linkedInTangoAnswers: defineTable({
    puzzleId: v.number(),
    answerDate: v.string(),
    gridSize: v.number(),
    // flat solution: "ZERO" or "ONE" per cell, row-major
    solution: v.array(v.string()),
    // cell indices that were pre-filled in the puzzle
    presetCellIdxes: v.array(v.number()),
    // constraint edges: isEqual=true means "=", isEqual=false means "×"
    edges: v.optional(v.array(v.object({ startIdx: v.number(), endIdx: v.number(), isEqual: v.boolean() }))),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  })
    .index("by_answer_date", ["answerDate"])
    .index("by_puzzle_id", ["puzzleId"])
    .index("by_fetched_at", ["fetchedAt"]),

  linkedInMiniSudokuAnswers: defineTable({
    puzzleId: v.number(),
    answerDate: v.string(),
    name: v.string(),
    gridRowSize: v.number(),
    gridColSize: v.number(),
    // flat solution: numbers 1–N, row-major
    solution: v.array(v.number()),
    // cell indices that were pre-filled
    presetCellIdxes: v.array(v.number()),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  })
    .index("by_answer_date", ["answerDate"])
    .index("by_puzzle_id", ["puzzleId"])
    .index("by_fetched_at", ["fetchedAt"]),

  linkedInZipAnswers: defineTable({
    puzzleId: v.number(),
    answerDate: v.string(), // YYYY-MM-DD
    gridSize: v.number(),
    solution: v.array(v.number()), // ordered cell indices forming the path
    orderedSequence: v.array(v.number()), // numbered waypoint cell indices
    walls: v.array(v.object({
      cellIdx: v.number(),
      direction: v.union(v.literal("UP"), v.literal("DOWN"), v.literal("LEFT"), v.literal("RIGHT")),
    })),
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
