import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const record = internalMutation({
  args: {
    automationType: v.string(),
    ranAt: v.string(),
    updatedCount: v.number(),
    issueCount: v.number(),
    issues: v.array(
      v.object({
        group: v.string(),
        identifier: v.string(),
        reason: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("syncRuns", args);
  },
});

export const listLatest = query({
  args: {},
  handler: async (ctx) => {
    const automationTypes = [
      "game_codes",
      "nyt_puzzles",
      "letroso",
      "collect_gaming_news",
      "write_gaming_news",
    ];

    const results: Record<string, {
      automationType: string;
      ranAt: string;
      updatedCount: number;
      issueCount: number;
      issues: { group: string; identifier: string; reason: string }[];
    } | null> = {};

    for (const type of automationTypes) {
      const latest = await ctx.db
        .query("syncRuns")
        .withIndex("by_automation_type_and_ran_at", (q) => q.eq("automationType", type))
        .order("desc")
        .first();

      results[type] = latest
        ? {
            automationType: latest.automationType,
            ranAt: latest.ranAt,
            updatedCount: latest.updatedCount,
            issueCount: latest.issueCount,
            issues: latest.issues,
          }
        : null;
    }

    return results;
  },
});
