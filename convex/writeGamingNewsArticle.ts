"use node";

import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";

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

// ── WordPress Helpers ──────────────────────────────────────────────────────

function getWordPressAuth(): string {
  const username = process.env.GW_WORDPRESS_USERNAME?.trim();
  const password = process.env.GW_WORDPRESS_APPLICATION_PASSWORD?.trim();
  if (!username || !password) {
    throw new Error(
      "Missing GW_WORDPRESS_USERNAME or GW_WORDPRESS_APPLICATION_PASSWORD"
    );
  }
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

async function createWordPressDraft(
  article: AiArticleResult,
  sourceUrls: string[]
): Promise<{
  postId: number;
  postUrl: string;
}> {
  const siteUrl = "https://www.gamingwize.com";
  const auth = getWordPressAuth();

  // Build source links block for the top of the article
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
      categories: [78],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `WordPress create draft failed (${response.status}): ${errorText.slice(0, 500)}`
    );
  }

  const data = (await response.json()) as WordPressCreateResponse;
  return {
    postId: data.id,
    postUrl: data.link ?? `${siteUrl}/?p=${data.id}`,
  };
}

// ── OpenAI Article Writer ──────────────────────────────────────────────────

async function writeArticleWithOpenAI(
  title: string,
  summary: string,
  sourceSnippets: {
    source: string;
    title: string;
    snippet: string;
    fullContent?: string;
    url: string;
    publishedAt?: string;
  }[]
): Promise<AiArticleResult> {
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const sourcesContext = sourceSnippets
    .map((s, i) => {
      const content = s.fullContent || s.snippet;
      return `Source ${i + 1} (${s.source}): "${s.title}"\n${content}`;
    })
    .join("\n\n");

  const prompt = `You are a gaming news journalist that writes in simple english, personal tone, conversational, yet just a bit professional. 
  You write on-point, engaging articles that are straight to point and make sure every sentence adds value to the users.
  You write like friend talking to another friend through out the article from title, headings to the content of the news article.
  You stick to provided sources and only provide accurate information.

Write a complete news article about the following topic.

TOPIC: ${title}
SUMMARY: ${summary}

SOURCE MATERIAL:
${sourcesContext}

REQUIREMENTS:
- Before writing, fully understand the news, its context, what actually matters, and what should be emphasized. Do not simply rewrite source material. Think through the story first, identify the core development, the broader context, and the real takeaway, then write with intent and clarity.
- Write a simple news article that is easy for anyone to understand and follow through. It should feel like one story from start to end in conversational tone.
- Have a tone soo crazy that the news can feel like commentary or satire but only if the article is like that. Again, keep it professional enough but have that spark into the article.
- Even headings should be part of the conversational flow. Entire article should feel like one clean story flow. 
- Cite the official sources and only the offiicial sources. Make the article like a legitimate professional news coverage with professional journalism. 
- Do not include secondary sources or where you are collecting the info from. The official source is the one even the info given you are also reffering to. Those are the only sources you need to refer to. Do not mention anywhere, where you are getting the info. Write like an original news journalism.
- Intro needs to get directly to the point without wasting time and hook the reader and keep that engagement going through out the article. 
- Do not use generic templated and mainstream openings like "If you have been" or do not go with vibes of are you waiting for that and then we have it here. Cook up something unique and catche.
- Maintain one clean, linear flow from top to bottom so the article reads like a single story rather than disconnected sections.
- There is no hard requirement on number of words, but make sure proper context and then needed info is clearly mentioned for people to understand. (400-800 words is a good middleground, however this is not hard rule, the length of the article should be according to the topic)
- Provide a detailed and information rich news article that even uses words like I, you, etc only where they are really needed.
- Use simple english that gamers can understand and love to read
- Use H2 and H3 where needed. However use as less headings as possible to keep the structure of the article clean. 
- Headings should be used for only the core of the topic and something that drives the narrative forward. 
- Headings should give away all the needed info needed. Readers should be able to just read headings and get the complete gist of the news and what's happening. 
- Keep headings also conversational and part of the story like flow. Nothing in the article breaks this clean linear flow of the article. 
- Do not include any vague sections like why this matters, etc. 
- Do NOT fabricate quotes, statistics, or specific claims not supported by the source material
- Do not use emdashes anywhere in the article
- Use smaller paras so that it will be easy for the user. 
- vary the rythm to improve the flow and write like human writer. 
- Include relevant context and background where appropriate. 
- Use Quotes when mentioned about what other people have said and use them verbatum. Only do this for real quotes mentioned in the sources for things that are actually said by someone.
- You can free to use lists/table when it is the best way to tell the information. However, use them very less, prefer conversational paras that are very personalised. 
- Make it informative and accurate based on the provided sources
- Every sentence must add clear value to the reader. 
- Remove any line that only sets tone, repeats information, or sounds like filler. 
- Do not write broad summary statements about the update or product. 
- Avoid framing like “this is not X, it is Y” or any similar contrast-based phrasing. Keep everything direct and specific. 
- Each sentence should either introduce new information, explain something important, or move the story forward. 
- If a sentence can be removed without losing meaning, it should not be there. Keep the writing conversational and slightly personal, but never at the cost of precision or clarity.


TITLE RULES (very important):
- Do NOT write generic news headlines like "Company X Announces Y, Z Faces Challenges Ahead"
- Write the title like a friend telling another friend about something interesting that happened
- Keep it conversational, simple, curious, and in the same tone as the article itself
- It should make someone want to click and read, not sound like a press release
- Examples of BAD titles: "Epic Games Lays Off Over 1,000 Staff, Fortnite Development Faces Big Challenges Ahead"
- Examples of GOOD titles: "Epic Just Fired Over 1,000 People and Fortnite Might Never Be the Same"

META DESCRIPTION RULES:
- 150-160 characters, conversational, same tone as the article

FORMAT YOUR RESPONSE AS JSON:
{
  "title": "Your conversational, curiosity-driven title here",
  "html": "<p>First paragraph...</p>\\n\\n<h2>Subheading</h2>\\n\\n<p>More content...</p>",
  "metaDescription": "Your 150-160 char conversational meta description here"
}

Use proper HTML: <p>, <h2>, <h3>, <strong>, <em> tags. Do NOT use markdown.
Return ONLY the JSON object, no markdown code fences.`;

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
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI API failed (${response.status}): ${errorText.slice(0, 500)}`
    );
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices[0]?.message?.content ?? "";

  // Parse JSON from response (handle potential markdown wrapping)
  const jsonStr = content.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `OpenAI returned no valid JSON. Response: ${content.slice(0, 500)}`
    );
  }

  const parsed = JSON.parse(jsonMatch[0]) as AiArticleResult;

  if (!parsed.title || !parsed.html || !parsed.metaDescription) {
    throw new Error("OpenAI response missing required fields (title, html, metaDescription)");
  }

  // Replace emdashes (— and –) with " - "
  const emdashRegex = /[—–]/g;
  parsed.title = parsed.title.replace(emdashRegex, " - ");
  parsed.html = parsed.html.replace(emdashRegex, " - ");
  parsed.metaDescription = parsed.metaDescription.replace(emdashRegex, " - ");

  return parsed;
}

// ── Main Handler ───────────────────────────────────────────────────────────

interface ArticleResult {
  newsId: string;
  title: string;
  success: boolean;
  articleTitle?: string;
  wordpressPostId?: number;
  wordpressUrl?: string;
  error?: string;
}

async function handleWriteGamingNewsArticle(
  ctx: any,
  args: { dryRun?: boolean }
): Promise<{
  totalPending: number;
  processed: number;
  failed: number;
  dryRun: boolean;
  results: ArticleResult[];
}> {
  const dryRun = Boolean(args.dryRun);

  // 1. Get ALL pending articles
  const pendingArticles = await ctx.runQuery(internal.gamingNews.getAllPendingArticles, {});

  if (pendingArticles.length === 0) {
    console.log("No pending gaming news articles to write");
    return { totalPending: 0, processed: 0, failed: 0, dryRun, results: [] };
  }

  console.log(`Found ${pendingArticles.length} pending articles to process`);

  const results: ArticleResult[] = [];

  // 2. Process each article sequentially (to avoid rate limits)
  for (const [i, pending] of pendingArticles.entries()) {
    console.log(`\n[${i + 1}/${pendingArticles.length}] Processing: "${pending.title}" (${pending._id})`);

    // Mark as writing to prevent double-processing
    if (!dryRun) {
      await ctx.runMutation(internal.gamingNews.markWriting, { id: pending._id });
    }

    try {
      // Write article with OpenAI
      console.log("Writing article with OpenAI gpt-4.1-mini...");
      const article = await writeArticleWithOpenAI(
        pending.title,
        pending.summary,
        pending.sourceSnippets
      );
      console.log(`Article written: "${article.title}" (${article.html.length} chars)`);

      if (dryRun) {
        results.push({
          newsId: pending._id,
          title: pending.title,
          success: true,
          articleTitle: article.title,
        });
        continue;
      }

      // Publish to WordPress as draft
      console.log("Publishing to WordPress as draft...");
      const wp = await createWordPressDraft(article, pending.sourceUrls ?? []);
      console.log(`WordPress draft created: post ID ${wp.postId}, URL: ${wp.postUrl}`);

      // Mark as completed in DB
      await ctx.runMutation(internal.gamingNews.markCompleted, {
        id: pending._id,
        articleTitle: article.title,
        articleHtml: article.html,
        metaDescription: article.metaDescription,
        wordpressPostId: wp.postId,
        wordpressUrl: wp.postUrl,
      });

      results.push({
        newsId: pending._id,
        title: pending.title,
        success: true,
        articleTitle: article.title,
        wordpressPostId: wp.postId,
        wordpressUrl: wp.postUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to process "${pending.title}": ${message}`);

      if (!dryRun) {
        await ctx.runMutation(internal.gamingNews.markFailed, {
          id: pending._id,
          error: message,
        });
      }

      results.push({
        newsId: pending._id,
        title: pending.title,
        success: false,
        error: message,
      });
    }
  }

  const processed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`\nDone: ${processed} written, ${failed} failed out of ${pendingArticles.length} total`);

  if (!dryRun) {
    const issues = results
      .filter((r) => !r.success && r.error)
      .map((r) => ({
        group: "Article writing",
        identifier: r.title,
        reason: r.error!,
      }));

    await ctx.runMutation(internal.syncRuns.record, {
      automationType: "write_gaming_news",
      ranAt: new Date().toISOString(),
      updatedCount: processed,
      issueCount: issues.length,
      issues,
    });
  }

  return {
    totalPending: pendingArticles.length,
    processed,
    failed,
    dryRun,
    results,
  };
}

// ── Exports ────────────────────────────────────────────────────────────────

export const run = internalAction({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    return await handleWriteGamingNewsArticle(ctx, args);
  },
});

export const writeGamingNewsArticle = action({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    return await handleWriteGamingNewsArticle(ctx, args);
  },
});

