"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import * as cheerio from "cheerio";

// ── Types ──────────────────────────────────────────────────────────────────

interface AiArticleResult {
  title: string;
  html: string;
  metaDescription: string;
}

interface WordPressCreateResponse {
  id: number;
  link?: string;
  status?: string;
}

type ArticleType = "listicle" | "explainer" | "howto";

// ── Content Fetcher ────────────────────────────────────────────────────────

async function fetchSourceContent(url: string): Promise<string | null> {
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

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    $(
      "nav, header, footer, aside, script, style, noscript, iframe, " +
      ".sidebar, .nav, .footer, .header, .menu, .ad, .ads, .advertisement, " +
      ".social-share, .related-posts, .comments, .comment, " +
      "[role='navigation'], [role='banner'], [role='complementary'], " +
      ".newsletter, .signup, .promo, .breadcrumb"
    ).remove();

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
    if (!text) text = $("body").text();

    const cleaned = text.replace(/\s+/g, " ").trim();
    return cleaned.length < 100 ? null : cleaned;
  } catch {
    return null;
  }
}

// ── Embed Extraction ───────────────────────────────────────────────────────

interface EmbedInfo {
  type: "youtube" | "twitter";
  embedCode: string;
  context: string;
}

async function extractEmbedsFromSources(sourceUrls: string[]): Promise<EmbedInfo[]> {
  const allEmbeds: EmbedInfo[] = [];

  for (const url of sourceUrls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; GamingWizeBot/1.0; +https://www.gamingwize.com)",
          Accept: "text/html",
        },
      });
      clearTimeout(timeout);

      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);

      // YouTube iframes
      $("iframe").each((_, el) => {
        const src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
        if (src.includes("youtube.com/embed") || src.includes("youtu.be")) {
          const videoIdMatch = src.match(/(?:embed\/|youtu\.be\/)([^?&"]+)/);
          if (videoIdMatch) {
            const videoId = videoIdMatch[1];
            const prevText = $(el).closest("figure, div, p").prev("p").text().replace(/\s+/g, " ").trim().slice(0, 200);
            const nextText = $(el).closest("figure, div, p").next("p").text().replace(/\s+/g, " ").trim().slice(0, 200);
            const context = [prevText, nextText].filter(Boolean).join(" | ") || `YouTube video ${videoId}`;
            const embedCode = `<figure class="wp-block-embed is-type-video"><div class="wp-block-embed__wrapper"><iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></figure>`;
            allEmbeds.push({ type: "youtube", embedCode, context });
          }
        }
      });

      // Twitter/X tweet blockquotes
      $("blockquote.twitter-tweet").each((_, el) => {
        const tweetText = $(el).text().replace(/\s+/g, " ").trim().slice(0, 300);
        const embedCode = $.html(el) + '\n<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>';
        allEmbeds.push({ type: "twitter", embedCode, context: tweetText });
      });
    } catch {
      // Skip failed fetches silently
    }
  }

  return allEmbeds;
}

// ── Embed Insertion (second model pass) ───────────────────────────────────

async function insertEmbedsIntoArticle(
  articleHtml: string,
  embeds: EmbedInfo[]
): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiApiKey) throw new Error("OPENAI_API_KEY environment variable is required");

  const embedDescriptions = embeds
    .map(
      (e, i) =>
        `--- Embed ${i + 1} (${e.type.toUpperCase()}) ---\nContext from source: "${e.context}"\nEmbed HTML:\n${e.embedCode}`
    )
    .join("\n\n");

  const prompt = `You are an editor adding media embeds to a finished article. Your only job is to place the provided embeds where they add the most value. You do NOT change any existing text.

ARTICLE:
${articleHtml}

EMBEDS TO CONSIDER:
${embedDescriptions}

RULES:
- Only insert embeds that directly relate to what is being discussed at that specific point in the article
- Insert embeds BETWEEN existing HTML blocks (after a closing </p>, </h2>, or </h3> tag) — never inside them
- If an embed does not clearly add value to a specific section, skip it entirely — do not force it in
- Do NOT modify, reword, or rearrange any existing article content
- Do NOT add captions, labels, or wrapper text around the embeds
- Each embed should appear at most once
- Return the complete article HTML with embeds cleanly inserted
- Return ONLY the HTML, no JSON wrapper, no markdown fences, no explanation`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 6000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI embed insertion failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const result = data.choices[0]?.message?.content?.trim() ?? "";
  return result || articleHtml;
}

// ── Prompt Builder ─────────────────────────────────────────────────────────

function buildPrompt(
  articleType: ArticleType,
  sourcesContext: string,
): string {
  const outputFormat = `
OUTPUT FORMAT:
Return a single JSON object — no markdown fences, no explanation, nothing else.
{
  "title": "...",
  "html": "...",
  "metaDescription": "..."
}
Use only valid HTML inside "html": <p>, <h2>, <h3>, <strong>, <em>, <ul>, <ol>, <li>, <table>, <thead>, <tbody>, <tr>, <th>, <td>. No markdown, no raw newlines inside HTML string (use \\n between top-level blocks).`;

  if (articleType === "listicle") {
    return `You are a gaming writer at GamingWize who writes with a personal, conversational voice — like a knowledgeable friend who genuinely loves gaming and wants to give you the best, most complete version of this information so you never need to go anywhere else.

TASK
Write a complete, information-rich article based entirely on the source material provided. This is a list-format article — your job is to present every single item from the source in full, with all its associated details, context, and nuance.

BEFORE YOU WRITE — DO THIS FIRST
Read through every source fully. Make a mental inventory:
- How many items are in the list? You must include ALL of them. If the source has 250 items, the article has 250 items. Never summarize, condense, or drop entries.
- What details accompany each item? (codes, descriptions, rewards, conditions, expiry, how to use, platform, etc.) Every detail must appear in the article.
- What context does the reader need to understand and actually use this list? (how codes work, what they unlock, how to redeem, game background, etc.)
- Are there categories or groupings in the source? Preserve them.
- Is there any information about what is expired, limited time, or permanent? Include it.

COMPLETENESS IS NON-NEGOTIABLE
Compare your finished article against the source before you consider yourself done. Every item, every stat, every detail that exists in the source must exist in the article. A reader who only reads your article should have 100% of the information — nothing less.

STRUCTURE
- Open with a short, punchy intro that tells the reader exactly what they are getting and why it is worth bookmarking. Get to the point fast.
- Use H2 for major sections or categories. Use H3 for sub-groupings when they exist in the source.
- Present list items using <ul> or <ol> as appropriate. Use <strong> for item names or codes. Never bury list items inside dense paragraphs.
- When the source has items that are best compared side by side (e.g. tiers, platforms, reward types), use an HTML <table>.
- Keep numbered steps or ordered processes as <ol>.
- After all the items, include a short section covering how to actually use or redeem the list (if applicable) — pull every step from the source and number them.
- If common questions naturally arise from this content (how to get more, what happens if it does not work, when they expire, etc.), add a concise FAQ section at the very end using H2. Each question gets a <strong> question line and a <p> answer. Do NOT repeat information already covered — FAQs should handle leftover questions only.

WRITING STYLE
- Conversational, direct, simple English that gamers love to read.
- Write like you are talking to a friend, not presenting a report.
- Keep paragraphs short. Vary sentence length for rhythm.
- Headings should be part of the natural story flow — not dry labels.
- No emdashes (— or –) anywhere. Use a regular hyphen or rewrite the sentence.
- Do NOT fabricate anything. Every claim, code, stat, and detail must come from the source material.
- No filler sentences. No "this is why this matters" commentary. No generic intros like "Are you looking for..." or "In this guide we will...".
- Do not reference or name where you got the information. Write as original journalism.
- Use quotes verbatim only when the source attributes a direct quote to a real person.

TITLE RULES
- Write like a friend telling another friend something useful and interesting.
- Include the key specifics (game name, what the list is) to be SEO-friendly without sounding like a press release.
- Conversational, curious, makes someone want to click.

META DESCRIPTION
- 150-160 characters, same tone, tells exactly what is in the article.

SOURCE MATERIAL:
${sourcesContext}

${outputFormat}`;
  }

  if (articleType === "explainer") {
    return `You are a gaming writer at GamingWize who writes with a personal, conversational voice — like a knowledgeable friend who genuinely loves gaming and can break down anything so it actually makes sense.

TASK
Write a complete, deeply informative explainer article based entirely on the source material provided. Your job is to make the reader truly understand this topic — not just skim the surface. Every concept, mechanic, system, detail, and piece of context in the source must be in this article.

BEFORE YOU WRITE — DO THIS FIRST
Read every source thoroughly. Build a complete picture:
- What is the core topic and what does the reader need to understand about it?
- What background or context does someone need before the main explanation lands?
- What are all the components, mechanics, rules, or sub-topics covered in the source? List every one — you must explain all of them.
- Are there numbers, stats, thresholds, or specific values? Every single one must be included.
- Are there common misconceptions or things people get wrong? Include them.
- Are there comparisons, differences, or trade-offs explained in the source? Cover them fully.
- What does the reader need to walk away knowing to feel genuinely informed?

COMPLETENESS IS NON-NEGOTIABLE
When you finish writing, compare the article against the source. Every explanation, every detail, every nuance that exists in the source must exist in the article. The reader should never need to go back to the source to find something you left out.

STRUCTURE
- Open with a tight, direct intro that immediately tells the reader what this is and why it matters to them. No preamble. Hook them and move.
- Build understanding progressively: start with what it is, then how it works, then the details, then advanced or edge-case info.
- Use H2 for major conceptual shifts or distinct components. Use H3 for sub-points within a section when needed. Keep heading count lean — only add a heading when it genuinely helps the reader navigate.
- Use <ul> bullet points for lists of features, options, or parallel items.
- Use <ol> numbered lists for sequential processes or ranked information.
- Use <table> when comparing things side by side (e.g. tiers, modes, stats across categories).
- If the topic involves a process or sequence, write it as numbered steps in <ol>.
- At the end, include a FAQ section (H2) for questions that naturally come from this content but were not fully addressed in the main body. Questions as <strong>, answers as <p>. Never repeat what is already in the article.

WRITING STYLE
- Conversational, direct, simple English. Write like a smart friend explaining something over a call.
- Build concepts in order — do not assume the reader knows things you have not explained yet.
- Short paragraphs. Varied sentence rhythm. Keep it easy to scan and read.
- Headings should read as part of the flow — not like chapter titles in a textbook.
- No emdashes (— or –) anywhere. Use a regular hyphen or rewrite the sentence.
- Do NOT fabricate anything. Every stat, mechanic, rule, and claim must come from the source.
- No filler. No "this is important because" meta-commentary. No generic openers.
- Do not reference or name where you got the information. Write as original journalism.
- Use quotes verbatim only when the source attributes a direct quote to a real person.
- The reader should finish the article feeling like they actually get it — not like they read a summary.

TITLE RULES
- Write like a friend recommending a read that actually explains something properly.
- Include the key topic name for SEO without sounding like a textbook entry.
- Conversational, direct, makes someone want to finally understand this thing.

META DESCRIPTION
- 150-160 characters, same tone, gives a clear sense of what you will learn.

SOURCE MATERIAL:
${sourcesContext}

${outputFormat}`;
  }

  // howto
  return `You are a gaming writer at GamingWize who writes with a personal, conversational voice — like a knowledgeable friend who has already done this exact thing and wants to walk you through it properly so you get it right on the first try.

TASK
Write a complete, step-by-step guide based entirely on the source material provided. Your job is to walk the reader through this process so thoroughly that they can follow along and succeed without ever needing another source. Every step, tip, warning, option, and piece of context in the source must be in this article.

BEFORE YOU WRITE — DO THIS FIRST
Read every source thoroughly. Extract everything:
- What is the exact goal the reader is trying to accomplish?
- What are the complete steps, in order? Do not combine, skip, or paraphrase — write every step.
- What does the reader need before they start? (prerequisites, requirements, items needed, settings, platforms)
- Are there multiple methods or paths to the same outcome? Cover all of them.
- Are there platform differences (PC, console, mobile)? Cover each one explicitly.
- Are there any warnings, common mistakes, or things that can go wrong? Include all of them.
- Are there tips that make the process easier or faster? Include them.
- Are there specific values, settings, codes, or exact inputs involved? Every one must be in the article.

COMPLETENESS IS NON-NEGOTIABLE
When you finish writing, compare the article against the source. Every step, every detail, every option, every warning that exists in the source must exist in the article. A reader who follows your article alone must be able to complete the task successfully.

STRUCTURE
- Open with a tight, direct intro: what this guide covers, what you will be able to do after, and anything critical to know upfront. No fluff.
- If there are prerequisites or requirements, list them in a <ul> before the steps begin.
- All steps must be in <ol> numbered lists. Always. No exceptions. Each step should be a clear, actionable instruction with enough detail that someone can follow it without guessing.
- Group major phases under H2 headings (e.g. "Setting It Up", "The Main Process", "If Something Goes Wrong"). Use H3 for sub-groups within a phase when needed.
- If there are alternative methods, each method gets its own numbered list under its own H2 or H3.
- Use <ul> bullet points for lists of options, tips, or parallel items that do not need to be done in order.
- Use <table> when comparing settings, options, or outcomes across platforms or scenarios.
- At the end, include a FAQ section (H2) for questions that naturally come up with this task — "what if it doesn't work", "can I undo this", "does this work on mobile", etc. Questions as <strong>, answers as <p>. Do not repeat steps already covered.

WRITING STYLE
- Conversational, direct, simple English. Write like a friend who has done this exact thing and is talking you through it.
- Be practical and precise. The reader wants to get this done — respect their time.
- Short paragraphs between steps to explain why or add context. Do not pad.
- Varied sentence rhythm so it reads naturally, not like a robot-generated manual.
- No emdashes (— or –) anywhere. Use a regular hyphen or rewrite the sentence.
- Do NOT fabricate anything. Every step, value, setting, and claim must come from the source.
- No filler. No "in this comprehensive guide we will explore". No generic closings.
- Do not reference or name where you got the information. Write as original journalism.
- Use quotes verbatim only when the source attributes a direct quote to a real person.

TITLE RULES
- Write like a friend telling you exactly how to do something you have been trying to figure out.
- Include the task name and game/platform for SEO without sounding like a dry how-to manual title.
- Direct, specific, makes someone click because it promises exactly what they need.

META DESCRIPTION
- 150-160 characters, same tone, tells exactly what the guide covers and what you will be able to do.

SOURCE MATERIAL:
${sourcesContext}

${outputFormat}`;
}

// ── OpenAI Writer ──────────────────────────────────────────────────────────

async function writeArticleWithOpenAI(
  articleType: ArticleType,
  sourceContents: { url: string; content: string }[]
): Promise<AiArticleResult> {
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiApiKey) throw new Error("OPENAI_API_KEY environment variable is required");

  const sourcesContext = sourceContents
    .map((s, i) => {
      const hostname = new URL(s.url).hostname.replace(/^www\./, "");
      return `Source ${i + 1} (${hostname}):\n${s.content.slice(0, 8000)}`;
    })
    .join("\n\n---\n\n");

  const prompt = buildPrompt(articleType, sourcesContext);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices[0]?.message?.content ?? "";
  const jsonStr = content.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`OpenAI returned no valid JSON. Response: ${content.slice(0, 500)}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as AiArticleResult;
  if (!parsed.title || !parsed.html || !parsed.metaDescription) {
    throw new Error("OpenAI response missing required fields (title, html, metaDescription)");
  }

  // Replace emdashes
  const emdashRegex = /[—–]/g;
  parsed.title = parsed.title.replace(emdashRegex, " - ");
  parsed.html = parsed.html.replace(emdashRegex, " - ");
  parsed.metaDescription = parsed.metaDescription.replace(emdashRegex, " - ");

  return parsed;
}

// ── WordPress Helper ───────────────────────────────────────────────────────

function getWordPressAuth(): string {
  const username = process.env.GW_WORDPRESS_USERNAME?.trim();
  const password = process.env.GW_WORDPRESS_APPLICATION_PASSWORD?.trim();
  if (!username || !password) {
    throw new Error("Missing GW_WORDPRESS_USERNAME or GW_WORDPRESS_APPLICATION_PASSWORD");
  }
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function createWordPressDraft(
  article: AiArticleResult,
  sourceUrls: string[]
): Promise<{ postId: number; postUrl: string }> {
  const siteUrl = "https://www.gamingwize.com";
  const auth = getWordPressAuth();

  const sourceLinks = sourceUrls
    .map((url) => `<li><a href="${url}">${url}</a></li>`)
    .join("\n");
  const sourcesBlock = `<p><strong>Sources for verification and images:</strong></p>\n<ul>\n${sourceLinks}\n</ul>\n\n`;
  const fullContent = sourcesBlock + article.html;

  const response = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      title: article.title,
      content: fullContent,
      status: "draft",
      excerpt: article.metaDescription,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WordPress create draft failed (${response.status}): ${errorText.slice(0, 500)}`);
  }

  const data = (await response.json()) as WordPressCreateResponse;
  return {
    postId: data.id,
    postUrl: data.link ?? `${siteUrl}/?p=${data.id}`,
  };
}

// ── Main Action ────────────────────────────────────────────────────────────

export const writeNormalArticle = action({
  args: {
    sourceUrls: v.array(v.string()),
    articleType: v.union(
      v.literal("listicle"),
      v.literal("explainer"),
      v.literal("howto")
    ),
  },
  handler: async (ctx, args) => {
    if (args.sourceUrls.length === 0) throw new Error("At least one source URL is required");

    // 1. Insert as pending
    const articleId = await ctx.runMutation(internal.normalArticles.insert, {
      sourceUrls: args.sourceUrls,
      articleType: args.articleType,
    });

    // 2. Mark as writing
    await ctx.runMutation(internal.normalArticles.markWriting, { id: articleId });

    try {
      // 3. Fetch content from all sources
      console.log(`Fetching content from ${args.sourceUrls.length} source(s)...`);
      const sourceContents: { url: string; content: string }[] = [];

      for (const url of args.sourceUrls) {
        console.log(`Fetching: ${url}`);
        const content = await fetchSourceContent(url);
        if (content) {
          sourceContents.push({ url, content });
        } else {
          console.warn(`Could not extract content from: ${url}`);
        }
      }

      if (sourceContents.length === 0) {
        throw new Error("Could not extract readable content from any of the provided URLs.");
      }

      // 4. Write article with OpenAI
      console.log(`Writing ${args.articleType} article with OpenAI gpt-4.1-mini...`);
      const article = await writeArticleWithOpenAI(args.articleType as ArticleType, sourceContents);
      console.log(`Article written: "${article.title}" (${article.html.length} chars)`);

      // 4b. Extract YouTube/Twitter embeds from sources and insert into article
      console.log("Scanning sources for YouTube/Twitter embeds...");
      const embeds = await extractEmbedsFromSources(args.sourceUrls);
      if (embeds.length > 0) {
        console.log(`Found ${embeds.length} embed(s) — inserting into article with gpt-4.1...`);
        article.html = await insertEmbedsIntoArticle(article.html, embeds);
        console.log(`Embed insertion done (${article.html.length} chars)`);
      } else {
        console.log("No embeds found in sources.");
      }

      // 5. Publish to WordPress as draft
      console.log("Publishing to WordPress as draft...");
      const wp = await createWordPressDraft(article, args.sourceUrls);
      console.log(`WordPress draft created: post ID ${wp.postId}, URL: ${wp.postUrl}`);

      // 6. Mark completed
      await ctx.runMutation(internal.normalArticles.markCompleted, {
        id: articleId,
        articleTitle: article.title,
        articleHtml: article.html,
        metaDescription: article.metaDescription,
        wordpressPostId: wp.postId,
        wordpressUrl: wp.postUrl,
      });

      return {
        success: true,
        articleTitle: article.title,
        wordpressPostId: wp.postId,
        wordpressUrl: wp.postUrl,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to write article: ${message}`);
      await ctx.runMutation(internal.normalArticles.markFailed, {
        id: articleId,
        error: message,
      });
      throw error;
    }
  },
});
