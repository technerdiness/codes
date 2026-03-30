"use node";

import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  DEFAULT_LETROSO_URL,
  revealLetrosoAnswer,
} from "./lib/providers/beebomLetroso";
import { updateWordPressLetrosoAnswerSection } from "./lib/wordpress";
import type { WordPressSiteKey } from "./lib/wordpress";

interface WordPressSiteResult {
  siteKey: WordPressSiteKey;
  status: "updated" | "skipped" | "error";
  articleUrl?: string;
  wordpressPostId?: number;
  reason?: string;
}

interface SyncLetrosoSummary {
  sourceUrl: string;
  answerDate: string;
  answer: string;
  extractedFrom: string;
  meaning: string | null;
  dryRun: boolean;
  convex:
    | {
        status: "saved";
      }
    | {
        status: "skipped";
        reason: string;
      };
  wordpress: WordPressSiteResult[];
}

function validateUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error();
    }
    return value;
  } catch {
    throw new Error(`Invalid sourceUrl: ${value}`);
  }
}

async function handleSyncLetroso(
  ctx: any,
  args: { sourceUrl?: string; dryRun?: boolean }
): Promise<SyncLetrosoSummary> {
  const dryRun = Boolean(args.dryRun);
  const sourceUrl = validateUrl(args.sourceUrl?.trim() || DEFAULT_LETROSO_URL);

  console.log(`Letroso sync start: mode=${dryRun ? "dry-run" : "write"}`);
  console.log(`Source: ${sourceUrl}`);

  const LETROSO_SITES: WordPressSiteKey[] = ["technerdiness", "gamingwize"];

  const result = await revealLetrosoAnswer(sourceUrl);
  const summary: SyncLetrosoSummary = {
    sourceUrl: result.sourceUrl,
    answerDate: result.answerDate,
    answer: result.answer,
    extractedFrom: result.extractedFrom,
    meaning: result.meaning,
    dryRun,
    convex: dryRun
      ? {
          status: "skipped",
          reason: "--dry-run",
        }
      : {
          status: "saved",
        },
    wordpress: dryRun
      ? LETROSO_SITES.map((siteKey) => ({
          siteKey,
          status: "skipped" as const,
          reason: "--dry-run",
        }))
      : [],
  };

  if (dryRun) {
    console.log(`Scraped answer: ${result.answer} for ${result.answerDate}`);
    console.log("Convex skipped: --dry-run");
    console.log("WordPress skipped: --dry-run");
    return summary;
  }

  await ctx.runMutation(internal.letrosoAnswers.upsertAnswer, {
    answerDate: result.answerDate,
    answerDateSource: result.answerDateSource,
    answer: result.answer,
    sourceUrl: result.sourceUrl,
    pageTitle: result.pageTitle ?? undefined,
    ogTitle: result.ogTitle ?? undefined,
    publishedAt: result.publishedAt ?? undefined,
    modifiedAt: result.modifiedAt ?? undefined,
    fetchedAt: result.fetchedAt,
    sectionHeading: result.sectionHeading,
    sectionSelector: result.sectionSelector,
    extractedFrom: result.extractedFrom,
    tileCount: result.tiles.length,
    payload: JSON.parse(JSON.stringify(result)),
  });
  summary.convex = { status: "saved" };
  console.log(`Scraped answer: ${result.answer} for ${result.answerDate}`);
  console.log(`Convex updated: letrosoAnswers`);

  const history = (
    await ctx.runQuery(internal.letrosoAnswers.getHistory, {})
  ).filter(
    (entry: { answerDate: string; answer: string }) =>
      entry.answerDate !== result.answerDate
  );

  for (const siteKey of LETROSO_SITES) {
    try {
      const wordpressResult = await updateWordPressLetrosoAnswerSection({
        result,
        history,
        siteKey,
      });

      if (wordpressResult.updated) {
        summary.wordpress.push({
          siteKey,
          status: "updated",
          articleUrl: wordpressResult.articleUrl,
          wordpressPostId: wordpressResult.wordpressPostId,
        });
        console.log(
          `WordPress [${siteKey}] updated: post ${wordpressResult.wordpressPostId} (${history.length} history rows)`
        );
      } else {
        const reason = wordpressResult.reason === "answer_unchanged" ? "answer unchanged" : "no change";
        summary.wordpress.push({
          siteKey,
          status: "skipped",
          reason,
        });
        console.log(`WordPress [${siteKey}] skipped: ${reason}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      summary.wordpress.push({
        siteKey,
        status: "error",
        reason: errorMessage,
      });
      console.error(`WordPress [${siteKey}] error: ${errorMessage}`);
    }
  }

  const siteStatuses = summary.wordpress.map((s) => `${s.siteKey}=${s.status}`).join(", ");
  console.log(
    `Letroso sync complete: answer=${summary.answer}, date=${summary.answerDate}, convex=${summary.convex.status}, wordpress=[${siteStatuses}]`
  );

  if (!dryRun) {
    const issues: { group: string; identifier: string; reason: string }[] = [];
    let updatedCount = 0;

    for (const wp of summary.wordpress) {
      if (wp.status === "error" && wp.reason) {
        const site = wp.siteKey === "technerdiness" ? "Tech Nerdiness update" : "Gaming Wize update";
        issues.push({ group: site, identifier: `Letroso ${summary.answerDate}`, reason: wp.reason });
      } else if (wp.status === "updated") {
        updatedCount++;
      }
    }

    await ctx.runMutation(internal.syncRuns.record, {
      automationType: "letroso",
      ranAt: new Date().toISOString(),
      updatedCount,
      issueCount: issues.length,
      issues,
    });
  }

  return summary;
}

export const run = internalAction({
  args: {
    sourceUrl: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await handleSyncLetroso(ctx, args);
  },
});

export const syncLetroso = action({
  args: {
    sourceUrl: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await handleSyncLetroso(ctx, args);
  },
});
