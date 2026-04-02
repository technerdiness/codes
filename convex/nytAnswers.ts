import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const upsertWordleAnswer = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("wordleAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("wordleAnswers", args);
    }
  },
});

export const getPreviousWordleAnswer = internalQuery({
  args: { answerDate: v.string() },
  handler: async (ctx, args) => {
    return ctx.db.query("wordleAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();
  },
});

export const getWordleHistory = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("wordleAnswers")
      .withIndex("by_answer_date")
      .order("desc")
      .collect();
    return rows.map((row) => ({
      answerDate: row.answerDate,
      answer: row.answer,
      puzzleId: row.daysSinceLaunch,
    }));
  },
});

export const upsertConnectionsAnswer = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("connectionsAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("connectionsAnswers", args);
    }
  },
});

export const upsertStrandsAnswer = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("strandsAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("strandsAnswers", args);
    }
  },
});

export const upsertSpellingBeeAnswer = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("spellingBeeAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("spellingBeeAnswers", args);
    }
  },
});

export const upsertLetterBoxedAnswer = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("letterBoxedAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("letterBoxedAnswers", args);
    }
  },
});

export const upsertSudokuAnswer = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("sudokuAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("sudokuAnswers", args);
    }
  },
});

export const upsertPipsAnswer = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("pipsAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("pipsAnswers", args);
    }
  },
});
