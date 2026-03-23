const SITE_STATE_TABLES = {
  technerdiness: "technerdiness_wordpress_state",
  gamingwize: "gamingwize_wordpress_state",
};

export function getEnvConfig() {
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim() || "",
    serviceRoleKey: import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      "",
    syncCodesSecret: import.meta.env.VITE_SYNC_CODES_SECRET?.trim() || "",
    resolveSecret: import.meta.env.VITE_RESOLVE_SECRET?.trim() || "",
    syncLetrosoSecret: import.meta.env.VITE_SYNC_LETROSO_SECRET?.trim() || "",
    nytPuzzlesSecret: import.meta.env.VITE_NYT_PUZZLES_SECRET?.trim() || "",
  };
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, "");
}

function buildAdminHeaders(config, options = {}) {
  const headers = {
    Accept: "application/json",
    apikey: config.serviceRoleKey.trim(),
    Authorization: `Bearer ${config.serviceRoleKey.trim()}`,
  };

  if (options.json) {
    headers["Content-Type"] = "application/json";
  }

  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  return headers;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === "string"
      ? payload
      : payload?.message || payload?.error || JSON.stringify(payload);
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return payload;
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return value == null ? "" : String(value);
  }

  return value.trim();
}

function normalizeOptionalText(value) {
  const trimmed = normalizeText(value);
  return trimmed ? trimmed : null;
}

function buildRestUrl(baseUrl, table, params) {
  const url = new URL(`/rest/v1/${table}`, `${normalizeBaseUrl(baseUrl)}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

function buildSiteState(articleRow, stateRow, siteKey) {
  const articleUrl = normalizeText(
    siteKey === "technerdiness"
      ? articleRow.technerdiness_article_url
      : articleRow.gamingwize_article_url,
  );

  return {
    siteKey,
    articleUrl,
    wordpressPostId: stateRow?.wordpress_post_id ?? null,
    wordpressPostType: normalizeText(stateRow?.wordpress_post_type),
    lookupStatus: articleUrl
      ? normalizeText(stateRow?.wordpress_lookup_status) || "pending"
      : "idle",
    lookupError: normalizeText(stateRow?.wordpress_lookup_error),
    lookupRequestedAt: stateRow?.wordpress_lookup_requested_at || "",
    lookupCompletedAt: stateRow?.wordpress_lookup_completed_at || "",
    lastWordpressCodesHash: normalizeText(stateRow?.last_wordpress_codes_hash),
    lastWordpressSyncAt: stateRow?.last_wordpress_sync_at || "",
    lastWordpressSyncError: normalizeText(stateRow?.last_wordpress_sync_error),
  };
}

async function fetchArticles(config) {
  const url = buildRestUrl(config.supabaseUrl, "roblox_game_code_articles", {
    select:
      "id,game_name,status,source_provider,source_beebom_url,technerdiness_article_url,gamingwize_article_url,last_scraped_at,created_at,updated_at",
    order: "game_name.asc",
    limit: "1000",
  });

  return requestJson(url, {
    headers: buildAdminHeaders(config),
  });
}

async function fetchSiteStates(config, siteKey) {
  const url = buildRestUrl(config.supabaseUrl, SITE_STATE_TABLES[siteKey], {
    select:
      "article_id,wordpress_post_id,wordpress_post_type,wordpress_lookup_status,wordpress_lookup_error,wordpress_lookup_requested_at,wordpress_lookup_completed_at,last_wordpress_codes_hash,last_wordpress_sync_at,last_wordpress_sync_error",
    limit: "1000",
  });

  const rows = await requestJson(url, {
    headers: buildAdminHeaders(config),
  });

  return rows.reduce((acc, row) => {
    acc[row.article_id] = row;
    return acc;
  }, {});
}

export async function loadDashboardData(config) {
  const [articleRows, techStates, gamingStates] = await Promise.all([
    fetchArticles(config),
    fetchSiteStates(config, "technerdiness"),
    fetchSiteStates(config, "gamingwize"),
  ]);

  return articleRows.map((row) => ({
    id: row.id,
    gameName: normalizeText(row.game_name),
    status: normalizeText(row.status) || "draft",
    sourceProvider: normalizeText(row.source_provider) || "beebom",
    sourceBeebomUrl: normalizeText(row.source_beebom_url),
    technerdinessArticleUrl: normalizeText(row.technerdiness_article_url),
    gamingwizeArticleUrl: normalizeText(row.gamingwize_article_url),
    lastScrapedAt: row.last_scraped_at || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    siteStates: {
      technerdiness: buildSiteState(row, techStates[row.id], "technerdiness"),
      gamingwize: buildSiteState(row, gamingStates[row.id], "gamingwize"),
    },
  }));
}

export async function saveArticle(config, formState) {
  const payload = {
    game_name: normalizeOptionalText(formState.gameName),
    status: normalizeText(formState.status) || "draft",
    source_provider: "beebom",
    source_beebom_url: normalizeOptionalText(formState.sourceBeebomUrl),
    technerdiness_article_url: normalizeOptionalText(
      formState.technerdinessArticleUrl,
    ),
    gamingwize_article_url: normalizeOptionalText(
      formState.gamingwizeArticleUrl,
    ),
  };

  if (
    !payload.game_name && !payload.source_beebom_url &&
    !payload.technerdiness_article_url && !payload.gamingwize_article_url
  ) {
    throw new Error(
      "Add at least one meaningful field before saving the article row.",
    );
  }

  const articleId = normalizeText(formState.id);
  const url = articleId
    ? buildRestUrl(config.supabaseUrl, "roblox_game_code_articles", {
      select:
        "id,game_name,status,source_provider,source_beebom_url,technerdiness_article_url,gamingwize_article_url,last_scraped_at,created_at,updated_at",
      id: `eq.${articleId}`,
    })
    : buildRestUrl(config.supabaseUrl, "roblox_game_code_articles", {
      select:
        "id,game_name,status,source_provider,source_beebom_url,technerdiness_article_url,gamingwize_article_url,last_scraped_at,created_at,updated_at",
    });

  const rows = await requestJson(url, {
    method: articleId ? "PATCH" : "POST",
    headers: buildAdminHeaders(config, {
      json: true,
      prefer: "return=representation",
    }),
    body: JSON.stringify(payload),
  });

  return rows[0];
}

export async function invokeFunction(
  config,
  functionName,
  webhookSecret,
  payload = {},
) {
  if (!normalizeText(webhookSecret)) {
    throw new Error(`Missing webhook secret for ${functionName}.`);
  }

  const url = new URL(
    `/functions/v1/${functionName}`,
    `${normalizeBaseUrl(config.supabaseUrl)}/`,
  );
  return requestJson(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": webhookSecret.trim(),
    },
    body: JSON.stringify(payload),
  });
}
