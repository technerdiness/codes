import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const upsertAnswer = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("letrosoAnswers")
      .withIndex("by_answer_date", (q) => q.eq("answerDate", args.answerDate))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("letrosoAnswers", args);
    }
  },
});

export const getHistory = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("letrosoAnswers")
      .withIndex("by_answer_date")
      .order("desc")
      .collect();
    return rows.map((row) => ({
      answerDate: row.answerDate,
      answer: row.answer,
    }));
  },
});
