import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ── Zip ────────────────────────────────────────────────────────────────────

export const upsertZipAnswer = internalMutation({
  args: {
    puzzleId: v.number(),
    answerDate: v.string(),
    gridSize: v.number(),
    solution: v.array(v.number()),
    orderedSequence: v.array(v.number()),
    walls: v.array(v.object({
      cellIdx: v.number(),
      direction: v.union(v.literal("UP"), v.literal("DOWN"), v.literal("LEFT"), v.literal("RIGHT")),
    })),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("linkedInZipAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("linkedInZipAnswers", args);
    }
  },
});

export const getZipAnswer = internalQuery({
  args: { answerDate: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("linkedInZipAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();
  },
});

export const getZipHistory = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("linkedInZipAnswers")
      .withIndex("by_answer_date")
      .order("desc")
      .collect();
    return rows.map((row) => ({
      answerDate: row.answerDate,
      puzzleId: row.puzzleId,
    }));
  },
});

// ── Crossclimb ─────────────────────────────────────────────────────────────

export const upsertCrossclimbAnswer = internalMutation({
  args: {
    puzzleId: v.number(),
    answerDate: v.string(),
    words: v.array(v.string()),
    clues: v.array(v.string()),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("linkedInCrossclimbAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("linkedInCrossclimbAnswers", args);
    }
  },
});

export const getCrossclimbHistory = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("linkedInCrossclimbAnswers")
      .withIndex("by_answer_date")
      .order("desc")
      .collect();
    return rows.map((row) => ({ answerDate: row.answerDate, puzzleId: row.puzzleId }));
  },
});

// ── Queens ──────────────────────────────────────────────────────────────────

export const upsertQueensAnswer = internalMutation({
  args: {
    puzzleId: v.number(),
    answerDate: v.string(),
    gridSize: v.number(),
    solution: v.array(v.object({ row: v.number(), col: v.number() })),
    colorGrid: v.array(v.number()),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("linkedInQueensAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("linkedInQueensAnswers", args);
    }
  },
});

export const getQueensHistory = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("linkedInQueensAnswers")
      .withIndex("by_answer_date")
      .order("desc")
      .collect();
    return rows.map((row) => ({ answerDate: row.answerDate, puzzleId: row.puzzleId }));
  },
});

// ── Tango ───────────────────────────────────────────────────────────────────

export const upsertTangoAnswer = internalMutation({
  args: {
    puzzleId: v.number(),
    answerDate: v.string(),
    gridSize: v.number(),
    solution: v.array(v.string()),
    presetCellIdxes: v.array(v.number()),
    edges: v.optional(v.array(v.object({ startIdx: v.number(), endIdx: v.number(), isEqual: v.boolean() }))),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("linkedInTangoAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("linkedInTangoAnswers", args);
    }
  },
});

export const getTangoHistory = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("linkedInTangoAnswers")
      .withIndex("by_answer_date")
      .order("desc")
      .collect();
    return rows.map((row) => ({ answerDate: row.answerDate, puzzleId: row.puzzleId }));
  },
});

// ── Mini Sudoku ─────────────────────────────────────────────────────────────

export const upsertMiniSudokuAnswer = internalMutation({
  args: {
    puzzleId: v.number(),
    answerDate: v.string(),
    name: v.string(),
    gridRowSize: v.number(),
    gridColSize: v.number(),
    solution: v.array(v.number()),
    presetCellIdxes: v.array(v.number()),
    fetchedAt: v.string(),
    extractedFrom: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("linkedInMiniSudokuAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("linkedInMiniSudokuAnswers", args);
    }
  },
});

export const getMiniSudokuHistory = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("linkedInMiniSudokuAnswers")
      .withIndex("by_answer_date")
      .order("desc")
      .collect();
    return rows.map((row) => ({ answerDate: row.answerDate, puzzleId: row.puzzleId, name: row.name }));
  },
});
