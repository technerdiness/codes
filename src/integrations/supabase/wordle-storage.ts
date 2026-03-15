import type { WordleAnswerResult } from "../../types/wordle.ts";
import { createSupabaseClient } from "./client.ts";

interface PersistedWordleAnswerRow {
  answer_date: string;
  answer_date_source: WordleAnswerResult["answerDateSource"];
  answer: string;
  source_url: string;
  puzzle_id: number;
  days_since_launch: number;
  editor: string | null;
  fetched_at: string;
  extracted_from: WordleAnswerResult["extractedFrom"];
  payload: Record<string, unknown>;
}

interface WordlePayloadLookupRow {
  payload: unknown;
}

export interface WordleSupabaseSaveSummary {
  schema: string;
  table: string;
  keyType: "service_role" | "anon";
  answerDate: string;
  answer: string;
  puzzleId: number;
}

export async function saveWordleAnswerToSupabase(
  result: WordleAnswerResult
): Promise<WordleSupabaseSaveSummary> {
  const { client, config } = createSupabaseClient();
  const row = buildWordleAnswerRow(result);
  const { error } = await client
    .from(config.wordleAnswersTable)
    .upsert(row, { onConflict: "answer_date" });

  if (error) {
    throw new Error(
      `Supabase upsert failed for ${config.schema}.${config.wordleAnswersTable}: ${error.message}`
    );
  }

  return {
    schema: config.schema,
    table: config.wordleAnswersTable,
    keyType: config.keyType,
    answerDate: result.answerDate,
    answer: result.answer,
    puzzleId: result.puzzleId,
  };
}

export async function fetchWordleAnswerFromSupabase(
  answerDate: string
): Promise<WordleAnswerResult | null> {
  const { client, config } = createSupabaseClient();
  const { data, error } = await client
    .from(config.wordleAnswersTable)
    .select("payload")
    .eq("answer_date", answerDate)
    .maybeSingle<WordlePayloadLookupRow>();

  if (error) {
    throw new Error(
      `Supabase select failed for ${config.schema}.${config.wordleAnswersTable}: ${error.message}`
    );
  }

  if (!data?.payload || typeof data.payload !== "object") {
    return null;
  }

  return data.payload as WordleAnswerResult;
}

function buildWordleAnswerRow(result: WordleAnswerResult): PersistedWordleAnswerRow {
  return {
    answer_date: result.answerDate,
    answer_date_source: result.answerDateSource,
    answer: result.answer,
    source_url: result.sourceUrl,
    puzzle_id: result.puzzleId,
    days_since_launch: result.daysSinceLaunch,
    editor: result.editor,
    fetched_at: result.fetchedAt,
    extracted_from: result.extractedFrom,
    payload: JSON.parse(JSON.stringify(result)) as Record<string, unknown>,
  };
}
