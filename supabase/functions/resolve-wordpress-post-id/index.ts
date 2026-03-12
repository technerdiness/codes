type LookupStatus = "processing" | "resolved" | "not_found" | "error";
type WordPressEntityType = "post" | "page";

interface LookupPayload {
  articleId: string;
  ourArticleUrl: string;
}

interface WordPressEntity {
  id: number;
  link: string;
  slug: string;
  type: WordPressEntityType;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
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

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.search = "";

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url.toString();
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

async function updateArticleRow(
  articleId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const requestUrl = new URL(
    `/rest/v1/roblox_game_code_articles?id=eq.${encodeURIComponent(articleId)}`,
    supabaseUrl
  );

  const response = await fetch(requestUrl, {
    method: "PATCH",
    headers: {
      ...JSON_HEADERS,
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    throw new Error(`Supabase article update failed with status ${response.status}`);
  }
}

async function markLookupStatus(
  articleId: string,
  status: LookupStatus,
  patch?: Record<string, unknown>
): Promise<void> {
  await updateArticleRow(articleId, {
    wordpress_lookup_status: status,
    ...patch,
  });
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

  if (!payload?.articleId || !payload?.ourArticleUrl) {
    return jsonResponse(400, { error: "Missing articleId or ourArticleUrl" });
  }

  try {
    await markLookupStatus(payload.articleId, "processing", {
      wordpress_lookup_error: null,
      wordpress_lookup_completed_at: null,
    });

    const entity = await resolveWordPressEntity(payload.ourArticleUrl);

    if (!entity) {
      await markLookupStatus(payload.articleId, "not_found", {
        wordpress_lookup_error: `No WordPress post matched ${payload.ourArticleUrl}`,
        wordpress_lookup_completed_at: new Date().toISOString(),
      });

      return jsonResponse(404, {
        articleId: payload.articleId,
        resolved: false,
      });
    }

    await markLookupStatus(payload.articleId, "resolved", {
      wordpress_post_id: entity.id,
      wordpress_post_type: entity.type,
      wordpress_lookup_error: null,
      wordpress_lookup_completed_at: new Date().toISOString(),
    });

    return jsonResponse(200, {
      articleId: payload.articleId,
      resolved: true,
      wordpressPostId: entity.id,
      wordpressPostType: entity.type,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    try {
      await markLookupStatus(payload.articleId, "error", {
        wordpress_lookup_error: message,
        wordpress_lookup_completed_at: new Date().toISOString(),
      });
    } catch {
      // Ignore secondary update errors and return the original failure.
    }

    return jsonResponse(500, {
      articleId: payload.articleId,
      error: message,
    });
  }
});
