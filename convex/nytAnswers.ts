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
