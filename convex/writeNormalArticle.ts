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

// ── Prompt Builder ─────────────────────────────────────────────────────────

function buildPrompt(
  articleType: ArticleType,
  sourcesContext: string,
  sourceUrls: string[]
): string {
  const basePersona = `You are a gaming journalist that writes in simple english, personal tone, conversational, yet just a bit professional.
You write on-point, engaging articles that are straight to the point and make sure every sentence adds value to readers.
You write like a friend talking to another friend throughout the article from title, headings to the content.
You stick to provided sources and only provide accurate information.`;

  const baseRules = `
REQUIREMENTS:
- Before writing, fully understand the source material, its context, what actually matters, and what should be emphasized. Do not simply rewrite source material. Think through the topic first, identify the core points, the broader context, and the real takeaway, then write with intent and clarity.
- Write in simple english that gamers can understand and love to read. It should feel like one clean story from start to end in conversational tone.
- Even headings should be part of the conversational flow. The entire article should feel like one clean story flow.
- Cite the official sources only. Make the article feel like legitimate professional coverage.
- Do not mention where you are collecting the info from. Write like original journalism.
- Do not use generic templated openings. Cook up something unique and catchy that gets directly to the point.
- Maintain one clean, linear flow from top to bottom so the article reads as a single piece.
- Every sentence must add clear value to the reader. Remove any line that only sets tone, repeats information, or sounds like filler.
- Do NOT fabricate quotes, statistics, or specific claims not supported by the source material.
- Do not use emdashes anywhere in the article.
- Use smaller paragraphs so it is easy for the reader.
- Vary the rhythm to improve the flow and write like a human writer.
- Include relevant context and background where appropriate.
- Use quotes verbatim only for real quotes mentioned in the sources that are actually said by someone.
- Make it informative and accurate based on the provided sources.
- Do not write broad summary statements. Each sentence should either introduce new information, explain something important, or move the story forward.
- If a sentence can be removed without losing meaning, it should not be there.

TITLE RULES (very important):
- Do NOT write generic headlines like "Company X Announces Y, Z Faces Challenges Ahead".
- Write the title like a friend telling another friend about something interesting.
- Include clear details to make the title SEO friendly while keeping the tone.
- Keep it conversational, simple, curious, and in the same tone as the article itself.
- It should make someone want to click and read.

META DESCRIPTION RULES:
- 150-160 characters, conversational, same tone as the article.

FORMAT YOUR RESPONSE AS JSON:
{
  "title": "Your conversational, curiosity-driven informative SEO friendly title here",
  "html": "<p>First paragraph...</p>\\n\\n<h2>Subheading</h2>\\n\\n<p>More content...</p>",
  "metaDescription": "Your 150-160 char conversational meta description here"
}

Use proper HTML: <p>, <h2>, <h3>, <strong>, <em>, <ol>, <ul>, <li> tags. Do NOT use markdown.
Return ONLY the JSON object, no markdown code fences.`;

  const typeGuidance: Record<ArticleType, string> = {
    listicle: `
ARTICLE TYPE GUIDANCE:
- The article should be organized around a list of things — tips, games, picks, reasons, features, etc.
- Use numbered or bulleted lists where it is the clearest way to present the information.
- Each list item should have a brief explanation that adds context, not just a bare label.
- Keep the intro and transitions between sections conversational and part of the flow.
- Use H2 or H3 headings only where they genuinely help navigate the content. Keep headings to a minimum.
- The article should feel like a well-written feature, not a dry inventory. The list is the structure, the writing is what makes it worth reading.`,

    explainer: `
ARTICLE TYPE GUIDANCE:
- The article should explain a topic clearly so a reader walks away genuinely understanding it.
- Start with what the topic is and why it matters, then build understanding layer by layer.
- Use H2 or H3 headings only for major shifts in the explanation — keep them minimal and conversational.
- Prioritize clarity over completeness. If a detail does not help the reader understand better, leave it out.
- Write like a knowledgeable friend breaking something down, not like a textbook.
- Avoid vague meta-commentary like "this matters because" — just explain the thing in a way that naturally shows why it matters.`,

    howto: `
ARTICLE TYPE GUIDANCE:
- The article should walk the reader through how to do something, step by step.
- Steps should be clear and actionable. Number them where a sequence is important.
- Keep the intro focused on what the reader will be able to do after reading — skip unnecessary preamble.
- Use H2 or H3 headings only where they genuinely help the reader navigate between major phases. Keep them minimal.
- Write in a practical, friendly tone. The reader wants to get it done — respect their time.
- Add context or tips where they help, but do not pad steps. Every sentence should move the reader forward.`,
  };

  return `${basePersona}

${typeGuidance[articleType]}

SOURCE MATERIAL:
${sourcesContext}

${baseRules}`;
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

  const sourceUrls = sourceContents.map((s) => s.url);
  const prompt = buildPrompt(articleType, sourcesContext, sourceUrls);

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
