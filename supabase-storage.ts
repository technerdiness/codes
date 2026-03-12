import type { ArticleSourceInput, ScrapeProvider, ScrapeResult } from "./scraper-types.ts";
import { createSupabaseClient } from "./supabase.ts";

type PersistedCodeStatus = "active" | "expired";

interface PersistedCodeRow {
  article_id: string;
  game_name: string;
  provider: ScrapeProvider;
  code: string;
  status: PersistedCodeStatus;
  rewards_text: string | null;
  is_new: boolean;
  last_seen_at: string;
}

export interface SupabaseSaveSummary {
  schema: string;
  articlesTable: string;
  table: string;
  keyType: "service_role" | "anon";
  articleId: string;
  attemptedUpserts: number;
}

interface ArticleRow {
  game_name: string;
  our_article_url: string;
  beebom_article_url: string;
  source_provider: ScrapeProvider;
  last_scraped_at: string;
}

function buildArticleRow(source: ArticleSourceInput): ArticleRow {
  return {
    game_name: source.gameName,
    our_article_url: source.ourArticleUrl,
    beebom_article_url: source.beebomArticleUrl,
    source_provider: "beebom",
    last_scraped_at: new Date().toISOString(),
  };
}

function buildRows(articleId: string, source: ArticleSourceInput, result: ScrapeResult): PersistedCodeRow[] {
  const seenAt = new Date().toISOString();

  const activeRows = result.codes.map((entry) => ({
    article_id: articleId,
    game_name: source.gameName,
    provider: entry.provider,
    code: entry.code,
    status: "active" as const,
    rewards_text: entry.rewardsText ?? null,
    is_new: entry.isNew ?? false,
    last_seen_at: seenAt,
  }));

  const expiredRows = result.expiredCodes.map((entry) => ({
    article_id: articleId,
    game_name: source.gameName,
    provider: entry.provider,
    code: entry.code,
    status: "expired" as const,
    rewards_text: null,
    is_new: false,
    last_seen_at: seenAt,
  }));

  return [...activeRows, ...expiredRows];
}

async function upsertArticle(source: ArticleSourceInput): Promise<{ articleId: string; lastScrapedAt: string }> {
  const article = buildArticleRow(source);
  const { client, config } = createSupabaseClient();

  const { data, error } = await client
    .from(config.articlesTable)
    .upsert(article, { onConflict: "beebom_article_url" })
    .select("id,last_scraped_at")
    .single();

  if (error) {
    throw new Error(
      `Supabase upsert failed for ${config.schema}.${config.articlesTable}: ${error.message}`
    );
  }

  return {
    articleId: data.id as string,
    lastScrapedAt: String(data.last_scraped_at),
  };
}

export async function saveScrapeResultToSupabase(
  source: ArticleSourceInput,
  result: ScrapeResult
): Promise<SupabaseSaveSummary> {
  const { client, config } = createSupabaseClient();
  const { articleId } = await upsertArticle(source);
  const rows = buildRows(articleId, source, result);

  if (!rows.length) {
    return {
      schema: config.schema,
      articlesTable: config.articlesTable,
      table: config.table,
      keyType: config.keyType,
      articleId,
      attemptedUpserts: 0,
    };
  }

  const { error } = await client
    .from(config.table)
    .upsert(rows, { onConflict: "article_id,code" });

  if (error) {
    throw new Error(`Supabase upsert failed for ${config.schema}.${config.table}: ${error.message}`);
  }

  return {
    schema: config.schema,
    articlesTable: config.articlesTable,
    table: config.table,
    keyType: config.keyType,
    articleId,
    attemptedUpserts: rows.length,
  };
}
