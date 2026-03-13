import type { ArticleSourceInput, ScrapeProvider, ScrapeResult } from "../../types/scraper.ts";
import { createSupabaseClient } from "./client.ts";

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

export interface StoredArticleSource extends ArticleSourceInput {
  articleId: string;
  lastScrapedAt: string | null;
  wordpressPostId: number | null;
  wordpressPostType: string | null;
  lastWordpressCodesHash: string | null;
  lastWordpressSyncAt: string | null;
  lastWordpressSyncError: string | null;
}

interface ArticleRow {
  game_name: string;
  our_article_url: string;
  beebom_article_url: string;
  source_provider: ScrapeProvider;
  last_scraped_at?: string;
}

interface UpsertArticleOptions {
  lastScrapedAt?: string;
}

function mergeRows(existing: PersistedCodeRow, incoming: PersistedCodeRow): PersistedCodeRow {
  const preferIncoming = incoming.status === "active" && existing.status !== "active";
  const base = preferIncoming ? incoming : existing;
  const other = preferIncoming ? existing : incoming;

  return {
    ...base,
    rewards_text: base.rewards_text ?? other.rewards_text,
    is_new: base.is_new || other.is_new,
    last_seen_at: incoming.last_seen_at,
  };
}

function buildArticleRow(source: ArticleSourceInput, options?: UpsertArticleOptions): ArticleRow {
  const row: ArticleRow = {
    game_name: source.gameName,
    our_article_url: source.ourArticleUrl,
    beebom_article_url: source.beebomArticleUrl,
    source_provider: "beebom",
  };

  if (options?.lastScrapedAt) {
    row.last_scraped_at = options.lastScrapedAt;
  }

  return row;
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

  const deduped = new Map<string, PersistedCodeRow>();

  [...activeRows, ...expiredRows].forEach((row) => {
    const key = `${row.article_id}::${row.code}`;
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, row);
      return;
    }

    deduped.set(key, mergeRows(existing, row));
  });

  return [...deduped.values()];
}

export async function upsertArticleSourceToSupabase(
  source: ArticleSourceInput,
  options?: UpsertArticleOptions
): Promise<{ articleId: string; lastScrapedAt: string | null }> {
  const article = buildArticleRow(source, options);
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
    lastScrapedAt: data.last_scraped_at ? String(data.last_scraped_at) : null,
  };
}

export async function listArticleSourcesFromSupabase(options?: {
  limit?: number;
  beebomArticleUrl?: string;
}): Promise<StoredArticleSource[]> {
  const { client, config } = createSupabaseClient();
  let query = client
    .from(config.articlesTable)
    .select(
      "id,game_name,our_article_url,beebom_article_url,last_scraped_at,wordpress_post_id,wordpress_post_type,last_wordpress_codes_hash,last_wordpress_sync_at,last_wordpress_sync_error"
    )
    .order("game_name", { ascending: true });

  if (options?.beebomArticleUrl) {
    query = query.eq("beebom_article_url", options.beebomArticleUrl);
  }

  if (typeof options?.limit === "number") {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Supabase read failed for ${config.schema}.${config.articlesTable}: ${error.message}`
    );
  }

  return (data ?? []).map((row) => ({
    articleId: String(row.id),
    gameName: String(row.game_name),
    ourArticleUrl: String(row.our_article_url),
    beebomArticleUrl: String(row.beebom_article_url),
    lastScrapedAt: row.last_scraped_at ? String(row.last_scraped_at) : null,
    wordpressPostId:
      typeof row.wordpress_post_id === "number"
        ? row.wordpress_post_id
        : row.wordpress_post_id
          ? Number(row.wordpress_post_id)
          : null,
    wordpressPostType: row.wordpress_post_type ? String(row.wordpress_post_type) : null,
    lastWordpressCodesHash: row.last_wordpress_codes_hash
      ? String(row.last_wordpress_codes_hash)
      : null,
    lastWordpressSyncAt: row.last_wordpress_sync_at ? String(row.last_wordpress_sync_at) : null,
    lastWordpressSyncError: row.last_wordpress_sync_error
      ? String(row.last_wordpress_sync_error)
      : null,
  }));
}

export async function updateArticleWordPressSyncState(input: {
  articleId: string;
  lastWordpressCodesHash?: string | null;
  lastWordpressSyncAt?: string | null;
  lastWordpressSyncError?: string | null;
}): Promise<void> {
  const { client, config } = createSupabaseClient();
  const patch: Record<string, string | null> = {};

  if ("lastWordpressCodesHash" in input) {
    patch.last_wordpress_codes_hash = input.lastWordpressCodesHash ?? null;
  }

  if ("lastWordpressSyncAt" in input) {
    patch.last_wordpress_sync_at = input.lastWordpressSyncAt ?? null;
  }

  if ("lastWordpressSyncError" in input) {
    patch.last_wordpress_sync_error = input.lastWordpressSyncError ?? null;
  }

  const { error } = await client
    .from(config.articlesTable)
    .update(patch)
    .eq("id", input.articleId);

  if (error) {
    throw new Error(
      `Supabase article update failed for ${config.schema}.${config.articlesTable}: ${error.message}`
    );
  }
}

export async function saveScrapeResultToSupabase(
  source: ArticleSourceInput,
  result: ScrapeResult
): Promise<SupabaseSaveSummary> {
  const { client, config } = createSupabaseClient();
  const { articleId } = await upsertArticleSourceToSupabase(source, {
    lastScrapedAt: new Date().toISOString(),
  });
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
