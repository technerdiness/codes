import type { ScrapeProvider, ScrapeResult } from "../types/scraper.ts";
import { createSupabaseClient } from "./client.ts";

type PersistedCodeStatus = "active" | "expired";

export type WordPressSiteKey = "technerdiness" | "gamingwize";

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

interface ArticleRow {
  id: string;
  game_name: string | null;
  source_beebom_url: string | null;
  technerdiness_article_url: string | null;
  gamingwize_article_url: string | null;
  last_scraped_at?: string | null;
}

interface SiteStateRow {
  article_id: string;
  wordpress_post_id: number | string | null;
  wordpress_post_type: string | null;
  last_wordpress_codes_hash: string | null;
  last_wordpress_sync_at: string | null;
  last_wordpress_sync_error: string | null;
}

export interface SupabaseSaveSummary {
  schema: string;
  articlesTable: string;
  table: string;
  keyType: "service_role" | "anon";
  articleId: string;
  attemptedUpserts: number;
}

export interface StoredWordPressSiteState {
  siteKey: WordPressSiteKey;
  articleUrl: string | null;
  wordpressPostId: number | null;
  wordpressPostType: string | null;
  lastWordpressCodesHash: string | null;
  lastWordpressSyncAt: string | null;
  lastWordpressSyncError: string | null;
}

export interface StoredArticleSource {
  articleId: string;
  gameName: string;
  sourceBeebomUrl: string;
  lastScrapedAt: string | null;
  siteStates: Record<WordPressSiteKey, StoredWordPressSiteState>;
}

const WORDPRESS_STATE_TABLES: Record<WordPressSiteKey, string> = {
  technerdiness: "technerdiness_wordpress_state",
  gamingwize: "gamingwize_wordpress_state",
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return value === null || value === undefined ? null : String(value);
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeGameName(value: unknown): string {
  return normalizeText(value) ?? "Unknown Game";
}

function normalizeWordPressPostId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getSiteArticleUrl(row: ArticleRow, siteKey: WordPressSiteKey): string | null {
  return siteKey === "technerdiness"
    ? normalizeText(row.technerdiness_article_url)
    : normalizeText(row.gamingwize_article_url);
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

function buildRows(articleId: string, gameName: string, result: ScrapeResult): PersistedCodeRow[] {
  const seenAt = new Date().toISOString();

  const activeRows = result.codes.map((entry) => ({
    article_id: articleId,
    game_name: gameName,
    provider: entry.provider,
    code: entry.code,
    status: "active" as const,
    rewards_text: entry.rewardsText ?? null,
    is_new: entry.isNew ?? false,
    last_seen_at: seenAt,
  }));

  const expiredRows = result.expiredCodes.map((entry) => ({
    article_id: articleId,
    game_name: gameName,
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

async function loadSiteStateRows(
  tableName: string,
  articleIds: string[]
): Promise<Record<string, SiteStateRow>> {
  if (!articleIds.length) {
    return {};
  }

  const { client, config } = createSupabaseClient();
  const { data, error } = await client
    .from(tableName)
    .select(
      "article_id,wordpress_post_id,wordpress_post_type,last_wordpress_codes_hash,last_wordpress_sync_at,last_wordpress_sync_error"
    )
    .in("article_id", articleIds);

  if (error) {
    throw new Error(`Supabase read failed for ${config.schema}.${tableName}: ${error.message}`);
  }

  return ((data ?? []) as SiteStateRow[]).reduce<Record<string, SiteStateRow>>((acc, row) => {
    acc[String(row.article_id)] = row;
    return acc;
  }, {});
}

function buildStoredSiteState(
  siteKey: WordPressSiteKey,
  articleUrl: string | null,
  row?: SiteStateRow
): StoredWordPressSiteState {
  return {
    siteKey,
    articleUrl,
    wordpressPostId: normalizeWordPressPostId(row?.wordpress_post_id),
    wordpressPostType: normalizeText(row?.wordpress_post_type),
    lastWordpressCodesHash: normalizeText(row?.last_wordpress_codes_hash),
    lastWordpressSyncAt: normalizeText(row?.last_wordpress_sync_at),
    lastWordpressSyncError: normalizeText(row?.last_wordpress_sync_error),
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
      "id,game_name,source_beebom_url,technerdiness_article_url,gamingwize_article_url,last_scraped_at"
    )
    .not("source_beebom_url", "is", null)
    .order("game_name", { ascending: true });

  if (options?.beebomArticleUrl) {
    query = query.eq("source_beebom_url", options.beebomArticleUrl);
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

  const articleRows = (data ?? []) as ArticleRow[];
  const articleIds = articleRows.map((row) => String(row.id));

  const [techNerdinessRows, gamingWizeRows] = await Promise.all([
    loadSiteStateRows(WORDPRESS_STATE_TABLES.technerdiness, articleIds),
    loadSiteStateRows(WORDPRESS_STATE_TABLES.gamingwize, articleIds),
  ]);

  return articleRows
    .map((row) => {
      const sourceBeebomUrl = normalizeText(row.source_beebom_url);
      if (!sourceBeebomUrl) {
        return null;
      }

      const articleId = String(row.id);
      const technerdinessArticleUrl = getSiteArticleUrl(row, "technerdiness");
      const gamingwizeArticleUrl = getSiteArticleUrl(row, "gamingwize");

      return {
        articleId,
        gameName: normalizeGameName(row.game_name),
        sourceBeebomUrl,
        lastScrapedAt: normalizeText(row.last_scraped_at),
        siteStates: {
          technerdiness: buildStoredSiteState(
            "technerdiness",
            technerdinessArticleUrl,
            techNerdinessRows[articleId]
          ),
          gamingwize: buildStoredSiteState(
            "gamingwize",
            gamingwizeArticleUrl,
            gamingWizeRows[articleId]
          ),
        },
      };
    })
    .filter((row): row is StoredArticleSource => row !== null);
}

export async function updateSiteWordPressSyncState(input: {
  articleId: string;
  siteKey: WordPressSiteKey;
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

  if (!Object.keys(patch).length) {
    return;
  }

  const { error } = await client
    .from(WORDPRESS_STATE_TABLES[input.siteKey])
    .upsert(
      {
        article_id: input.articleId,
        ...patch,
      },
      { onConflict: "article_id" }
    );

  if (error) {
    throw new Error(
      `Supabase article update failed for ${config.schema}.${WORDPRESS_STATE_TABLES[input.siteKey]}: ${error.message}`
    );
  }
}

export async function saveScrapeResultToSupabase(
  article: Pick<StoredArticleSource, "articleId" | "gameName">,
  result: ScrapeResult
): Promise<SupabaseSaveSummary> {
  const { client, config } = createSupabaseClient();
  const lastScrapedAt = new Date().toISOString();
  const rows = buildRows(article.articleId, article.gameName, result);

  const { error: articleError } = await client
    .from(config.articlesTable)
    .update({ last_scraped_at: lastScrapedAt })
    .eq("id", article.articleId);

  if (articleError) {
    throw new Error(
      `Supabase article update failed for ${config.schema}.${config.articlesTable}: ${articleError.message}`
    );
  }

  if (!rows.length) {
    return {
      schema: config.schema,
      articlesTable: config.articlesTable,
      table: config.table,
      keyType: config.keyType,
      articleId: article.articleId,
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
    articleId: article.articleId,
    attemptedUpserts: rows.length,
  };
}
