"use node";

import { v } from "convex/values";
import { internalAction, action, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  revealZipAnswer,
  revealCrossclimbAnswer,
  revealQueensAnswer,
  revealTangoAnswer,
  revealMiniSudokuAnswer,
} from "./lib/providers/linkedIn";
import {
  updateWordPressZipAnswerSection,
  updateWordPressCrossclimbAnswerSection,
  updateWordPressQueensAnswerSection,
  updateWordPressTangoAnswerSection,
  updateWordPressMiniSudokuAnswerSection,
} from "./lib/wordpress";

type LinkedInPuzzleName = "zip" | "crossclimb" | "queens" | "tango" | "mini-sudoku";

const ALL_LINKEDIN_PUZZLES: LinkedInPuzzleName[] = [
  "zip",
  "crossclimb",
  "queens",
  "tango",
  "mini-sudoku",
];

function isPuzzleName(value: string): value is LinkedInPuzzleName {
  return ALL_LINKEDIN_PUZZLES.includes(value as LinkedInPuzzleName);
}

interface SyncRequestPayload {
  puzzles?: LinkedInPuzzleName[];
  dryRun?: boolean;
}

interface SyncSummary {
  dryRun: boolean;
  puzzles: Record<string, Record<string, unknown>>;
}

// ── Zip ────────────────────────────────────────────────────────────────────

async function syncZip(
  ctx: ActionCtx,
  dryRun: boolean
): Promise<Record<string, unknown>> {
  const liAt = process.env.LINKEDIN_LI_AT?.trim();
  if (!liAt) {
    throw new Error("LINKEDIN_LI_AT environment variable is not set");
  }

  const result = await revealZipAnswer(liAt);

  const summary: Record<string, unknown> = {
    answerDate: result.answerDate,
    puzzleId: result.puzzleId,
    gridSize: result.gridSize,
    solutionLength: result.solution.length,
    waypointCount: result.orderedSequence.length,
    wallCount: result.walls.length,
    database: dryRun ? "skipped:dry-run" : "saved",
    wordpress: dryRun ? "skipped:dry-run" : "pending",
  };

  if (!dryRun) {
    await ctx.runMutation(internal.linkedInAnswers.upsertZipAnswer, {
      puzzleId: result.puzzleId,
      answerDate: result.answerDate,
      gridSize: result.gridSize,
      solution: result.solution,
      orderedSequence: result.orderedSequence,
      walls: result.walls,
      fetchedAt: result.fetchedAt,
      extractedFrom: result.extractedFrom,
      payload: JSON.parse(JSON.stringify(result)),
    });

    const history = (
      await ctx.runQuery(internal.linkedInAnswers.getZipHistory, {})
    ).filter((e: { answerDate: string }) => e.answerDate !== result.answerDate);

    try {
      const wpResult = await updateWordPressZipAnswerSection({ result, history });
      summary.wordpress = wpResult.updated ? "updated" : `skipped:${wpResult.reason}`;
      if (wpResult.updated) {
        console.log(`WordPress [gamingwize] updated: post ${wpResult.wordpressPostId}`);
      } else {
        console.log(`WordPress [gamingwize] skipped: ${wpResult.reason}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      summary.wordpress = `error:${msg}`;
      console.error(`WordPress [gamingwize] error: ${msg}`);
    }
  }

  return summary;
}

// ── Crossclimb ─────────────────────────────────────────────────────────────

async function syncCrossclimb(
  ctx: ActionCtx,
  dryRun: boolean
): Promise<Record<string, unknown>> {
  const liAt = process.env.LINKEDIN_LI_AT?.trim();
  if (!liAt) throw new Error("LINKEDIN_LI_AT environment variable is not set");

  const result = await revealCrossclimbAnswer(liAt);

  const summary: Record<string, unknown> = {
    answerDate: result.answerDate,
    puzzleId: result.puzzleId,
    words: result.words,
    database: dryRun ? "skipped:dry-run" : "saved",
  };

  if (!dryRun) {
    await ctx.runMutation(internal.linkedInAnswers.upsertCrossclimbAnswer, {
      puzzleId: result.puzzleId,
      answerDate: result.answerDate,
      words: result.words,
      clues: result.clues,
      fetchedAt: result.fetchedAt,
      extractedFrom: result.extractedFrom,
      payload: JSON.parse(JSON.stringify(result)),
    });

    const history = (await ctx.runQuery(internal.linkedInAnswers.getCrossclimbHistory, {}))
      .filter((e: { answerDate: string }) => e.answerDate !== result.answerDate);
    try {
      const wpResult = await updateWordPressCrossclimbAnswerSection({ result, history });
      summary.wordpress = wpResult.updated ? "updated" : `skipped:${wpResult.reason}`;
    } catch (error) {
      summary.wordpress = `error:${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return summary;
}

// ── Queens ──────────────────────────────────────────────────────────────────

async function syncQueens(
  ctx: ActionCtx,
  dryRun: boolean
): Promise<Record<string, unknown>> {
  const liAt = process.env.LINKEDIN_LI_AT?.trim();
  if (!liAt) throw new Error("LINKEDIN_LI_AT environment variable is not set");

  const result = await revealQueensAnswer(liAt);

  const summary: Record<string, unknown> = {
    answerDate: result.answerDate,
    puzzleId: result.puzzleId,
    gridSize: result.gridSize,
    queenCount: result.solution.length,
    database: dryRun ? "skipped:dry-run" : "saved",
  };

  if (!dryRun) {
    await ctx.runMutation(internal.linkedInAnswers.upsertQueensAnswer, {
      puzzleId: result.puzzleId,
      answerDate: result.answerDate,
      gridSize: result.gridSize,
      solution: result.solution,
      colorGrid: result.colorGrid,
      fetchedAt: result.fetchedAt,
      extractedFrom: result.extractedFrom,
      payload: JSON.parse(JSON.stringify(result)),
    });

    const history = (await ctx.runQuery(internal.linkedInAnswers.getQueensHistory, {}))
      .filter((e: { answerDate: string }) => e.answerDate !== result.answerDate);
    try {
      const wpResult = await updateWordPressQueensAnswerSection({ result, history });
      summary.wordpress = wpResult.updated ? "updated" : `skipped:${wpResult.reason}`;
    } catch (error) {
      summary.wordpress = `error:${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return summary;
}

// ── Tango ───────────────────────────────────────────────────────────────────

async function syncTango(
  ctx: ActionCtx,
  dryRun: boolean
): Promise<Record<string, unknown>> {
  const liAt = process.env.LINKEDIN_LI_AT?.trim();
  if (!liAt) throw new Error("LINKEDIN_LI_AT environment variable is not set");

  const result = await revealTangoAnswer(liAt);

  const summary: Record<string, unknown> = {
    answerDate: result.answerDate,
    puzzleId: result.puzzleId,
    gridSize: result.gridSize,
    database: dryRun ? "skipped:dry-run" : "saved",
  };

  if (!dryRun) {
    await ctx.runMutation(internal.linkedInAnswers.upsertTangoAnswer, {
      puzzleId: result.puzzleId,
      answerDate: result.answerDate,
      gridSize: result.gridSize,
      solution: result.solution,
      presetCellIdxes: result.presetCellIdxes,
      edges: result.edges,
      fetchedAt: result.fetchedAt,
      extractedFrom: result.extractedFrom,
      payload: JSON.parse(JSON.stringify(result)),
    });

    const history = (await ctx.runQuery(internal.linkedInAnswers.getTangoHistory, {}))
      .filter((e: { answerDate: string }) => e.answerDate !== result.answerDate);
    try {
      const wpResult = await updateWordPressTangoAnswerSection({ result, history });
      summary.wordpress = wpResult.updated ? "updated" : `skipped:${wpResult.reason}`;
    } catch (error) {
      summary.wordpress = `error:${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return summary;
}

// ── Mini Sudoku ─────────────────────────────────────────────────────────────

async function syncMiniSudoku(
  ctx: ActionCtx,
  dryRun: boolean
): Promise<Record<string, unknown>> {
  const liAt = process.env.LINKEDIN_LI_AT?.trim();
  if (!liAt) throw new Error("LINKEDIN_LI_AT environment variable is not set");

  const result = await revealMiniSudokuAnswer(liAt);

  const summary: Record<string, unknown> = {
    answerDate: result.answerDate,
    puzzleId: result.puzzleId,
    name: result.name,
    gridSize: `${result.gridRowSize}x${result.gridColSize}`,
    database: dryRun ? "skipped:dry-run" : "saved",
  };

  if (!dryRun) {
    await ctx.runMutation(internal.linkedInAnswers.upsertMiniSudokuAnswer, {
      puzzleId: result.puzzleId,
      answerDate: result.answerDate,
      name: result.name,
      gridRowSize: result.gridRowSize,
      gridColSize: result.gridColSize,
      solution: result.solution,
      presetCellIdxes: result.presetCellIdxes,
      fetchedAt: result.fetchedAt,
      extractedFrom: result.extractedFrom,
      payload: JSON.parse(JSON.stringify(result)),
    });

    const history = (await ctx.runQuery(internal.linkedInAnswers.getMiniSudokuHistory, {}))
      .filter((e: { answerDate: string }) => e.answerDate !== result.answerDate);
    try {
      const wpResult = await updateWordPressMiniSudokuAnswerSection({ result, history });
      summary.wordpress = wpResult.updated ? "updated" : `skipped:${wpResult.reason}`;
    } catch (error) {
      summary.wordpress = `error:${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return summary;
}

// ── Handler ────────────────────────────────────────────────────────────────

async function handleSync(
  ctx: ActionCtx,
  payload: SyncRequestPayload
): Promise<SyncSummary> {
  const dryRun = Boolean(payload.dryRun);
  const requestedPuzzles = payload.puzzles?.filter(isPuzzleName).length
    ? payload.puzzles!.filter(isPuzzleName)
    : [...ALL_LINKEDIN_PUZZLES];

  const summary: SyncSummary = { dryRun, puzzles: {} };

  for (const puzzle of requestedPuzzles) {
    try {
      if (puzzle === "zip") {
        summary.puzzles.zip = await syncZip(ctx, dryRun);
      } else if (puzzle === "crossclimb") {
        summary.puzzles.crossclimb = await syncCrossclimb(ctx, dryRun);
      } else if (puzzle === "queens") {
        summary.puzzles.queens = await syncQueens(ctx, dryRun);
      } else if (puzzle === "tango") {
        summary.puzzles.tango = await syncTango(ctx, dryRun);
      } else if (puzzle === "mini-sudoku") {
        summary.puzzles["mini-sudoku"] = await syncMiniSudoku(ctx, dryRun);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed syncing LinkedIn ${puzzle}:`, error);
      summary.puzzles[puzzle] = { status: "error", error: message };
    }
  }

  if (!dryRun) {
    const issues: { group: string; identifier: string; reason: string }[] = [];
    let updatedCount = 0;

    for (const [puzzleName, puzzleSummary] of Object.entries(summary.puzzles)) {
      const ps = puzzleSummary as Record<string, unknown>;
      if (ps.status === "error" && typeof ps.error === "string") {
        issues.push({ group: "LinkedIn puzzle sync", identifier: puzzleName, reason: ps.error });
      } else {
        if (ps.database === "saved") updatedCount++;
        if (typeof ps.wordpress === "string" && ps.wordpress.startsWith("error:")) {
          issues.push({ group: "Gaming Wize update", identifier: puzzleName, reason: ps.wordpress.slice(6) });
        } else if (ps.wordpress === "updated") {
          updatedCount++;
        }
      }
    }

    await ctx.runMutation(internal.syncRuns.record, {
      automationType: "linkedin_puzzles",
      ranAt: new Date().toISOString(),
      updatedCount,
      issueCount: issues.length,
      issues,
    });
  }

  return summary;
}

// ── Exports ────────────────────────────────────────────────────────────────

export const run = internalAction({
  args: {
    puzzles: v.optional(v.array(v.string())),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await handleSync(ctx, {
      puzzles: args.puzzles as LinkedInPuzzleName[] | undefined,
      dryRun: args.dryRun,
    });
  },
});

export const syncLinkedInPuzzles = action({
  args: {
    puzzles: v.optional(v.array(v.string())),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await handleSync(ctx, {
      puzzles: args.puzzles as LinkedInPuzzleName[] | undefined,
      dryRun: args.dryRun,
    });
  },
});
