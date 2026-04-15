"use node";

import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  DEFAULT_CONTEXTO_URL,
  revealContextoAnswer,
} from "./lib/providers/beebomContexto";
import { updateWordPressContextoAnswerSection } from "./lib/wordpress";
import type { WordPressSiteKey } from "./lib/wordpress";

interface WordPressSiteResult {
  siteKey: WordPressSiteKey;
  status: "updated" | "skipped" | "error";
  articleUrl?: string;
  wordpressPostId?: number;
  reason?: string;
}

interface SyncContextoSummary {
  sourceUrl: string;
  answerDate: string;
  answer: string;
  extractedFrom: string;
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

async function handleSyncContexto(
  ctx: any,
  args: { sourceUrl?: string; dryRun?: boolean }
): Promise<SyncContextoSummary> {
  const dryRun = Boolean(args.dryRun);
  const sourceUrl = validateUrl(args.sourceUrl?.trim() || DEFAULT_CONTEXTO_URL);

  console.log(`Contexto sync start: mode=${dryRun ? "dry-run" : "write"}`);
  console.log(`Source: ${sourceUrl}`);

  const CONTEXTO_SITES: WordPressSiteKey[] = ["technerdiness", "gamingwize"];

  const result = await revealContextoAnswer(sourceUrl);
  const summary: SyncContextoSummary = {
    sourceUrl: result.sourceUrl,
    answerDate: result.answerDate,
    answer: result.answer,
    extractedFrom: result.extractedFrom,
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
      ? CONTEXTO_SITES.map((siteKey) => ({
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

  await ctx.runMutation(internal.contextoAnswers.upsertAnswer, {
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
  console.log(`Convex updated: contextoAnswers`);

  const history = (
    await ctx.runQuery(internal.contextoAnswers.getHistory, {})
  ).filter(
    (entry: { answerDate: string; answer: string }) =>
      entry.answerDate !== result.answerDate
  );

  for (const siteKey of CONTEXTO_SITES) {
    try {
      const wordpressResult = await updateWordPressContextoAnswerSection({
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
    `Contexto sync complete: answer=${summary.answer}, date=${summary.answerDate}, convex=${summary.convex.status}, wordpress=[${siteStatuses}]`
  );

  const issues: { group: string; identifier: string; reason: string }[] = [];
  let updatedCount = 0;

  for (const wp of summary.wordpress) {
    if (wp.status === "error" && wp.reason) {
      const site = wp.siteKey === "technerdiness" ? "Tech Nerdiness update" : "Gaming Wize update";
      issues.push({ group: site, identifier: `Contexto ${summary.answerDate}`, reason: wp.reason });
    } else if (wp.status === "updated") {
      updatedCount++;
    }
  }

  await ctx.runMutation(internal.syncRuns.record, {
    automationType: "contexto",
    ranAt: new Date().toISOString(),
    updatedCount,
    issueCount: issues.length,
    issues,
  });

  return summary;
}

export const run = internalAction({
  args: {
    sourceUrl: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await handleSyncContexto(ctx, args);
  },
});

export const syncContexto = action({
  args: {
    sourceUrl: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await handleSyncContexto(ctx, args);
  },
});
