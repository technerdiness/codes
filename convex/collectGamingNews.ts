"use node";

import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import * as cheerio from "cheerio";

// ── Types ──────────────────────────────────────────────────────────────────

interface RssFeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
}

interface NewsApiArticle {
  title: string;
  url: string;
  description: string;
  publishedAt: string;
  source: { name: string };
}

interface GroupedTopic {
  title: string;
  slug: string;
  summary: string;
  sourceSnippets: {
    source: string;
    title: string;
    snippet: string;
    fullContent?: string;
    url: string;
    publishedAt?: string;
  }[];
  sourceUrls: string[];
}

// ── Priority Keyword Buckets ──────────────────────────────────────────────────

// Bucket 1: specific games we always want to cover
const BUCKET_1_KEYWORDS = [
  // GTA / Rockstar
  "GTA", "Grand Theft Auto", "Rockstar Games", "Rockstar",
  // Fortnite
  "Fortnite",
  // Marvel Rivals
  "Marvel Rivals",
  // Minecraft
  "Minecraft", "Mojang",
  // Pokemon
  "Pokemon", "Pokémon",
  // Roblox
  "Roblox", "Robux",
  // PUBG
  "PUBG", "PUBG Mobile", "Battlegrounds", "Krafton",
  // Call of Duty
  "Call of Duty", "Warzone", "Black Ops", "Modern Warfare", "Activision", "Treyarch", "Infinity Ward",
];

// Bucket 2: platforms & major publishers
const BUCKET_2_KEYWORDS = [
  // Epic Games
  "Epic Games", "Epic Games Store", "Tim Sweeney",
  // PlayStation
  "PlayStation", "PS5", "PS4", "PS6", "Sony", "PSN", "PlayStation Network",
  // Xbox
  "Xbox", "Game Pass", "Xbox Game Pass", "Microsoft Gaming", "Phil Spencer",
];

function getItemBucket(item: RssFeedItem): 1 | 2 | 3 {
  const titleLower = item.title.toLowerCase();
  for (const kw of BUCKET_1_KEYWORDS) {
    if (titleLower.includes(kw.toLowerCase())) return 1;
  }
  for (const kw of BUCKET_2_KEYWORDS) {
    if (titleLower.includes(kw.toLowerCase())) return 2;
  }
  return 3;
}

function computeAllocation(
  b1Count: number,
  b2Count: number,
  b3Count: number,
  total: number
): { b1: number; b2: number; b3: number } {
  // Ideal: 3 from B1, 2 from B2, 0 from B3
  const b1Alloc = Math.min(b1Count, 3);
  const afterB1 = total - b1Alloc;
  const b2Alloc = Math.min(b2Count, afterB1);
  const afterB2 = afterB1 - b2Alloc;
  const b3Alloc = Math.min(b3Count, afterB2);
  return { b1: b1Alloc, b2: b2Alloc, b3: b3Alloc };
}

// ── Source Priority (higher = preferred) ────────────────────────────────────

const SOURCE_PRIORITY: Record<string, number> = {
  "Eurogamer": 10,
  "Kotaku": 9,
  "PC Gamer": 8,
  "Rock Paper Shotgun": 7,
  "IGN": 6,
  "GameRant": 6,
  "GamesRadar": 5,
  "Polygon": 5,
  "Destructoid": 5,
  "GamesBeat": 4,
  "GameSpot": 4,
  "Dexerto": 3,
  "VG247": 3,
  "The Verge Gaming": 2,
  "Digital Trends Gaming": 2,
};

const MAX_SOURCES_PER_TOPIC = 5;

// ── RSS Feeds ──────────────────────────────────────────────────────────────

const RSS_FEEDS: { name: string; url: string }[] = [
  { name: "IGN", url: "https://feeds.feedburner.com/ign/all" },
  { name: "Kotaku", url: "https://kotaku.com/rss" },
  { name: "PC Gamer", url: "https://www.pcgamer.com/rss/" },
  { name: "Eurogamer", url: "https://www.eurogamer.net/feed" },
  { name: "GameSpot", url: "https://www.gamespot.com/feeds/mashup/" },
  { name: "Rock Paper Shotgun", url: "https://www.rockpapershotgun.com/feed" },
  { name: "Polygon", url: "https://www.polygon.com/rss/index.xml" },
  { name: "The Verge Gaming", url: "https://www.theverge.com/games/rss/index.xml" },
  { name: "GameRant", url: "https://gamerant.com/feed/" },
  { name: "GamesRadar", url: "https://www.gamesradar.com/rss/" },
  { name: "GamesBeat", url: "https://gamesbeat.com/feed/" },
  { name: "Destructoid", url: "https://www.destructoid.com/feed/" },
  { name: "Dexerto", url: "https://www.dexerto.com/gaming/feed/" },
  { name: "VG247", url: "https://www.vg247.com/feed" },
  { name: "Digital Trends Gaming", url: "https://www.digitaltrends.com/gaming/feed/" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function extractXmlTag(xml: string, tag: string): string {
  // Handles both <tag>content</tag> and <tag><![CDATA[content]]></tag>
  const regex = new RegExp(
    `<${tag}[^>]*>(?:\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*|([\\s\\S]*?))</${tag}>`,
    "i"
  );
  const match = xml.match(regex);
  if (!match) return "";
  return (match[1] ?? match[2] ?? "").trim();
}

function extractAllItems(xml: string): string[] {
  const items: string[] = [];
  let remaining = xml;
  while (true) {
    const start = remaining.indexOf("<item");
    if (start === -1) break;
    const end = remaining.indexOf("</item>", start);
    if (end === -1) break;
    items.push(remaining.slice(start, end + 7));
    remaining = remaining.slice(end + 7);
  }
  // Also handle Atom <entry> tags
  remaining = xml;
  while (true) {
    const start = remaining.indexOf("<entry");
    if (start === -1) break;
    const end = remaining.indexOf("</entry>", start);
    if (end === -1) break;
    items.push(remaining.slice(start, end + 8));
    remaining = remaining.slice(end + 8);
  }
  return items;
}

function parseRssFeed(xml: string, sourceName: string): RssFeedItem[] {
  const items = extractAllItems(xml);
  const results: RssFeedItem[] = [];

  for (const item of items.slice(0, 20)) {
    const title = extractXmlTag(item, "title");
    let link = extractXmlTag(item, "link");

    // Handle Atom feeds where link is <link href="..."/>
    if (!link) {
      const hrefMatch = item.match(/<link[^>]+href="([^"]+)"/i);
      if (hrefMatch) link = hrefMatch[1];
    }

    const description = extractXmlTag(item, "description")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);
    const pubDate =
      extractXmlTag(item, "pubDate") || extractXmlTag(item, "published") || extractXmlTag(item, "updated");

    if (title && link) {
      results.push({ title, link, description, pubDate, source: sourceName });
    }
  }

  return results;
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRecent(pubDate: string, hoursAgo: number): boolean {
  if (!pubDate) return true; // If no date, include it
  try {
    const date = new Date(pubDate);
    if (isNaN(date.getTime())) return true;
    return Date.now() - date.getTime() < hoursAgo * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ── Full Article Content Fetching ───────────────────────────────────────────

function getSourcePriority(sourceName: string): number {
  // Handle "NewsAPI:SourceName" format
  const cleanName = sourceName.replace(/^NewsAPI:/, "");
  return SOURCE_PRIORITY[cleanName] ?? 1;
}

function selectTopSources(
  snippets: GroupedTopic["sourceSnippets"]
): GroupedTopic["sourceSnippets"] {
  return [...snippets]
    .sort((a, b) => getSourcePriority(b.source) - getSourcePriority(a.source))
    .slice(0, MAX_SOURCES_PER_TOPIC);
}

async function fetchArticleContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GamingWizeBot/1.0; +https://www.gamingwize.com)",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`  Content fetch failed for ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove non-content elements
    $(
      "nav, header, footer, aside, script, style, noscript, iframe, " +
      ".sidebar, .nav, .footer, .header, .menu, .ad, .ads, .advertisement, " +
      ".social-share, .related-posts, .comments, .comment, " +
      "[role='navigation'], [role='banner'], [role='complementary'], " +
      ".newsletter, .signup, .promo, .breadcrumb"
    ).remove();

    // Try common article content selectors in order of specificity
    const selectors = [
      "article .article-body",
      "article .entry-content",
      "article .post-content",
      ".article-body",
      ".entry-content",
      ".post-content",
      ".article__body",
      "[itemprop='articleBody']",
      "article",
      "main .content",
      "main",
    ];

    let text = "";
    for (const selector of selectors) {
      const el = $(selector);
      if (el.length) {
        text = el.text();
        break;
      }
    }

    // Fallback to body if nothing matched
    if (!text) {
      text = $("body").text();
    }

    // Clean up whitespace
    const cleaned = text
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length < 100) {
      console.log(`  Too little content extracted from: ${url}`);
      return null;
    }

    return cleaned;
  } catch (error) {
    console.log(
      `  Content fetch error for ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

async function enrichTopicsWithFullContent(
  topics: GroupedTopic[]
): Promise<GroupedTopic[]> {
  const enriched: GroupedTopic[] = [];

  for (const topic of topics) {
    // Select top sources by priority for full content fetching
    const topSnippets = selectTopSources(topic.sourceSnippets);
    const topUrls = new Set(topSnippets.map((s) => s.url));

    console.log(
      `Fetching full content for "${topic.title}" from ${topSnippets.length} sources...`
    );

    // Fetch full content for top sources in parallel
    const contentMap = new Map<string, string>();
    const results = await Promise.allSettled(
      topSnippets.map(async (snippet) => {
        const fullContent = await fetchArticleContent(snippet.url);
        if (fullContent) {
          console.log(
            `  [${snippet.source}] ${fullContent.length} chars extracted`
          );
          contentMap.set(snippet.url, fullContent);
        }
      })
    );

    // Enrich all original snippets — add fullContent where we fetched it
    const enrichedSnippets = topic.sourceSnippets.map((snippet) => ({
      ...snippet,
      fullContent: contentMap.get(snippet.url) ?? undefined,
    }));

    enriched.push({
      ...topic,
      sourceSnippets: enrichedSnippets,
      // Keep ALL original source URLs
      sourceUrls: topic.sourceUrls,
    });
  }

  return enriched;
}

// ── RSS Fetching ───────────────────────────────────────────────────────────

async function fetchRssFeeds(): Promise<RssFeedItem[]> {
  const allItems: RssFeedItem[] = [];

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(feed.url, {
          signal: controller.signal,
          headers: { "User-Agent": "GamingWizeBot/1.0" },
        });
        if (!response.ok) {
          console.log(`RSS fetch failed for ${feed.name}: ${response.status}`);
          return [];
        }
        const xml = await response.text();
        return parseRssFeed(xml, feed.name);
      } catch (error) {
        console.log(
          `RSS fetch error for ${feed.name}: ${error instanceof Error ? error.message : String(error)}`
        );
        return [];
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    }
  }

  return allItems;
}

// ── NewsAPI Fetching (optional) ────────────────────────────────────────────

async function fetchNewsApi(): Promise<RssFeedItem[]> {
  const apiKey = process.env.NEWSAPI_KEY?.trim();
  if (!apiKey) {
    console.log("NEWSAPI_KEY not set, skipping NewsAPI");
    return [];
  }

  try {
    const url = new URL("https://newsapi.org/v2/everything");
    url.searchParams.set("q", "video games OR gaming");
    url.searchParams.set("language", "en");
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("pageSize", "20");
    url.searchParams.set("apiKey", apiKey);

    const response = await fetch(url, {
      headers: { "User-Agent": "GamingWizeBot/1.0" },
    });

    if (!response.ok) {
      console.log(`NewsAPI failed: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as {
      articles?: NewsApiArticle[];
    };

    return (data.articles ?? []).map((article) => ({
      title: article.title ?? "",
      link: article.url ?? "",
      description: stripHtml(article.description ?? ""),
      pubDate: article.publishedAt ?? "",
      source: `NewsAPI:${article.source?.name ?? "Unknown"}`,
    }));
  } catch (error) {
    console.log(
      `NewsAPI error: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

// ── Groq AI: Topic Selection & Deduplication ───────────────────────────────

async function selectTopicsWithGroq(
  b1Items: RssFeedItem[],
  b2Items: RssFeedItem[],
  b3Items: RssFeedItem[],
  allocation: { b1: number; b2: number; b3: number },
  existingSlugs: { slug: string; title: string }[]
): Promise<GroupedTopic[]> {
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY environment variable is required");
  }

  const existingTopics = existingSlugs.length
    ? existingSlugs.map((s) => `- "${s.title}" (slug: ${s.slug})`).join("\n")
    : "None";

  // Format each bucket's items with prefixed indices for unambiguous mapping
  const formatBucket = (items: RssFeedItem[], prefix: string, cap: number) =>
    items
      .slice(0, cap)
      .map(
        (item, i) =>
          `[${prefix}-${i}] "${item.title}" — ${item.source} — ${item.description.slice(0, 100)}`
      )
      .join("\n") || "(no items)";

  const b1Section = formatBucket(b1Items, "B1", 60);
  const b2Section = formatBucket(b2Items, "B2", 50);
  const b3Section = formatBucket(b3Items, "B3", 40);

  const totalNeeded = allocation.b1 + allocation.b2 + allocation.b3;

  const prompt = `You are a gaming news editor. Select the most newsworthy gaming news topics from the items below.

SELECTION RULES (follow exactly):
- Select exactly ${allocation.b1} topic(s) from BUCKET 1
- Select exactly ${allocation.b2} topic(s) from BUCKET 2
- Select exactly ${allocation.b3} topic(s) from BUCKET 3
- Total: ${totalNeeded} topics
- If a bucket has fewer distinct stories than its allocation, return as many as exist from that bucket (do not pad with lower-quality stories)
- Group items that cover the SAME news story together under one topic
- ONLY select news stories. Skip opinion pieces, reviews, guides, tips, and "best of" lists
- Do NOT pick any topic that overlaps with already-covered stories

ALREADY COVERED (do not repeat):
${existingTopics}

---

## BUCKET 1 — Priority Games (GTA, Fortnite, Marvel Rivals, Minecraft, Pokemon, Roblox, PUBG, Call of Duty)
${b1Section}

## BUCKET 2 — Platforms & Publishers (Epic Games, PlayStation, Xbox)
${b2Section}

## BUCKET 3 — Other Gaming News
${b3Section}

---

Return a JSON object with exactly this structure:
{
  "bucket1": [
    {
      "title": "Descriptive news headline",
      "slug": "url-friendly-slug",
      "summary": "2-3 sentence summary of the story",
      "itemIndices": ["B1-0", "B1-2"]
    }
  ],
  "bucket2": [...],
  "bucket3": [...]
}

Rules:
- itemIndices must use the exact prefixed format (e.g. "B1-0", "B2-3", "B3-1")
- Items from one bucket must only appear in that bucket's topics
- Return ONLY the JSON object, no markdown, no explanation.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices[0]?.message?.content ?? "";

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Groq returned no valid JSON object. Response: ${content.slice(0, 500)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    bucket1?: { title: string; slug: string; summary: string; itemIndices: string[] }[];
    bucket2?: { title: string; slug: string; summary: string; itemIndices: string[] }[];
    bucket3?: { title: string; slug: string; summary: string; itemIndices: string[] }[];
  };

  // Build lookup maps for each bucket
  const b1Map = new Map(b1Items.slice(0, 60).map((item, i) => [`B1-${i}`, item]));
  const b2Map = new Map(b2Items.slice(0, 50).map((item, i) => [`B2-${i}`, item]));
  const b3Map = new Map(b3Items.slice(0, 40).map((item, i) => [`B3-${i}`, item]));
  const allMap = new Map([...b1Map, ...b2Map, ...b3Map]);

  const mapTopics = (
    rawTopics: { title: string; slug: string; summary: string; itemIndices: string[] }[]
  ): GroupedTopic[] =>
    rawTopics.map((topic) => {
      const relatedItems = topic.itemIndices
        .map((idx) => allMap.get(idx))
        .filter(Boolean) as RssFeedItem[];
      return {
        title: topic.title,
        slug: slugify(topic.slug || topic.title),
        summary: topic.summary,
        sourceUrls: [...new Set(relatedItems.map((item) => item.link))],
        sourceSnippets: relatedItems.map((item) => ({
          source: item.source,
          title: item.title,
          snippet: item.description.slice(0, 300),
          url: item.link,
          publishedAt: item.pubDate || undefined,
        })),
      };
    });

  const allTopics = [
    ...mapTopics(parsed.bucket1 ?? []),
    ...mapTopics(parsed.bucket2 ?? []),
    ...mapTopics(parsed.bucket3 ?? []),
  ];

  if (existingSlugs.length > 0) {
    return await verifyNoDuplicates(allTopics, existingSlugs, groqApiKey);
  }
  return allTopics;
}

// ── Groq AI: Duplicate Verification ────────────────────────────────────────

async function verifyNoDuplicates(
  topics: GroupedTopic[],
  existingTopics: { slug: string; title: string }[],
  groqApiKey: string
): Promise<GroupedTopic[]> {
  const existingList = existingTopics
    .map((s, i) => `[E${i}] "${s.title}"`)
    .join("\n");

  const newList = topics
    .map((t, i) => `[N${i}] "${t.title}" — ${t.summary}`)
    .join("\n");

  const prompt = `You are a deduplication checker. Compare each NEW topic against the EXISTING topics. Two topics are duplicates if they cover the same core news event, even if the angle, wording, or details differ.

EXISTING (already published):
${existingList}

NEW (candidates):
${newList}

For each NEW topic, respond with its index and whether it is a duplicate of any existing topic.

Return a JSON array of objects:
[{"index": 0, "duplicate": false}, {"index": 1, "duplicate": true, "reason": "Same as E2 - both about X event"}]

Return ONLY the JSON array.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    // If verification fails, return all topics rather than crashing
    console.log("Duplicate verification call failed, skipping verification");
    return topics;
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices[0]?.message?.content ?? "";
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.log("Could not parse verification response, skipping");
    return topics;
  }

  try {
    const checks = JSON.parse(jsonMatch[0]) as {
      index: number;
      duplicate: boolean;
      reason?: string;
    }[];

    const filtered: GroupedTopic[] = [];
    for (const [i, topic] of topics.entries()) {
      const check = checks.find((c) => c.index === i);
      if (check?.duplicate) {
        console.log(`Filtered duplicate: "${topic.title}" — ${check.reason ?? "overlaps with existing"}`);
      } else {
        filtered.push(topic);
      }
    }
    return filtered;
  } catch {
    console.log("Failed to parse verification JSON, skipping");
    return topics;
  }
}

// ── Main Handler ───────────────────────────────────────────────────────────

async function handleCollectGamingNews(
  ctx: any,
  args: { count?: number; dryRun?: boolean }
): Promise<{
  rssItemsCollected: number;
  newsApiItemsCollected: number;
  recentItemsAfterFilter: number;
  topicsSelected: number;
  inserted: number;
  skipped: number;
  dryRun: boolean;
  topics: { title: string; slug: string; sourceCount: number }[];
}> {
  const count = args.count ?? 5;
  const dryRun = Boolean(args.dryRun);

  // 1. Fetch RSS feeds + NewsAPI in parallel
  console.log("Fetching RSS feeds and NewsAPI...");
  const [rssItems, newsApiItems] = await Promise.all([
    fetchRssFeeds(),
    fetchNewsApi(),
  ]);

  console.log(`RSS: ${rssItems.length} items, NewsAPI: ${newsApiItems.length} items`);

  // 2. Combine and filter to last 24 hours
  const allItems = [...rssItems, ...newsApiItems];
  const recentItems = allItems.filter((item) => isRecent(item.pubDate, 24));
  console.log(`After 24h recency filter: ${recentItems.length} items`);

  if (recentItems.length === 0) {
    return {
      rssItemsCollected: rssItems.length,
      newsApiItemsCollected: newsApiItems.length,
      recentItemsAfterFilter: 0,
      topicsSelected: 0,
      inserted: 0,
      skipped: 0,
      dryRun,
      topics: [],
    };
  }

  // 3. Get existing slugs from last 7 days to avoid duplicates
  const existingSlugs: { slug: string; title: string }[] = await ctx.runQuery(
    internal.gamingNews.getRecentSlugs,
    { sinceDaysAgo: 7 }
  );
  console.log(`Existing topics in last 7 days: ${existingSlugs.length}`);

  // 4. Bucket items by priority keywords
  const b1Items = recentItems.filter((item) => getItemBucket(item) === 1);
  const b2Items = recentItems.filter((item) => getItemBucket(item) === 2);
  const b3Items = recentItems.filter((item) => getItemBucket(item) === 3);
  const allocation = computeAllocation(b1Items.length, b2Items.length, b3Items.length, count);

  console.log(
    `Bucket breakdown — B1 (games): ${b1Items.length} items → alloc ${allocation.b1}, ` +
    `B2 (platforms): ${b2Items.length} items → alloc ${allocation.b2}, ` +
    `B3 (other): ${b3Items.length} items → alloc ${allocation.b3}`
  );

  // 5. Use Groq to select and deduplicate top topics
  console.log(`Selecting ${count} topics with Groq (bucketed)...`);
  const topics = await selectTopicsWithGroq(b1Items, b2Items, b3Items, allocation, existingSlugs);
  // Hard filter: remove any topics whose slugs already exist in DB
  const existingSlugSet = new Set(existingSlugs.map((s) => s.slug));
  const freshTopics = topics.filter((topic) => {
    if (existingSlugSet.has(topic.slug)) {
      console.log(`Hard-filtered duplicate slug: "${topic.title}" (${topic.slug})`);
      return false;
    }
    return true;
  });

  if (freshTopics.length < topics.length) {
    console.log(
      `Hard filter removed ${topics.length - freshTopics.length} duplicate(s), ${freshTopics.length} remaining`
    );
  }

  if (freshTopics.length === 0) {
    console.log("All topics were duplicates — nothing new to process.");
    return {
      rssItemsCollected: rssItems.length,
      newsApiItemsCollected: newsApiItems.length,
      recentItemsAfterFilter: recentItems.length,
      topicsSelected: 0,
      inserted: 0,
      skipped: topics.length,
      dryRun,
      topics: [],
    };
  }

  console.log(`Groq selected ${freshTopics.length} fresh topics:\n`);
  for (const [i, topic] of freshTopics.entries()) {
    console.log(`--- Topic ${i + 1}: ${topic.title} ---`);
    console.log(`  Summary: ${topic.summary}`);
    console.log(`  Sources (${topic.sourceUrls.length}):`);
    for (const snippet of topic.sourceSnippets) {
      console.log(`    • [${snippet.source}] ${snippet.title}`);
      console.log(`      ${snippet.url}`);
    }
    console.log("");
  }

  if (dryRun) {
    return {
      rssItemsCollected: rssItems.length,
      newsApiItemsCollected: newsApiItems.length,
      recentItemsAfterFilter: recentItems.length,
      topicsSelected: freshTopics.length,
      inserted: 0,
      skipped: 0,
      dryRun: true,
      topics: freshTopics.map((t) => ({
        title: t.title,
        slug: t.slug,
        sourceCount: t.sourceUrls.length,
      })),
    };
  }

  // 5. Fetch full article content from top sources
  console.log("Enriching topics with full article content...");
  const enrichedTopics = await enrichTopicsWithFullContent(freshTopics);
  const totalFetched = enrichedTopics.reduce(
    (sum, t) => sum + t.sourceSnippets.filter((s) => s.fullContent).length,
    0
  );
  console.log(`Full content fetched for ${totalFetched} source articles total\n`);

  // 6. Store in database
  const collectedAt = new Date().toISOString();
  const dbResult: { inserted: number; skipped: number } = await ctx.runMutation(
    internal.gamingNews.insertNewsItems,
    {
      items: enrichedTopics.map((topic) => ({
        title: topic.title,
        slug: topic.slug,
        summary: topic.summary,
        sourceUrls: topic.sourceUrls,
        sourceSnippets: topic.sourceSnippets,
        collectedAt,
      })),
    }
  );

  console.log(`DB: ${dbResult.inserted} inserted, ${dbResult.skipped} skipped (duplicate slugs)`);

  return {
    rssItemsCollected: rssItems.length,
    newsApiItemsCollected: newsApiItems.length,
    recentItemsAfterFilter: recentItems.length,
    topicsSelected: enrichedTopics.length,
    inserted: dbResult.inserted,
    skipped: dbResult.skipped,
    dryRun: false,
    topics: enrichedTopics.map((t) => ({
      title: t.title,
      slug: t.slug,
      sourceCount: t.sourceUrls.length,
    })),
  };
}

// ── Exports ────────────────────────────────────────────────────────────────

export const run = internalAction({
  args: {
    count: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await handleCollectGamingNews(ctx, args);
  },
});

export const collectGamingNews = action({
  args: {
    count: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await handleCollectGamingNews(ctx, args);
  },
});
