import { useState, useDeferredValue } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { cn, formatDateTime, truncate } from "./lib/utils";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Separator,
  TabsList,
  TabsTrigger,
} from "./components/ui";
import {
  Play,
  FlaskConical,
  RefreshCw,
  Plus,
  X,
  Search,
  ExternalLink,
  Pencil,
  Link2,
  Zap,
  Puzzle,
  LetterText,
  Gamepad2,
  LayoutDashboard,
  Globe,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  SlidersHorizontal,
  Newspaper,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "codes", label: "Game Codes", icon: Gamepad2 },
  { id: "puzzles", label: "Puzzles", icon: Puzzle },
  { id: "gaming-news", label: "Gaming News", icon: Newspaper },
];

const EMPTY_EDITOR = {
  id: "",
  gameName: "",
  sourceBeebomUrl: "",
  sourceTechwiserUrl: "",
  technerdinessArticleUrl: "",
  gamingwizeArticleUrl: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeUrl(v) {
  return v.trim().replace(/\/+$/, "").toLowerCase();
}

function mapArticleToEditor(a) {
  return {
    id: a._id,
    gameName: a.gameName || "",
    sourceBeebomUrl: a.sourceBeebomUrl || "",
    sourceTechwiserUrl: a.sourceTechwiserUrl || "",
    technerdinessArticleUrl: a.technerdinessArticleUrl || "",
    gamingwizeArticleUrl: a.gamingwizeArticleUrl || "",
  };
}

function gameNameFromUrl(url) {
  try {
    const { pathname } = new URL(url.trim());
    // Get last meaningful segment (e.g. "/roblox/tap-simulator-codes/" → "tap-simulator-codes")
    const segments = pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1] || "";
    // Remove trailing "-codes" and convert hyphens to title case
    const clean = slug.replace(/-codes$/, "");
    if (!clean) return "";
    return clean
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } catch {
    return "";
  }
}

function findDuplicate(articles, editor) {
  const checks = [
    { key: "sourceBeebomUrl", val: editor.sourceBeebomUrl, label: "Beebom URL" },
    { key: "sourceTechwiserUrl", val: editor.sourceTechwiserUrl, label: "TechWiser URL" },
    { key: "technerdinessArticleUrl", val: editor.technerdinessArticleUrl, label: "TN URL" },
    { key: "gamingwizeArticleUrl", val: editor.gamingwizeArticleUrl, label: "GW URL" },
  ];
  for (const c of checks) {
    if (!c.val.trim()) continue;
    const t = normalizeUrl(c.val);
    const m = articles.find(
      (a) => a._id !== editor.id && a[c.key] && normalizeUrl(a[c.key]) === t,
    );
    if (m) return { article: m, label: c.label };
  }
  return null;
}

// ── Main App ───────────────────────────────────────────────────────────────

// ── Result Panel Renderer ──────────────────────────────────────────────────

function renderResultSummary(detail) {
  if (!detail || typeof detail === "string") {
    return detail ? <p className="text-sm">{detail}</p> : null;
  }

  // Handle arrays (e.g. per-article sync results)
  if (Array.isArray(detail)) {
    return (
      <div className="space-y-2">
        {detail.map((item, i) => (
          <div key={i} className="rounded-md border border-border/50 bg-muted/30 p-3">
            {renderResultSummary(item)}
          </div>
        ))}
      </div>
    );
  }

  // Handle objects — build key-value pairs with smart formatting
  const entries = Object.entries(detail);
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Empty result</p>;

  return (
    <div className="space-y-1.5">
      {entries.map(([key, val]) => {
        // Nested object/array → recurse
        if (val && typeof val === "object") {
          return (
            <div key={key} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{formatKey(key)}</p>
              <div className="pl-3 border-l border-border/40">
                {renderResultSummary(val)}
              </div>
            </div>
          );
        }

        // Status-like values get badges
        const badge = getStatusBadge(key, val);
        if (badge) {
          return (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{formatKey(key)}</span>
              {badge}
            </div>
          );
        }

        // Default key-value
        return (
          <div key={key} className="flex items-center justify-between text-sm gap-4">
            <span className="text-muted-foreground shrink-0">{formatKey(key)}</span>
            <span className="text-right truncate font-mono text-xs">{String(val)}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function getStatusBadge(key, val) {
  const s = String(val).toLowerCase();
  if (s === "saved" || s === "updated" || s === "resolved" || s === "success") {
    return <Badge variant="success">{String(val)}</Badge>;
  }
  if (s.startsWith("skipped") || s === "unchanged" || s === "no-change") {
    return <Badge variant="warning">{String(val)}</Badge>;
  }
  if (s === "error" || s === "failed") {
    return <Badge variant="destructive">{String(val)}</Badge>;
  }
  if (s === "pending") {
    return <Badge variant="outline">{String(val)}</Badge>;
  }
  if (key === "dryRun" && val === true) {
    return <Badge variant="info">Dry Run</Badge>;
  }
  return null;
}

// ── Result Panel ───────────────────────────────────────────────────────────

function ResultPanel({ result, onClose }) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-[420px] max-w-[90vw] border-l bg-card shadow-2xl animate-in">
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 border-b",
        result.status === "error" ? "bg-destructive/5" : "bg-success/5",
      )}>
        <div className="flex items-center gap-2 min-w-0">
          {result.status === "error" ? (
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          ) : (
            <Check className="h-4 w-4 text-green-400 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{result.title}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(result.ts)}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Readable summary */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={result.status === "error" ? "destructive" : "success"}>
              {result.status === "error" ? "Error" : "Success"}
            </Badge>
          </div>
          {renderResultSummary(result.detail)}
        </div>

        <Separator />

        {/* Raw JSON toggle */}
        <div className="p-4">
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Raw JSON
          </button>
          {showRaw && (
            <pre className="mt-3 rounded-lg bg-muted/50 p-3 text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all max-h-[50vh]">
              {typeof result.detail === "string"
                ? result.detail
                : JSON.stringify(result.detail, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Login Screen ───────────────────────────────────────────────────────────

function LoginScreen() {
  const { signIn } = useAuthActions();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Uncomment the line below to enable account creation, then comment it back out.
  // const allowSetup = true;
  const allowSetup = false;
  const [isSignUp, setIsSignUp] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("flow", isSignUp ? "signUp" : "signIn");
    try {
      await signIn("password", formData);
    } catch (err) {
      setError(isSignUp ? "Sign up failed. Account may already exist." : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Codes Admin</CardTitle>
          <CardDescription>
            {isSignUp ? "Create your admin account." : "Sign in to access the dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <label className="block space-y-1.5">
              <span className="text-sm text-muted-foreground">Email</span>
              <Input name="email" type="email" placeholder="you@example.com" required />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm text-muted-foreground">Password</span>
              <Input name="password" type="password" placeholder="••••••••" required />
            </label>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (isSignUp ? "Creating account..." : "Signing in...") : (isSignUp ? "Create Account" : "Sign In")}
            </Button>
            {allowSetup && (
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {isSignUp ? "Already have an account? Sign in" : "First time? Create account"}
              </button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <Dashboard />;
}

function Dashboard() {
  const { signOut } = useAuthActions();
  const [view, setView] = useState("overview");
  const [result, setResult] = useState(null);

  function notify(status, title, detail) {
    setResult({ status, title, detail, ts: new Date().toISOString() });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="p-5">
          <h1 className="text-lg font-bold tracking-tight">Codes Admin</h1>
          <p className="text-xs text-muted-foreground">Automation Dashboard</p>
        </div>
        <Separator />
        <nav className="flex flex-col gap-0.5 p-2">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                view === item.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto p-3 space-y-2">
          <Badge variant="success">Connected</Badge>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => void signOut()}
          >
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8 space-y-6">
          {view === "overview" && <OverviewPage notify={notify} />}
          {view === "codes" && <CodesPage notify={notify} />}
          {view === "puzzles" && <PuzzlesPage notify={notify} />}
          {view === "gaming-news" && <GamingNewsPage notify={notify} />}
          {/* Articles tab removed — Game Codes handles everything */}
        </div>
      </main>

      {/* Result panel — overlays on top, does not shift layout */}
      {result && <ResultPanel result={result} onClose={() => setResult(null)} />}

      {/* Backdrop */}
      {result && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setResult(null)}
        />
      )}
    </div>
  );
}

// ── Overview Page ──────────────────────────────────────────────────────────

function OverviewPage({ notify }) {
  const articles = useQuery(api.articles.listArticles) ?? [];

  const totalArticles = articles.length;
  const withBeebom = articles.filter((a) => a.sourceBeebomUrl).length;
  const tnLinked = articles.filter(
    (a) => a.siteStates.technerdiness.wordpressPostId,
  ).length;
  const gwLinked = articles.filter(
    (a) => a.siteStates.gamingwize.wordpressPostId,
  ).length;

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your automation system.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Articles" value={totalArticles} />
        <StatCard label="Beebom Sources" value={withBeebom} />
        <StatCard label="TN Linked" value={tnLinked} />
        <StatCard label="GW Linked" value={gwLinked} />
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            title="Sync All Codes"
            description="Scrape Beebom and update WordPress for all articles."
            icon={Gamepad2}
            notify={notify}
            actionHook={() => useAction(api.syncCodes.syncCodes)}
            runArgs={{}}
            dryArgs={{ dryRun: true }}
          />
          <QuickActionCard
            title="Sync Letroso"
            description="Fetch today's Letroso answer and update WordPress."
            icon={LetterText}
            notify={notify}
            actionHook={() => useAction(api.syncLetroso.syncLetroso)}
            runArgs={{}}
            dryArgs={{ dryRun: true }}
          />
          <QuickActionCard
            title="Sync All NYT Puzzles"
            description="Fetch Wordle, Connections, and Strands answers."
            icon={Puzzle}
            notify={notify}
            actionHook={() => useAction(api.syncNytPuzzles.syncNytPuzzles)}
            runArgs={{}}
            dryArgs={{ dryRun: true }}
          />
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({ title, description, icon: Icon, notify, actionHook, runArgs, dryArgs }) {
  const action = actionHook();
  const [busy, setBusy] = useState(null);

  async function run(isDry) {
    const args = isDry ? dryArgs : runArgs;
    const label = isDry ? `Dry run: ${title}` : title;
    setBusy(isDry ? "dry" : "run");
    try {
      const result = await action(args);
      notify("success", label, result);
    } catch (e) {
      notify("error", label, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => run(true)}
            disabled={busy !== null}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            {busy === "dry" ? "Running..." : "Dry Run"}
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={() => {
              if (window.confirm(`Run ${title}? This will update WordPress.`)) run(false);
            }}
            disabled={busy !== null}
          >
            <Play className="h-3.5 w-3.5" />
            {busy === "run" ? "Running..." : "Run"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Codes Page ─────────────────────────────────────────────────────────────

function CodesPage({ notify }) {
  const articles = useQuery(api.articles.listArticles) ?? [];
  const syncAction = useAction(api.syncCodes.syncCodes);
  const resolveAction = useAction(api.resolveWordpressPostId.resolveWordpressPostId);
  const saveArticle = useMutation(api.articles.saveArticle);
  const [busy, setBusy] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [sortMode, setSortMode] = useState("created_new");
  const [showFilters, setShowFilters] = useState(false);
  const deferredSearch = useDeferredValue(search);

  function toggleFilter(key) {
    setFilters((f) => {
      const copy = { ...f };
      if (copy[key]) delete copy[key];
      else copy[key] = true;
      return copy;
    });
  }

  const needle = deferredSearch.trim().toLowerCase();
  let filtered = articles;
  if (needle) {
    filtered = filtered.filter((a) =>
      [a.gameName, a.sourceBeebomUrl, a.sourceTechwiserUrl, a.technerdinessArticleUrl, a.gamingwizeArticleUrl]
        .join(" ").toLowerCase().includes(needle),
    );
  }
  // Apply filters
  if (filters.hasBeebom) filtered = filtered.filter((a) => a.sourceBeebomUrl);
  if (filters.noBeebom) filtered = filtered.filter((a) => !a.sourceBeebomUrl);
  if (filters.hasTW) filtered = filtered.filter((a) => a.sourceTechwiserUrl);
  if (filters.noTW) filtered = filtered.filter((a) => !a.sourceTechwiserUrl);
  if (filters.noSource) filtered = filtered.filter((a) => !a.sourceBeebomUrl && !a.sourceTechwiserUrl);
  if (filters.hasTN) filtered = filtered.filter((a) => a.technerdinessArticleUrl);
  if (filters.noTN) filtered = filtered.filter((a) => !a.technerdinessArticleUrl);
  if (filters.hasGW) filtered = filtered.filter((a) => a.gamingwizeArticleUrl);
  if (filters.noGW) filtered = filtered.filter((a) => !a.gamingwizeArticleUrl);
  if (filters.tnNoPostId) filtered = filtered.filter((a) => a.technerdinessArticleUrl && !a.siteStates.technerdiness.wordpressPostId);
  if (filters.gwNoPostId) filtered = filtered.filter((a) => a.gamingwizeArticleUrl && !a.siteStates.gamingwize.wordpressPostId);
  if (filters.neverScraped) filtered = filtered.filter((a) => !a.lastScrapedAt);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortMode) {
      case "created_new": return (b._creationTime || 0) - (a._creationTime || 0);
      case "created_old": return (a._creationTime || 0) - (b._creationTime || 0);
      case "name_asc": return (a.gameName || "").localeCompare(b.gameName || "");
      case "name_desc": return (b.gameName || "").localeCompare(a.gameName || "");
      case "scraped_old": return (a.lastScrapedAt || "").localeCompare(b.lastScrapedAt || "");
      case "scraped_new": return (b.lastScrapedAt || "").localeCompare(a.lastScrapedAt || "");
      case "tn_sync_old": return (a.siteStates.technerdiness.lastWordpressSyncAt || "").localeCompare(b.siteStates.technerdiness.lastWordpressSyncAt || "");
      case "tn_sync_new": return (b.siteStates.technerdiness.lastWordpressSyncAt || "").localeCompare(a.siteStates.technerdiness.lastWordpressSyncAt || "");
      case "gw_sync_old": return (a.siteStates.gamingwize.lastWordpressSyncAt || "").localeCompare(b.siteStates.gamingwize.lastWordpressSyncAt || "");
      case "gw_sync_new": return (b.siteStates.gamingwize.lastWordpressSyncAt || "").localeCompare(a.siteStates.gamingwize.lastWordpressSyncAt || "");
      default: return 0;
    }
  });

  async function runSync(article, dryRun) {
    const key = `sync:${article._id}:${dryRun}`;
    setBusy((p) => ({ ...p, [key]: true }));
    const label = `${dryRun ? "Dry run" : "Sync"}: ${article.gameName}`;
    try {
      const result = await syncAction({
        gameName: article.gameName,
        dryRun: dryRun || undefined,
      });
      notify("success", label, result);
    } catch (e) {
      notify("error", label, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy((p) => ({ ...p, [key]: false }));
    }
  }

  async function runResolve(article) {
    const key = `resolve:${article._id}`;
    setBusy((p) => ({ ...p, [key]: true }));
    try {
      const result = await resolveAction({ articleId: article._id });
      notify("success", `Resolve: ${article.gameName}`, result);
    } catch (e) {
      notify("error", `Resolve: ${article.gameName}`, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy((p) => ({ ...p, [key]: false }));
    }
  }

  async function runAllSync(dryRun) {
    const key = `sync-all:${dryRun}`;
    setBusy((p) => ({ ...p, [key]: true }));
    const label = dryRun ? "Dry run: All Codes" : "Sync All Codes";
    try {
      const result = await syncAction({ dryRun: dryRun || undefined });
      notify("success", label, result);
    } catch (e) {
      notify("error", label, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy((p) => ({ ...p, [key]: false }));
    }
  }

  // URL fields in priority order for auto-detecting game name
  const URL_FIELDS_PRIORITY = [
    "gamingwizeArticleUrl",
    "technerdinessArticleUrl",
    "sourceBeebomUrl",
    "sourceTechwiserUrl",
  ];

  function updateField(field, value) {
    setEditor((prev) => {
      const next = { ...prev, [field]: value };
      if (URL_FIELDS_PRIORITY.includes(field) && value.trim()) {
        if (!next.gameName.trim()) {
          for (const f of URL_FIELDS_PRIORITY) {
            const url = next[f]?.trim();
            if (url) {
              const derived = gameNameFromUrl(url);
              if (derived) {
                next.gameName = derived;
                break;
              }
            }
          }
        }
      }
      return next;
    });
  }

  const dup = editor ? findDuplicate(articles, editor) : null;

  async function handleSave(e) {
    e.preventDefault();
    if (dup) return;
    setSaving(true);
    try {
      await saveArticle({
        id: editor.id || undefined,
        gameName: editor.gameName || undefined,
        sourceBeebomUrl: editor.sourceBeebomUrl || undefined,
        sourceTechwiserUrl: editor.sourceTechwiserUrl || undefined,
        technerdinessArticleUrl: editor.technerdinessArticleUrl || undefined,
        gamingwizeArticleUrl: editor.gamingwizeArticleUrl || undefined,
      });
      notify("success", editor.id ? "Article updated" : "Article created");
      setEditor(null);
    } catch (err) {
      notify("error", "Save failed", err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const FILTER_GROUPS = [
    { label: "Beebom", hasKey: "hasBeebom", noKey: "noBeebom" },
    { label: "TechWiser", hasKey: "hasTW", noKey: "noTW" },
    { label: "Tech Nerdiness", hasKey: "hasTN", noKey: "noTN" },
    { label: "Gaming Wize", hasKey: "hasGW", noKey: "noGW" },
  ];
  const FILTER_EXTRAS = [
    { key: "noSource", label: "No source at all" },
    { key: "tnNoPostId", label: "TN missing post ID" },
    { key: "gwNoPostId", label: "GW missing post ID" },
    { key: "neverScraped", label: "Never scraped" },
  ];

  const SORTS = [
    { v: "created_new", l: "Newest" },
    { v: "created_old", l: "Oldest" },
    { v: "name_asc", l: "A-Z" },
    { v: "name_desc", l: "Z-A" },
    { v: "scraped_old", l: "Scraped ↑" },
    { v: "scraped_new", l: "Scraped ↓" },
    { v: "tn_sync_old", l: "TN sync ↑" },
    { v: "tn_sync_new", l: "TN sync ↓" },
    { v: "gw_sync_old", l: "GW sync ↑" },
    { v: "gw_sync_new", l: "GW sync ↓" },
  ];

  const activeFilterCount = Object.keys(filters).length;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Game Codes</h2>
          <p className="text-muted-foreground">
            {sorted.length} of {articles.length} articles
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditor(EMPTY_EDITOR)}>
            <Plus className="h-3.5 w-3.5" /> Add Article
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runAllSync(true)}
            disabled={busy["sync-all:true"]}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Dry Run All
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (window.confirm("Sync all codes? This will update WordPress.")) runAllSync(false);
            }}
            disabled={busy["sync-all:false"]}
          >
            <Play className="h-3.5 w-3.5" />
            Sync All
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search game name or URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <TabsList>
          {SORTS.map((s) => (
            <TabsTrigger key={s.v} value={s.v} activeValue={sortMode} onClick={setSortMode}>
              {s.l}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="relative">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "inline-flex items-center justify-center rounded-md border h-9 w-9 transition-colors cursor-pointer",
              activeFilterCount > 0
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground border-border hover:text-foreground hover:bg-accent",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          {showFilters && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
              <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border bg-popover p-4 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Filters</span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => setFilters({})}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                {FILTER_GROUPS.map((g) => (
                  <div key={g.label} className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">{g.label}</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => toggleFilter(g.hasKey)}
                        className={cn(
                          "flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors cursor-pointer text-center",
                          filters[g.hasKey]
                            ? "bg-primary text-primary-foreground border-primary"
                            : "text-muted-foreground border-border hover:text-foreground",
                        )}
                      >
                        Has
                      </button>
                      <button
                        onClick={() => toggleFilter(g.noKey)}
                        className={cn(
                          "flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors cursor-pointer text-center",
                          filters[g.noKey]
                            ? "bg-primary text-primary-foreground border-primary"
                            : "text-muted-foreground border-border hover:text-foreground",
                        )}
                      >
                        No
                      </button>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="space-y-1.5">
                  {FILTER_EXTRAS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => toggleFilter(f.key)}
                      className={cn(
                        "w-full rounded-md border px-2 py-1 text-xs font-medium transition-colors cursor-pointer text-left",
                        filters[f.key]
                          ? "bg-primary text-primary-foreground border-primary"
                          : "text-muted-foreground border-border hover:text-foreground",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-6">
      <div className="flex-1 min-w-0 space-y-2">
        {sorted.map((article) => {
          const tn = article.siteStates.technerdiness;
          const gw = article.siteStates.gamingwize;
          const isExpanded = expanded === article._id;
          const isBusy =
            busy[`sync:${article._id}:true`] ||
            busy[`sync:${article._id}:false`] ||
            busy[`resolve:${article._id}`];

          return (
            <Card key={article._id}>
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : article._id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Gamepad2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="font-medium truncate">{article.gameName}</p>
                  {article.sourceBeebomUrl ? (
                    <Badge variant="success">Beebom</Badge>
                  ) : (
                    <Badge variant="outline">Beebom</Badge>
                  )}
                  {article.sourceTechwiserUrl ? (
                    <Badge variant="success">TW</Badge>
                  ) : (
                    <Badge variant="outline">TW</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex gap-1.5">
                    {tn.wordpressPostId ? (
                      <Badge variant="success">TN #{tn.wordpressPostId}</Badge>
                    ) : article.technerdinessArticleUrl ? (
                      <Badge variant="destructive">TN !</Badge>
                    ) : (
                      <Badge variant="outline">TN -</Badge>
                    )}
                    {gw.wordpressPostId ? (
                      <Badge variant="success">GW #{gw.wordpressPostId}</Badge>
                    ) : article.gamingwizeArticleUrl ? (
                      <Badge variant="destructive">GW !</Badge>
                    ) : (
                      <Badge variant="outline">GW -</Badge>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t px-4 py-3 space-y-3 bg-muted/20">
                  <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <UrlDetail label="Beebom" url={article.sourceBeebomUrl} />
                    <UrlDetail label="TechWiser" url={article.sourceTechwiserUrl} />
                    <UrlDetail label="Tech Nerdiness" url={article.technerdinessArticleUrl} />
                    <UrlDetail label="Gaming Wize" url={article.gamingwizeArticleUrl} />
                  </div>
                  <div className="grid gap-2 text-xs sm:grid-cols-3">
                    <div>
                      <span className="text-muted-foreground">Last scraped:</span>{" "}
                      {formatDateTime(article.lastScrapedAt)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">TN last sync:</span>{" "}
                      {formatDateTime(tn.lastWordpressSyncAt)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">GW last sync:</span>{" "}
                      {formatDateTime(gw.lastWordpressSyncAt)}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={(e) => { e.stopPropagation(); setEditor(mapArticleToEditor(article)); }}
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={(e) => { e.stopPropagation(); runSync(article, true); }}
                      disabled={isBusy}
                    >
                      <FlaskConical className="h-3 w-3" /> Dry Run
                    </Button>
                    <Button
                      variant="success"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Sync ${article.gameName}?`)) runSync(article, false);
                      }}
                      disabled={isBusy}
                    >
                      <Play className="h-3 w-3" /> Sync
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={(e) => { e.stopPropagation(); runResolve(article); }}
                      disabled={isBusy}
                    >
                      <Link2 className="h-3 w-3" /> Resolve WP IDs
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No matching articles found.</p>
        )}
      </div>

      {/* Editor Sidebar */}
      {editor && (
        <Card className="w-80 shrink-0 self-start sticky top-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                {editor.id ? "Edit Article" : "New Article"}
              </CardTitle>
              <Button variant="ghost" size="icon-sm" onClick={() => setEditor(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dup && (
              <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                <p>
                  This {dup.label} already exists on{" "}
                  <strong>{dup.article.gameName}</strong>.
                </p>
                <Button
                  variant="outline"
                  size="xs"
                  className="mt-2"
                  onClick={() => setEditor(mapArticleToEditor(dup.article))}
                >
                  Edit Existing
                </Button>
              </div>
            )}
            <form onSubmit={handleSave} className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Game Name</span>
                <Input
                  value={editor.gameName}
                  onChange={(e) => updateField("gameName", e.target.value)}
                  placeholder="Anime Vanguards"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Beebom URL</span>
                <Input
                  value={editor.sourceBeebomUrl}
                  onChange={(e) => updateField("sourceBeebomUrl", e.target.value)}
                  placeholder="https://beebom.com/..."
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">TechWiser URL</span>
                <Input
                  value={editor.sourceTechwiserUrl}
                  onChange={(e) => updateField("sourceTechwiserUrl", e.target.value)}
                  placeholder="https://techwiser.com/..."
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Tech Nerdiness URL</span>
                <Input
                  value={editor.technerdinessArticleUrl}
                  onChange={(e) => updateField("technerdinessArticleUrl", e.target.value)}
                  placeholder="https://www.technerdiness.com/..."
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Gaming Wize URL</span>
                <Input
                  value={editor.gamingwizeArticleUrl}
                  onChange={(e) => updateField("gamingwizeArticleUrl", e.target.value)}
                  placeholder="https://www.gamingwize.com/..."
                />
              </label>
              <Button type="submit" size="sm" className="w-full" disabled={saving || !!dup}>
                {saving ? "Saving..." : editor.id ? "Save Changes" : "Create Article"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
      </div>
    </>
  );
}

function UrlDetail({ label, url }) {
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground">{label}:</span>{" "}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-info hover:underline inline-flex items-center gap-1"
        >
          {truncate(url, 40)}
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <span className="text-muted-foreground/50">Not set</span>
      )}
    </div>
  );
}

// ── Puzzles Page ───────────────────────────────────────────────────────────

// ── Gaming News Page ───────────────────────────────────────────────────────

function GamingNewsStatusBadge({ status }) {
  const map = {
    pending: ["outline", "Pending"],
    writing: ["info", "Writing"],
    completed: ["success", "Done"],
    failed: ["destructive", "Failed"],
  };
  const [variant, label] = map[status] ?? ["outline", status];
  return <Badge variant={variant} className="shrink-0 text-xs">{label}</Badge>;
}

function GamingNewsPage({ notify }) {
  const addLink = useAction(api.addManualNewsLink.addManualNewsLink);
  const recentNews = useQuery(api.gamingNews.listRecentGamingNews);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    try {
      const result = await addLink({ url: url.trim() });
      notify("success", "News Article Queued", result);
      setUrl("");
    } catch (err) {
      notify("error", "Failed to Add News", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div>
        <h2 className="text-xl font-bold">Gaming News</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Paste a news article URL — it will be fetched, summarized by AI, and written as a WordPress draft automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add News Link</CardTitle>
          <CardDescription>
            Any publicly accessible gaming news article URL works.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.ign.com/articles/..."
              disabled={busy}
              className="flex-1"
            />
            <Button type="submit" disabled={busy || !url.trim()}>
              {busy
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Processing...</>
                : <><Plus className="h-3.5 w-3.5" /> Add</>
              }
            </Button>
          </form>
          {busy && (
            <p className="text-xs text-muted-foreground mt-2">
              Fetching article and generating metadata... this takes about 15-30 seconds.
              The article write will run in the background after.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Articles</CardTitle>
          <CardDescription>Last 30 collected gaming news items</CardDescription>
        </CardHeader>
        <CardContent>
          {!recentNews ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : recentNews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No articles yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recentNews.map((item) => (
                <div key={item._id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">
                      {item.articleTitle || item.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDateTime(item.collectedAt)}
                    </p>
                    {item.status === "failed" && item.error && (
                      <p className="text-xs text-red-400 mt-1 line-clamp-2">{item.error}</p>
                    )}
                    {item.wordpressUrl && (
                      <a
                        href={item.wordpressUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-info hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        View WordPress Draft <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <GamingNewsStatusBadge status={item.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function PuzzlesPage({ notify }) {
  const syncNyt = useAction(api.syncNytPuzzles.syncNytPuzzles);
  const syncLetroso = useAction(api.syncLetroso.syncLetroso);
  const [busy, setBusy] = useState({});

  async function runPuzzle(key, label, action, args) {
    setBusy((p) => ({ ...p, [key]: true }));
    try {
      const result = await action(args);
      notify("success", label, result);
    } catch (e) {
      notify("error", label, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy((p) => ({ ...p, [key]: false }));
    }
  }

  const puzzles = [
    {
      id: "wordle",
      title: "Wordle",
      description: "Fetch today's Wordle answer from NYT and update the WordPress article.",
      icon: "W",
      color: "bg-emerald-500/15 text-emerald-400",
    },
    {
      id: "connections",
      title: "Connections",
      description: "Fetch today's Connections categories and update WordPress.",
      icon: "C",
      color: "bg-purple-500/15 text-purple-400",
    },
    {
      id: "strands",
      title: "Strands",
      description: "Fetch today's Strands spangram and theme words, update WordPress.",
      icon: "S",
      color: "bg-blue-500/15 text-blue-400",
    },
    {
      id: "letroso",
      title: "Letroso",
      description: "Scrape today's Letroso answer and update the answer history on WordPress.",
      icon: "L",
      color: "bg-amber-500/15 text-amber-400",
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Puzzles</h2>
          <p className="text-muted-foreground">
            Run individual puzzle syncs or batch all NYT puzzles together.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              runPuzzle("nyt-all-dry", "Dry run: All NYT", syncNyt, { dryRun: true })
            }
            disabled={busy["nyt-all-dry"]}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Dry All NYT
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (window.confirm("Sync all NYT puzzles?"))
                runPuzzle("nyt-all", "Sync All NYT", syncNyt, {});
            }}
            disabled={busy["nyt-all"]}
          >
            <Zap className="h-3.5 w-3.5" />
            Sync All NYT
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {puzzles.map((p) => {
          const isNyt = p.id !== "letroso";
          const action = isNyt ? syncNyt : syncLetroso;
          const dryArgs = isNyt
            ? { puzzles: [p.id], dryRun: true }
            : { dryRun: true };
          const runArgs = isNyt ? { puzzles: [p.id] } : {};
          const dryKey = `${p.id}-dry`;
          const runKey = `${p.id}-run`;

          return (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg font-bold text-lg",
                      p.color,
                    )}
                  >
                    {p.icon}
                  </div>
                  <div>
                    <CardTitle>{p.title}</CardTitle>
                    <CardDescription className="mt-0.5">{p.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runPuzzle(dryKey, `Dry run: ${p.title}`, action, dryArgs)}
                    disabled={busy[dryKey]}
                  >
                    <FlaskConical className="h-3.5 w-3.5" />
                    {busy[dryKey] ? "Running..." : "Dry Run"}
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Sync ${p.title}? This will update WordPress.`))
                        runPuzzle(runKey, `Sync: ${p.title}`, action, runArgs);
                    }}
                    disabled={busy[runKey]}
                  >
                    <Play className="h-3.5 w-3.5" />
                    {busy[runKey] ? "Running..." : "Run"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

