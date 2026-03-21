type LookupStatus = "processing" | "resolved" | "not_found" | "error";
type WordPressEntityType = "post" | "page";
type SiteKey = "technerdiness" | "gamingwize";
type SiteLookupResultStatus = LookupStatus | "skipped";

interface LookupPayload {
  articleId: string;
  technerdinessArticleUrl?: string;
  gamingwizeArticleUrl?: string;
  ourArticleUrl?: string;
}

interface WordPressEntity {
  id: number;
  link: string;
  slug: string;
  type: WordPressEntityType;
}

interface ArticleRecord {
  id: string;
  technerdinessArticleUrl: string | null;
  gamingwizeArticleUrl: string | null;
}

interface SiteLookupResult {
  siteKey: SiteKey;
  articleUrl: string | null;
  status: SiteLookupResultStatus;
  resolved: boolean;
  wordpressPostId: number | null;
  wordpressPostType: WordPressEntityType | null;
  reason?: string;
  error?: string;
}

const JSON_HEADERS = { "Content-Type": "application/json" };
const SITE_KEYS = ["technerdiness", "gamingwize"] as const;
const SITE_STATE_TABLES: Record<SiteKey, string> = {
  technerdiness: "technerdiness_wordpress_state",
  gamingwize: "gamingwize_wordpress_state",
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: JSON_HEADERS,
  });
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getSupabaseConfig(): { supabaseUrl: string; serviceRoleKey: string } {
  return {
    supabaseUrl: getRequiredEnv("SUPABASE_URL"),
    serviceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function getSupabaseHeaders(serviceRoleKey: string, prefer?: string): HeadersInit {
  const headers: Record<string, string> = {
    ...JSON_HEADERS,
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  if (prefer) {
    headers.Prefer = prefer;
  }

  return headers;
}

async function describeFailedResponse(response: Response): Promise<string> {
  const text = await response.text();
  return text
    ? `${response.status} ${response.statusText}: ${text}`
    : `${response.status} ${response.statusText}`;
}

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url.toString();
}

function trimOptionalUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function deriveSlugFromArticleUrl(articleUrl: string): string {
  const url = new URL(articleUrl);
  const slug = url.pathname.split("/").filter(Boolean).pop();

  if (!slug) {
    throw new Error(`Could not derive a WordPress slug from URL: ${articleUrl}`);
  }

  return slug;
}

async function fetchWordPressEntities(
  articleUrl: string,
  endpoint: "posts" | "pages"
): Promise<WordPressEntity[]> {
  const origin = new URL(articleUrl).origin;
  const slug = deriveSlugFromArticleUrl(articleUrl);
  const requestUrl = new URL(`/wp-json/wp/v2/${endpoint}`, origin);
  requestUrl.searchParams.set("slug", slug);
  requestUrl.searchParams.set("_fields", "id,link,slug,type");
  requestUrl.searchParams.set("per_page", "10");

  const response = await fetch(requestUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`WordPress ${endpoint} lookup failed with status ${response.status}`);
  }

  const data = (await response.json()) as WordPressEntity[];
  return Array.isArray(data) ? data : [];
}

function chooseWordPressEntity(
  articleUrl: string,
  entities: WordPressEntity[]
): WordPressEntity | null {
  if (!entities.length) {
    return null;
  }

  const normalizedTarget = normalizeUrl(articleUrl);
  const exact = entities.find((entity) => normalizeUrl(entity.link) === normalizedTarget);
  if (exact) {
    return exact;
  }

  if (entities.length === 1) {
    return entities[0];
  }

  return null;
}

async function resolveWordPressEntity(articleUrl: string): Promise<WordPressEntity | null> {
  const posts = await fetchWordPressEntities(articleUrl, "posts");
  const exactPost = chooseWordPressEntity(articleUrl, posts);
  if (exactPost) {
    return exactPost;
  }

  const pages = await fetchWordPressEntities(articleUrl, "pages");
  const exactPage = chooseWordPressEntity(articleUrl, pages);
  if (exactPage) {
    return exactPage;
  }

  const combined = [...posts, ...pages];
  return combined.length === 1 ? combined[0] : null;
}

async function fetchArticleRecord(articleId: string): Promise<ArticleRecord | null> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const requestUrl = new URL("/rest/v1/roblox_game_code_articles", supabaseUrl);
  requestUrl.searchParams.set("select", "id,technerdiness_article_url,gamingwize_article_url");
  requestUrl.searchParams.set("id", `eq.${articleId}`);
  requestUrl.searchParams.set("limit", "1");

  const response = await fetch(requestUrl, {
    headers: getSupabaseHeaders(serviceRoleKey),
  });

  if (!response.ok) {
    throw new Error(`Supabase article read failed: ${await describeFailedResponse(response)}`);
  }

  const rows = (await response.json()) as Array<Record<string, unknown>>;
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: String(row.id),
    technerdinessArticleUrl: trimOptionalUrl(
      typeof row.technerdiness_article_url === "string" ? row.technerdiness_article_url : null
    ),
    gamingwizeArticleUrl: trimOptionalUrl(
      typeof row.gamingwize_article_url === "string" ? row.gamingwize_article_url : null
    ),
  };
}

async function upsertSiteState(
  siteKey: SiteKey,
  articleId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const requestUrl = new URL(`/rest/v1/${SITE_STATE_TABLES[siteKey]}`, supabaseUrl);
  requestUrl.searchParams.set("on_conflict", "article_id");

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: getSupabaseHeaders(serviceRoleKey, "resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify({
      article_id: articleId,
      ...patch,
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase ${siteKey} state upsert failed: ${await describeFailedResponse(response)}`);
  }
}

async function markSiteProcessing(
  siteKey: SiteKey,
  articleId: string,
  requestedAt: string
): Promise<void> {
  await upsertSiteState(siteKey, articleId, {
    wordpress_post_id: null,
    wordpress_post_type: null,
    wordpress_lookup_status: "processing",
    wordpress_lookup_error: null,
    wordpress_lookup_requested_at: requestedAt,
    wordpress_lookup_completed_at: null,
    last_wordpress_codes_hash: null,
    last_wordpress_sync_at: null,
    last_wordpress_sync_error: null,
  });
}

async function clearSiteState(siteKey: SiteKey, articleId: string): Promise<void> {
  await upsertSiteState(siteKey, articleId, {
    wordpress_post_id: null,
    wordpress_post_type: null,
    wordpress_lookup_status: "pending",
    wordpress_lookup_error: null,
    wordpress_lookup_requested_at: null,
    wordpress_lookup_completed_at: null,
    last_wordpress_codes_hash: null,
    last_wordpress_sync_at: null,
    last_wordpress_sync_error: null,
  });
}

async function markSiteResolved(
  siteKey: SiteKey,
  articleId: string,
  entity: WordPressEntity,
  completedAt: string
): Promise<void> {
  await upsertSiteState(siteKey, articleId, {
    wordpress_post_id: entity.id,
    wordpress_post_type: entity.type,
    wordpress_lookup_status: "resolved",
    wordpress_lookup_error: null,
    wordpress_lookup_completed_at: completedAt,
  });
}

async function markSiteNotFound(
  siteKey: SiteKey,
  articleId: string,
  articleUrl: string,
  completedAt: string
): Promise<void> {
  await upsertSiteState(siteKey, articleId, {
    wordpress_post_id: null,
    wordpress_post_type: null,
    wordpress_lookup_status: "not_found",
    wordpress_lookup_error: `No WordPress post matched ${articleUrl}`,
    wordpress_lookup_completed_at: completedAt,
    last_wordpress_codes_hash: null,
    last_wordpress_sync_at: null,
    last_wordpress_sync_error: null,
  });
}

async function markSiteError(
  siteKey: SiteKey,
  articleId: string,
  errorMessage: string,
  completedAt: string
): Promise<void> {
  await upsertSiteState(siteKey, articleId, {
    wordpress_post_id: null,
    wordpress_post_type: null,
    wordpress_lookup_status: "error",
    wordpress_lookup_error: errorMessage,
    wordpress_lookup_completed_at: completedAt,
    last_wordpress_codes_hash: null,
    last_wordpress_sync_at: null,
    last_wordpress_sync_error: null,
  });
}

async function resolveSiteArticle(
  siteKey: SiteKey,
  articleId: string,
  articleUrl: string | null
): Promise<SiteLookupResult> {
  if (!articleUrl) {
    await clearSiteState(siteKey, articleId);
    return {
      siteKey,
      articleUrl: null,
      status: "skipped",
      resolved: false,
      wordpressPostId: null,
      wordpressPostType: null,
      reason: "missing_article_url",
    };
  }

  const requestedAt = new Date().toISOString();
  await markSiteProcessing(siteKey, articleId, requestedAt);

  try {
    const entity = await resolveWordPressEntity(articleUrl);

    if (!entity) {
      const completedAt = new Date().toISOString();
      await markSiteNotFound(siteKey, articleId, articleUrl, completedAt);
      return {
        siteKey,
        articleUrl,
        status: "not_found",
        resolved: false,
        wordpressPostId: null,
        wordpressPostType: null,
        reason: "not_found",
      };
    }

    const completedAt = new Date().toISOString();
    await markSiteResolved(siteKey, articleId, entity, completedAt);
    return {
      siteKey,
      articleUrl,
      status: "resolved",
      resolved: true,
      wordpressPostId: entity.id,
      wordpressPostType: entity.type,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const completedAt = new Date().toISOString();
    await markSiteError(siteKey, articleId, message, completedAt);
    return {
      siteKey,
      articleUrl,
      status: "error",
      resolved: false,
      wordpressPostId: null,
      wordpressPostType: null,
      error: message,
    };
  }
}

function isAuthorized(req: Request): boolean {
  const expected = Deno.env.get("WORDPRESS_LOOKUP_WEBHOOK_SECRET")?.trim();
  const received = req.headers.get("X-Webhook-Secret")?.trim();

  return Boolean(expected && received && expected === received);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  let payload: LookupPayload;

  try {
    payload = (await req.json()) as LookupPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  if (!payload?.articleId) {
    return jsonResponse(400, { error: "Missing articleId" });
  }

  try {
    const article = await fetchArticleRecord(payload.articleId);
    if (!article) {
      return jsonResponse(404, {
        articleId: payload.articleId,
        error: "Article not found",
      });
    }

    const articleUrls: Record<SiteKey, string | null> = {
      technerdiness:
        trimOptionalUrl(payload.technerdinessArticleUrl) ??
        article.technerdinessArticleUrl ??
        trimOptionalUrl(payload.ourArticleUrl),
      gamingwize:
        trimOptionalUrl(payload.gamingwizeArticleUrl) ?? article.gamingwizeArticleUrl,
    };

    const results = await Promise.all(
      SITE_KEYS.map((siteKey) => resolveSiteArticle(siteKey, article.id, articleUrls[siteKey]))
    );

    const resolvedCount = results.filter((result) => result.resolved).length;
    const errorResults = results.filter((result) => result.status === "error");
    const configuredCount = results.filter((result) => result.articleUrl).length;

    const responseBody = {
      articleId: article.id,
      resolved: resolvedCount > 0,
      configuredSites: configuredCount,
      resolvedSites: resolvedCount,
      sites: results,
    };

    if (errorResults.length) {
      return jsonResponse(500, {
        ...responseBody,
        error: "One or more site lookups failed",
      });
    }

    if (resolvedCount > 0) {
      return jsonResponse(200, responseBody);
    }

    if (configuredCount === 0) {
      return jsonResponse(200, {
        ...responseBody,
        reason: "No Tech Nerdiness or Gaming Wize article URL is configured for this row",
      });
    }

    return jsonResponse(404, responseBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return jsonResponse(500, {
      articleId: payload.articleId,
      error: message,
    });
  }
});
