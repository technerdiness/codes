import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { CORS_HEADERS, corsPreflightResponse } from "../_shared/cors.ts";

import {
  fetchLetrosoAnswerHistoryFromSupabase,
  saveLetrosoAnswerToSupabase,
} from "../_shared/supabase/letroso-storage.ts";
import { updateWordPressLetrosoAnswerSection } from "../_shared/wordpress.ts";
import {
  DEFAULT_LETROSO_URL,
  revealLetrosoAnswer,
} from "../_shared/providers/beebom-letroso.ts";

interface SyncLetrosoRequestPayload {
  sourceUrl?: string;
  dryRun?: boolean;
}

interface SyncLetrosoSummary {
  sourceUrl: string;
  answerDate: string;
  answer: string;
  extractedFrom: string;
  meaning: string | null;
  dryRun: boolean;
  supabase:
    | {
        status: "saved";
        table: string;
      }
    | {
        status: "skipped";
        reason: string;
      };
  wordpress:
    | {
        status: "updated";
        articleUrl: string;
        wordpressPostId: number;
      }
    | {
        status: "skipped";
        reason: string;
      };
}

const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS };

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}

function isAuthorized(req: Request): boolean {
  const expected = Deno.env.get("SYNC_LETROSO_WEBHOOK_SECRET")?.trim();
  const received = req.headers.get("X-Webhook-Secret")?.trim();
  return Boolean(expected && received && expected === received);
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

async function handleSyncLetroso(payload: SyncLetrosoRequestPayload): Promise<SyncLetrosoSummary> {
  const dryRun = Boolean(payload.dryRun);
  const sourceUrl = validateUrl(payload.sourceUrl?.trim() || DEFAULT_LETROSO_URL);

  console.log(`Letroso sync start: mode=${dryRun ? "dry-run" : "write"}`);
  console.log(`Source: ${sourceUrl}`);

  const result = await revealLetrosoAnswer(sourceUrl);
  const summary: SyncLetrosoSummary = {
    sourceUrl: result.sourceUrl,
    answerDate: result.answerDate,
    answer: result.answer,
    extractedFrom: result.extractedFrom,
    meaning: result.meaning,
    dryRun,
    supabase: dryRun
      ? {
          status: "skipped",
          reason: "--dry-run",
        }
      : {
          status: "saved",
          table: "",
        },
    wordpress: dryRun
      ? {
          status: "skipped",
          reason: "--dry-run",
        }
      : {
          status: "updated",
          articleUrl: "",
          wordpressPostId: 0,
        },
  };

  if (dryRun) {
    console.log(`Scraped answer: ${result.answer} for ${result.answerDate}`);
    console.log("Supabase skipped: --dry-run");
    console.log("WordPress skipped: --dry-run");
    return summary;
  }

  const supabaseResult = await saveLetrosoAnswerToSupabase(result);
  summary.supabase = {
    status: "saved",
    table: supabaseResult.table,
  };
  console.log(`Scraped answer: ${result.answer} for ${result.answerDate}`);
  console.log(`Supabase updated: ${supabaseResult.table}`);

  const history = (await fetchLetrosoAnswerHistoryFromSupabase()).filter(
    (entry) => entry.answerDate !== result.answerDate
  );
  const wordpressResult = await updateWordPressLetrosoAnswerSection({
    result,
    history,
  });

  if (wordpressResult.updated) {
    summary.wordpress = {
      status: "updated",
      articleUrl: wordpressResult.articleUrl,
      wordpressPostId: wordpressResult.wordpressPostId,
    };
    console.log(
      `WordPress updated: post ${wordpressResult.wordpressPostId} (${history.length} history rows)`
    );
  } else {
    const reason = wordpressResult.reason === "answer_unchanged" ? "answer unchanged" : "no change";
    summary.wordpress = {
      status: "skipped",
      reason,
    };
    console.log(`WordPress skipped: ${reason}`);
  }

  console.log(
    `Letroso sync complete: answer=${summary.answer}, date=${summary.answerDate}, supabase=${summary.supabase.status}, wordpress=${summary.wordpress.status}`
  );

  return summary;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  let payload: SyncLetrosoRequestPayload = {};

  try {
    const text = await req.text();
    payload = text ? (JSON.parse(text) as SyncLetrosoRequestPayload) : {};
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  try {
    const summary = await handleSyncLetroso(payload);
    return jsonResponse(200, {
      ok: true,
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Letroso sync failed:", error);
    return jsonResponse(500, {
      ok: false,
      error: message,
    });
  }
});
