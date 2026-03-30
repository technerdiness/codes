"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import * as cheerio from "cheerio";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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

async function generateMetadataWithGroq(
  url: string,
  content: string
): Promise<{ title: string; slug: string; summary: string }> {
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  if (!groqApiKey) throw new Error("GROQ_API_KEY environment variable is required");

  const prompt = `You are a gaming news editor. Given the article content below, generate a news headline, URL slug, and a 2-3 sentence summary.

Article URL: ${url}
Article Content:
${content.slice(0, 3000)}

Return ONLY this JSON object (no markdown):
{
  "title": "Conversational, descriptive headline — not clickbait, written like a friend sharing news",
  "slug": "url-friendly-slug",
  "summary": "2-3 sentence summary of the core news."
}`;

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
      max_tokens: 500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API failed: ${err.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  const text = data.choices[0]?.message?.content ?? "";

  const parsed = JSON.parse(text) as {
    title: string;
    slug: string;
    summary: string;
  };

  return {
    title: parsed.title,
    slug: slugify(parsed.slug || parsed.title),
    summary: parsed.summary,
  };
}

export const addManualNewsLink = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const url = args.url.trim();
    if (!url.startsWith("http")) throw new Error("Invalid URL — must start with http");

    // 1. Fetch article content
    console.log(`Fetching content from: ${url}`);
    const content = await fetchArticleContent(url);
    if (!content) {
      throw new Error(
        "Could not extract content from that URL. Make sure it is a publicly accessible article page."
      );
    }
    console.log(`Extracted ${content.length} chars`);

    // 2. Generate title, slug, summary with Groq
    console.log("Generating metadata with Groq...");
    const meta = await generateMetadataWithGroq(url, content);
    console.log(`Generated title: "${meta.title}" — slug: ${meta.slug}`);

    // 3. Insert into DB as pending
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const result = await ctx.runMutation(internal.gamingNews.insertNewsItems, {
      items: [
        {
          title: meta.title,
          slug: meta.slug,
          summary: meta.summary,
          sourceUrls: [url],
          sourceSnippets: [
            {
              source: hostname,
              title: meta.title,
              snippet: content.slice(0, 300),
              fullContent: content.slice(0, 8000),
              url,
              publishedAt: new Date().toISOString(),
            },
          ],
          collectedAt: new Date().toISOString(),
        },
      ],
    });

    if (result.skipped > 0) {
      throw new Error(
        `This story was already added (a duplicate slug "${meta.slug}" exists). Try again if the title is different.`
      );
    }

    // 4. Schedule the write action to run immediately
    console.log("Scheduling write action...");
    await ctx.scheduler.runAfter(0, internal.writeGamingNewsArticle.run, {});

    return { title: meta.title, slug: meta.slug };
  },
});
