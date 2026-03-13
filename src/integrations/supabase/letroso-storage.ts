import type { LetrosoAnswerResult } from "../../types/letroso.ts";
import { createSupabaseClient } from "./client.ts";

interface PersistedLetrosoAnswerRow {
  answer_date: string;
  answer_date_source: LetrosoAnswerResult["answerDateSource"];
  answer: string;
  source_url: string;
  page_title: string | null;
  og_title: string | null;
  published_at: string | null;
  modified_at: string | null;
  fetched_at: string;
  section_heading: string;
  section_selector: string;
  extracted_from: LetrosoAnswerResult["extractedFrom"];
  tile_count: number;
  payload: Record<string, unknown>;
}

export interface LetrosoSupabaseSaveSummary {
  schema: string;
  table: string;
  keyType: "service_role" | "anon";
  answerDate: string;
  answer: string;
  tileCount: number;
}

export async function saveLetrosoAnswerToSupabase(
  result: LetrosoAnswerResult
): Promise<LetrosoSupabaseSaveSummary> {
  const { client, config } = createSupabaseClient();
  const row = buildLetrosoAnswerRow(result);
  const { error } = await client
    .from(config.letrosoAnswersTable)
    .upsert(row, { onConflict: "answer_date" });

  if (error) {
    throw new Error(
      `Supabase upsert failed for ${config.schema}.${config.letrosoAnswersTable}: ${error.message}`
    );
  }

  return {
    schema: config.schema,
    table: config.letrosoAnswersTable,
    keyType: config.keyType,
    answerDate: result.answerDate,
    answer: result.answer,
    tileCount: result.tiles.length,
  };
}

function buildLetrosoAnswerRow(result: LetrosoAnswerResult): PersistedLetrosoAnswerRow {
  return {
    answer_date: result.answerDate,
    answer_date_source: result.answerDateSource,
    answer: result.answer,
    source_url: result.sourceUrl,
    page_title: result.pageTitle,
    og_title: result.ogTitle,
    published_at: result.publishedAt,
    modified_at: result.modifiedAt,
    fetched_at: result.fetchedAt,
    section_heading: result.sectionHeading,
    section_selector: result.sectionSelector,
    extracted_from: result.extractedFrom,
    tile_count: result.tiles.length,
    payload: JSON.parse(JSON.stringify(result)) as Record<string, unknown>,
  };
}
