import type { ConnectionsAnswerResult } from "../../types/connections.ts";
import { createSupabaseClient } from "./client.ts";

interface PersistedConnectionsAnswerRow {
  answer_date: string;
  answer_date_source: ConnectionsAnswerResult["answerDateSource"];
  source_url: string;
  puzzle_id: number;
  editor: string | null;
  category_count: number;
  categories: Record<string, unknown>[];
  fetched_at: string;
  extracted_from: ConnectionsAnswerResult["extractedFrom"];
  payload: Record<string, unknown>;
}

export interface ConnectionsSupabaseSaveSummary {
  schema: string;
  table: string;
  keyType: "service_role" | "anon";
  answerDate: string;
  puzzleId: number;
  categoryCount: number;
}

export async function saveConnectionsAnswerToSupabase(
  result: ConnectionsAnswerResult
): Promise<ConnectionsSupabaseSaveSummary> {
  const { client, config } = createSupabaseClient();
  const row = buildConnectionsAnswerRow(result);
  const { error } = await client
    .from(config.connectionsAnswersTable)
    .upsert(row, { onConflict: "answer_date" });

  if (error) {
    throw new Error(
      `Supabase upsert failed for ${config.schema}.${config.connectionsAnswersTable}: ${error.message}`
    );
  }

  return {
    schema: config.schema,
    table: config.connectionsAnswersTable,
    keyType: config.keyType,
    answerDate: result.answerDate,
    puzzleId: result.puzzleId,
    categoryCount: result.categories.length,
  };
}

function buildConnectionsAnswerRow(result: ConnectionsAnswerResult): PersistedConnectionsAnswerRow {
  return {
    answer_date: result.answerDate,
    answer_date_source: result.answerDateSource,
    source_url: result.sourceUrl,
    puzzle_id: result.puzzleId,
    editor: result.editor,
    category_count: result.categories.length,
    categories: JSON.parse(JSON.stringify(result.categories)) as Record<string, unknown>[],
    fetched_at: result.fetchedAt,
    extracted_from: result.extractedFrom,
    payload: JSON.parse(JSON.stringify(result)) as Record<string, unknown>,
  };
}
