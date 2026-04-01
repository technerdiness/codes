import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/webhooks/gw-publish",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Verify secret token (query param)
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    // WP Webhooks nests post fields under body.post
    const post = body.post ?? {};
    const title: string = post.post_title ?? "";
    const excerpt: string = post.post_excerpt ?? "";
    const url: string = body.post_permalink ?? post.guid ?? "";
    const status: string = post.post_status ?? "";
    const previousStatus: string = body.post_before?.post_status ?? "";

    // Categories are at body.taxonomies.category — object keyed by slug
    const categoryObj = body.taxonomies?.category ?? {};
    const categorySlugs: string[] = Object.keys(categoryObj).map((s) => s.toLowerCase());

    console.log(`Webhook received: "${title}" status=${status} prev=${previousStatus} categories=${JSON.stringify(categorySlugs)}`);

    if (status !== "publish") {
      return new Response(JSON.stringify({ skipped: true, reason: "not published" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // For "Post Updated" triggers, only tweet if it just transitioned to publish
    // (prev status was draft/pending/private). If it was already published, skip.
    if (previousStatus === "publish") {
      return new Response(JSON.stringify({ skipped: true, reason: "already published, update only" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isNews = categorySlugs.includes("news") || categorySlugs.includes("gaming-news");
    if (!isNews) {
      return new Response(JSON.stringify({ skipped: true, reason: "not news category" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!title || !url) {
      return new Response(JSON.stringify({ skipped: true, reason: "missing title or url" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    await ctx.runAction(internal.postNewsToX.tweetNewsArticle, { title, excerpt, url });

    return new Response(JSON.stringify({ success: true, title, url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
