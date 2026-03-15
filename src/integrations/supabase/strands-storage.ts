import type { StrandsAnswerResult } from "../../types/strands.ts";
import { createSupabaseClient } from "./client.ts";

interface PersistedStrandsAnswerRow {
  answer_date: string;
  answer_date_source: StrandsAnswerResult["answerDateSource"];
  source_url: string;
  puzzle_id: number;
  clue: string;
  spangram: string;
  theme_word_count: number;
  theme_words: string[];
  theme_coords: Record<string, unknown>;
  spangram_coords: number[][];
  editor: string | null;
  constructors: string | null;
  starting_board: string[];
  fetched_at: string;
  extracted_from: StrandsAnswerResult["extractedFrom"];
  payload: Record<string, unknown>;
}

export interface StrandsSupabaseSaveSummary {
  schema: string;
  table: string;
  keyType: "service_role" | "anon";
  answerDate: string;
  puzzleId: number;
  themeWordCount: number;
}

export async function saveStrandsAnswerToSupabase(
  result: StrandsAnswerResult
): Promise<StrandsSupabaseSaveSummary> {
  const { client, config } = createSupabaseClient();
  const row = buildStrandsAnswerRow(result);
  const { error } = await client
    .from(config.strandsAnswersTable)
    .upsert(row, { onConflict: "answer_date" });

  if (error) {
    throw new Error(
      `Supabase upsert failed for ${config.schema}.${config.strandsAnswersTable}: ${error.message}`
    );
  }

  return {
    schema: config.schema,
    table: config.strandsAnswersTable,
    keyType: config.keyType,
    answerDate: result.answerDate,
    puzzleId: result.puzzleId,
    themeWordCount: result.themeWords.length,
  };
}

function buildStrandsAnswerRow(result: StrandsAnswerResult): PersistedStrandsAnswerRow {
  return {
    answer_date: result.answerDate,
    answer_date_source: result.answerDateSource,
    source_url: result.sourceUrl,
    puzzle_id: result.puzzleId,
    clue: result.clue,
    spangram: result.spangram,
    theme_word_count: result.themeWords.length,
    theme_words: [...result.themeWords],
    theme_coords: JSON.parse(JSON.stringify(result.themeCoords)) as Record<string, unknown>,
    spangram_coords: result.spangramCoords.map((coord) => [coord[0], coord[1]]),
    editor: result.editor,
    constructors: result.constructors,
    starting_board: [...result.startingBoard],
    fetched_at: result.fetchedAt,
    extracted_from: result.extractedFrom,
    payload: JSON.parse(JSON.stringify(result)) as Record<string, unknown>,
  };
}
