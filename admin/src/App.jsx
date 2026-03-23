import { useDeferredValue, useEffect, useState } from "react";

import {
  getEnvConfig,
  invokeFunction,
  loadDashboardData,
  saveArticle,
} from "./lib/api.js";

const APP_CONFIG = getEnvConfig();

const EMPTY_EDITOR = {
  id: "",
  gameName: "",
  status: "active",
  sourceBeebomUrl: "",
  technerdinessArticleUrl: "",
  gamingwizeArticleUrl: "",
};

const NAV_ITEMS = [
  { id: "automations", label: "Automations" },
  { id: "articles", label: "Code Articles" },
];

function formatDateTime(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function truncate(value, maxLength = 54) {
  if (!value || value.length <= maxLength) {
    return value || "";
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function normalizeSearchText(value) {
  return value.trim().toLowerCase();
}

function normalizeComparableUrl(value) {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function mapArticleToEditor(article) {
  return {
    id: article.id,
    gameName: article.gameName,
    status: article.status || "active",
    sourceBeebomUrl: article.sourceBeebomUrl,
    technerdinessArticleUrl: article.technerdinessArticleUrl,
    gamingwizeArticleUrl: article.gamingwizeArticleUrl,
  };
}

function findDuplicateArticle(articles, editor) {
  const checks = [
    {
      editorValue: editor.sourceBeebomUrl,
      articleKey: "sourceBeebomUrl",
      label: "Beebom URL",
    },
    {
      editorValue: editor.technerdinessArticleUrl,
      articleKey: "technerdinessArticleUrl",
      label: "Tech Nerdiness URL",
    },
    {
      editorValue: editor.gamingwizeArticleUrl,
      articleKey: "gamingwizeArticleUrl",
      label: "Gaming Wize URL",
    },
  ];

  for (const check of checks) {
    if (!check.editorValue.trim()) {
      continue;
    }

    const target = normalizeComparableUrl(check.editorValue);
    const match = articles.find((article) => {
      if (editor.id && article.id === editor.id) {
        return false;
      }

      const current = article[check.articleKey];
      return current && normalizeComparableUrl(current) === target;
    });

    if (match) {
      return {
        article: match,
        fieldLabel: check.label,
      };
    }
  }

  return null;
}

function sortArticles(articles, sortMode) {
  const next = [...articles];

  next.sort((left, right) => {
    if (sortMode === "game_asc") {
      return left.gameName.localeCompare(right.gameName);
    }

    if (sortMode === "game_desc") {
      return right.gameName.localeCompare(left.gameName);
    }

    if (sortMode === "status") {
      return left.status.localeCompare(right.status) ||
        left.gameName.localeCompare(right.gameName);
    }

    const leftValue = left.updatedAt || "";
    const rightValue = right.updatedAt || "";
    return rightValue.localeCompare(leftValue) ||
      left.gameName.localeCompare(right.gameName);
  });

  return next;
}

function getMissingEnvLabels(config) {
  const required = [
    ["supabaseUrl", "VITE_SUPABASE_URL"],
    ["serviceRoleKey", "VITE_SUPABASE_SERVICE_ROLE_KEY"],
    ["syncCodesSecret", "VITE_SYNC_CODES_SECRET"],
    ["resolveSecret", "VITE_RESOLVE_SECRET"],
  ];

  return required
    .filter(([key]) => !config[key])
    .map(([, label]) => label);
}

function StatusPill({ tone, children }) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}

function Sidebar({ currentView, onChange, envReady }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <p className="sidebar__eyebrow">Internal</p>
        <h1>Codes Admin</h1>
        <p className="sidebar__caption">
          Minimal dashboard for automations and code article mappings.
        </p>
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar__nav-button ${
              currentView === item.id ? "is-active" : ""
            }`}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar__meta">
        <StatusPill tone={envReady ? "ok" : "danger"}>
          {envReady ? "env ready" : "env missing"}
        </StatusPill>
      </div>
    </aside>
  );
}

function AutomationCard({
  title,
  description,
  onDryRun,
  onRealRun,
  dryDisabled,
  realDisabled,
}) {
  return (
    <section className="automation-card">
      <div className="automation-card__copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="automation-card__actions">
        <button
          type="button"
          className="button button--secondary"
          onClick={onDryRun}
          disabled={dryDisabled}
        >
          Dry Run
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={onRealRun}
          disabled={realDisabled}
        >
          Run
        </button>
      </div>
    </section>
  );
}

function ArticleRow({
  article,
  isSelected,
  isBusy,
  onEdit,
  onResolve,
  onSyncDryRun,
  onSyncReal,
}) {
  const techState = article.siteStates.technerdiness;
  const gamingState = article.siteStates.gamingwize;

  return (
    <tr className={isSelected ? "is-selected" : ""}>
      <td>
        <div className="table-game">
          <strong>{article.gameName}</strong>
          <span>{article.id}</span>
        </div>
      </td>
      <td>
        <StatusPill tone={article.status === "active" ? "ok" : "warn"}>
          {article.status}
        </StatusPill>
      </td>
      <td>
        {article.sourceBeebomUrl
          ? (
            <a href={article.sourceBeebomUrl} target="_blank" rel="noreferrer">
              {truncate(article.sourceBeebomUrl)}
            </a>
          )
          : <span className="table-missing">Missing</span>}
      </td>
      <td>
        <div className="table-game">
          {article.technerdinessArticleUrl
            ? (
              <a
                href={article.technerdinessArticleUrl}
                target="_blank"
                rel="noreferrer"
              >
                {truncate(article.technerdinessArticleUrl)}
              </a>
            )
            : <span className="table-missing">Missing</span>}
          <span>{techState.wordpressPostId || "-"}</span>
        </div>
      </td>
      <td>
        <div className="table-game">
          {article.gamingwizeArticleUrl
            ? (
              <a
                href={article.gamingwizeArticleUrl}
                target="_blank"
                rel="noreferrer"
              >
                {truncate(article.gamingwizeArticleUrl)}
              </a>
            )
            : <span className="table-missing">Missing</span>}
          <span>{gamingState.wordpressPostId || "-"}</span>
        </div>
      </td>
      <td>{formatDateTime(article.updatedAt)}</td>
      <td>
        <div className="table-actions">
          <button
            type="button"
            className="table-button"
            onClick={() => onEdit(article)}
          >
            Edit
          </button>
          <button
            type="button"
            className="table-button"
            onClick={() => onResolve(article)}
            disabled={isBusy}
          >
            Resolve
          </button>
          <button
            type="button"
            className="table-button"
            onClick={() => onSyncDryRun(article)}
            disabled={isBusy || !article.sourceBeebomUrl}
          >
            Dry
          </button>
          <button
            type="button"
            className="table-button table-button--primary"
            onClick={() => onSyncReal(article)}
            disabled={isBusy || !article.sourceBeebomUrl}
          >
            Run
          </button>
        </div>
      </td>
    </tr>
  );
}

function EditorPanel({
  editor,
  onChange,
  onClose,
  onSave,
  isSaving,
  duplicateSuggestion,
  onOpenDuplicate,
}) {
  return (
    <aside className="editor-panel">
      <div className="editor-panel__header">
        <div>
          <p className="section-label">{editor.id ? "Edit Row" : "Add New"}</p>
          <h2>{editor.id ? "Edit Code Article" : "Create Code Article"}</h2>
        </div>
        <button
          type="button"
          className="button button--secondary"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {duplicateSuggestion
        ? (
          <div className="duplicate-callout">
            <p>
              This {duplicateSuggestion.fieldLabel} already exists on{" "}
              <strong>{duplicateSuggestion.article.gameName}</strong>.
            </p>
            <button
              type="button"
              className="button button--secondary"
              onClick={onOpenDuplicate}
            >
              Edit Existing Row
            </button>
          </div>
        )
        : null}

      <form
        className="editor-form"
        onSubmit={onSave}
      >
        <label>
          <span>Game Name</span>
          <input
            value={editor.gameName}
            onChange={(event) => onChange("gameName", event.target.value)}
            placeholder="Anime Fighting Simulator Endless"
          />
        </label>

        <label>
          <span>Status</span>
          <select
            value={editor.status}
            onChange={(event) => onChange("status", event.target.value)}
          >
            <option value="active">active</option>
            <option value="draft">draft</option>
            <option value="archived">archived</option>
          </select>
        </label>

        <label>
          <span>Beebom URL</span>
          <input
            value={editor.sourceBeebomUrl}
            onChange={(event) =>
              onChange("sourceBeebomUrl", event.target.value)}
            placeholder="https://beebom.com/example-codes/"
          />
        </label>

        <label>
          <span>Tech Nerdiness URL</span>
          <input
            value={editor.technerdinessArticleUrl}
            onChange={(event) =>
              onChange("technerdinessArticleUrl", event.target.value)}
            placeholder="https://www.technerdiness.com/roblox/example-codes/"
          />
        </label>

        <label>
          <span>Gaming Wize URL</span>
          <input
            value={editor.gamingwizeArticleUrl}
            onChange={(event) =>
              onChange("gamingwizeArticleUrl", event.target.value)}
            placeholder="https://www.gamingwize.com/roblox/example-codes/"
          />
        </label>

        <button
          type="submit"
          className="button button--primary"
          disabled={isSaving || Boolean(duplicateSuggestion)}
        >
          {isSaving ? "Saving..." : editor.id ? "Save Changes" : "Create Row"}
        </button>
      </form>
    </aside>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState("automations");
  const [articles, setArticles] = useState([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [dataError, setDataError] = useState("");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState("updated_desc");
  const [editor, setEditor] = useState(EMPTY_EDITOR);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [savingArticle, setSavingArticle] = useState(false);
  const [busyMap, setBusyMap] = useState({});
  const [lastAction, setLastAction] = useState(null);
  const deferredSearch = useDeferredValue(search);

  const missingEnvLabels = getMissingEnvLabels(APP_CONFIG);
  const envReady = missingEnvLabels.length === 0;

  async function refreshArticles() {
    if (!APP_CONFIG.supabaseUrl || !APP_CONFIG.serviceRoleKey) {
      return;
    }

    setLoadingArticles(true);
    setDataError("");

    try {
      const nextArticles = await loadDashboardData(APP_CONFIG);
      setArticles(nextArticles);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingArticles(false);
    }
  }

  useEffect(() => {
    refreshArticles();
  }, []);

  function setBusy(key, isBusy) {
    setBusyMap((current) => ({
      ...current,
      [key]: isBusy,
    }));
  }

  function recordAction(status, title, payload) {
    setLastAction({
      id: crypto.randomUUID(),
      status,
      title,
      payload,
      createdAt: new Date().toISOString(),
    });
  }

  async function runAction({ busyKey, title, runner, refresh = false }) {
    setBusy(busyKey, true);

    try {
      const result = await runner();
      recordAction("success", title, result);
      if (refresh) {
        await refreshArticles();
      }
    } catch (error) {
      recordAction(
        "error",
        title,
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setBusy(busyKey, false);
    }
  }

  function updateEditorField(field, value) {
    setEditor((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openNewEditor() {
    setSelectedArticleId("");
    setEditor(EMPTY_EDITOR);
    setEditorOpen(true);
  }

  function openEditArticle(article) {
    setSelectedArticleId(article.id);
    setEditor(mapArticleToEditor(article));
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
  }

  const duplicateSuggestion = findDuplicateArticle(articles, editor);

  async function handleSaveArticle(event) {
    event.preventDefault();

    if (duplicateSuggestion) {
      recordAction(
        "error",
        "Create or update code article",
        `Duplicate ${duplicateSuggestion.fieldLabel} found on ${duplicateSuggestion.article.gameName}. Open that row instead.`,
      );
      return;
    }

    setSavingArticle(true);

    try {
      const saved = await saveArticle(APP_CONFIG, editor);
      recordAction(
        "success",
        editor.id ? "Updated article row" : "Created article row",
        saved,
      );
      await refreshArticles();

      const match = articles.find((article) => article.id === saved.id);
      if (match) {
        openEditArticle(match);
      } else {
        setSelectedArticleId(saved.id);
      }
    } catch (error) {
      recordAction(
        "error",
        "Create or update code article",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSavingArticle(false);
    }
  }

  function confirmRealRun(message) {
    return window.confirm(`${message}\n\nThis will perform a real update.`);
  }

  function runResolve(article) {
    runAction({
      busyKey: `resolve:${article.id}`,
      title: `Resolve WordPress IDs for ${article.gameName}`,
      runner: () =>
        invokeFunction(
          APP_CONFIG,
          "resolve-wordpress-post-id",
          APP_CONFIG.resolveSecret,
          {
            articleId: article.id,
          },
        ),
      refresh: true,
    });
  }

  function runArticleSync(article, dryRun) {
    if (!article.sourceBeebomUrl) {
      recordAction("error", `Sync ${article.gameName}`, "Missing Beebom URL.");
      return;
    }

    if (!dryRun && !confirmRealRun(`Run real sync for ${article.gameName}?`)) {
      return;
    }

    runAction({
      busyKey: `sync:${article.id}:${dryRun ? "dry" : "real"}`,
      title: `${dryRun ? "Dry run" : "Real sync"} for ${article.gameName}`,
      runner: () =>
        invokeFunction(
          APP_CONFIG,
          "sync-codes",
          APP_CONFIG.syncCodesSecret,
          dryRun
            ? { beebomArticleUrl: article.sourceBeebomUrl, dryRun: true }
            : { beebomArticleUrl: article.sourceBeebomUrl },
        ),
      refresh: true,
    });
  }

  function runAllCodes(dryRun) {
    if (!dryRun && !confirmRealRun("Run real sync for all code articles?")) {
      return;
    }

    runAction({
      busyKey: `sync-all:${dryRun ? "dry" : "real"}`,
      title: `${dryRun ? "Dry run" : "Real sync"} for all code articles`,
      runner: () =>
        invokeFunction(
          APP_CONFIG,
          "sync-codes",
          APP_CONFIG.syncCodesSecret,
          dryRun ? { dryRun: true } : {},
        ),
      refresh: true,
    });
  }

  function runLetroso(dryRun) {
    if (!dryRun && !confirmRealRun("Run real Letroso sync?")) {
      return;
    }

    runAction({
      busyKey: `letroso:${dryRun ? "dry" : "real"}`,
      title: `${dryRun ? "Dry run" : "Real run"} for Letroso`,
      runner: () =>
        invokeFunction(
          APP_CONFIG,
          "sync-letroso",
          APP_CONFIG.syncLetrosoSecret,
          dryRun ? { dryRun: true } : {},
        ),
    });
  }

  function runNyt(dryRun) {
    if (!dryRun && !confirmRealRun("Run real NYT puzzles sync?")) {
      return;
    }

    runAction({
      busyKey: `nyt:${dryRun ? "dry" : "real"}`,
      title: `${dryRun ? "Dry run" : "Real run"} for NYT puzzles`,
      runner: () =>
        invokeFunction(
          APP_CONFIG,
          "sync-nyt-puzzles",
          APP_CONFIG.nytPuzzlesSecret,
          dryRun ? { dryRun: true } : {},
        ),
    });
  }

  const searchNeedle = normalizeSearchText(deferredSearch);
  const visibleArticles = sortArticles(
    articles.filter((article) => {
      if (!searchNeedle) {
        return true;
      }

      const haystack = [
        article.gameName,
        article.sourceBeebomUrl,
        article.technerdinessArticleUrl,
        article.gamingwizeArticleUrl,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchNeedle);
    }),
    sortMode,
  );

  return (
    <div className="app-shell">
      <Sidebar
        currentView={currentView}
        onChange={setCurrentView}
        envReady={envReady}
      />

      <main className="app-main">
        <header className="page-header">
          <div>
            <p className="section-label">
              {currentView === "automations" ? "Automations" : "Code Articles"}
            </p>
            <h2>
              {currentView === "automations"
                ? "Run project functions manually"
                : "Manage Roblox code article rows"}
            </h2>
          </div>

          {currentView === "articles"
            ? (
              <div className="page-header__actions">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={refreshArticles}
                  disabled={loadingArticles}
                >
                  {loadingArticles ? "Refreshing..." : "Refresh"}
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={openNewEditor}
                >
                  Add New
                </button>
              </div>
            )
            : null}
        </header>

        {!envReady
          ? (
            <section className="notice notice--error">
              <strong>Missing required envs:</strong>{" "}
              {missingEnvLabels.join(", ")}
            </section>
          )
          : null}

        {dataError
          ? <section className="notice notice--error">{dataError}</section>
          : null}

        {lastAction
          ? (
            <section
              className={`notice ${
                lastAction.status === "error"
                  ? "notice--error"
                  : "notice--success"
              }`}
            >
              <strong>{lastAction.title}</strong>
              <span>{formatDateTime(lastAction.createdAt)}</span>
              <pre>{typeof lastAction.payload === "string" ? lastAction.payload : JSON.stringify(lastAction.payload, null, 2)}</pre>
            </section>
          )
          : null}

        {currentView === "automations"
          ? (
            <section className="automation-grid">
              <AutomationCard
                title="Sync Codes"
                description="Run code scraping and WordPress updates for all article rows."
                onDryRun={() => runAllCodes(true)}
                onRealRun={() => runAllCodes(false)}
                dryDisabled={!APP_CONFIG.syncCodesSecret ||
                  busyMap["sync-all:dry"]}
                realDisabled={!APP_CONFIG.syncCodesSecret ||
                  busyMap["sync-all:real"]}
              />
              <AutomationCard
                title="Sync Letroso"
                description="Trigger the Letroso scraper and WordPress updater."
                onDryRun={() => runLetroso(true)}
                onRealRun={() => runLetroso(false)}
                dryDisabled={!APP_CONFIG.syncLetrosoSecret ||
                  busyMap["letroso:dry"]}
                realDisabled={!APP_CONFIG.syncLetrosoSecret ||
                  busyMap["letroso:real"]}
              />
              <AutomationCard
                title="Sync NYT Puzzles"
                description="Trigger the NYT puzzle updater for Wordle, Connections, and Strands."
                onDryRun={() => runNyt(true)}
                onRealRun={() => runNyt(false)}
                dryDisabled={!APP_CONFIG.nytPuzzlesSecret || busyMap["nyt:dry"]}
                realDisabled={!APP_CONFIG.nytPuzzlesSecret ||
                  busyMap["nyt:real"]}
              />
            </section>
          )
          : (
            <section className={editorOpen ? "articles-layout articles-layout--with-editor" : "articles-layout"}>
              <div className="table-panel">
                <div className="table-toolbar">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search game name or URL"
                  />
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value)}
                  >
                    <option value="updated_desc">Last Updated</option>
                    <option value="game_asc">Game Name A-Z</option>
                    <option value="game_desc">Game Name Z-A</option>
                    <option value="status">Status</option>
                  </select>
                </div>

                <div className="table-meta">
                  <span>{visibleArticles.length} rows</span>
                  <span>{formatDateTime(new Date().toISOString())}</span>
                </div>

                <div className="table-scroll">
                  <table className="articles-table">
                    <thead>
                      <tr>
                        <th>Game</th>
                        <th>Status</th>
                        <th>Beebom</th>
                        <th>TN</th>
                        <th>GW</th>
                        <th>Updated</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleArticles.map((article) => (
                        <ArticleRow
                          key={article.id}
                          article={article}
                          isSelected={selectedArticleId === article.id}
                          isBusy={Boolean(
                            busyMap[`resolve:${article.id}`] ||
                              busyMap[`sync:${article.id}:dry`] ||
                              busyMap[`sync:${article.id}:real`],
                          )}
                          onEdit={openEditArticle}
                          onResolve={runResolve}
                          onSyncDryRun={(row) => runArticleSync(row, true)}
                          onSyncReal={(row) => runArticleSync(row, false)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {editorOpen
                ? (
                  <EditorPanel
                    editor={editor}
                    onChange={updateEditorField}
                    onClose={closeEditor}
                    onSave={handleSaveArticle}
                    isSaving={savingArticle}
                    duplicateSuggestion={duplicateSuggestion}
                    onOpenDuplicate={() =>
                      openEditArticle(duplicateSuggestion.article)}
                  />
                )
                : null}
            </section>
          )}
      </main>
    </div>
  );
}
