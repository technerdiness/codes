"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { updateWordPressPostTitleMonthYear } from "./lib/wordpress";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const newMonthYear = `${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

    console.log(`Updating article titles to (${newMonthYear})...`);

    const articles = await ctx.runQuery(
      internal.articlesInternal.listArticlesForTitleUpdate,
      {}
    );
    console.log(`Found ${articles.length} articles to check`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const issues: { group: string; identifier: string; reason: string }[] = [];

    for (const article of articles) {
      for (const siteKey of ["technerdiness", "gamingwize"] as const) {
        const site = article[siteKey];
        if (!site) continue;

        try {
          const result = await updateWordPressPostTitleMonthYear({
            siteKey,
            articleUrl: site.articleUrl,
            wordpressPostId: site.wordpressPostId,
            wordpressPostType: site.wordpressPostType,
            newMonthYear,
          });

          if (result === "updated") {
            console.log(`[${siteKey}] Updated: "${article.gameName}"`);
            updated++;
          } else {
            console.log(`[${siteKey}] Skipped (${result}): "${article.gameName}"`);
            skipped++;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[${siteKey}] Failed "${article.gameName}": ${message}`);
          failed++;
          issues.push({
            group: `${siteKey} title update`,
            identifier: article.gameName,
            reason: message,
          });
        }
      }
    }

    await ctx.runMutation(internal.syncRuns.record, {
      automationType: "update_article_titles",
      ranAt: new Date().toISOString(),
      updatedCount: updated,
      issueCount: issues.length,
      issues,
    });

    console.log(
      `Done: ${updated} updated, ${skipped} skipped (no pattern or already current), ${failed} failed`
    );
    return { updated, skipped, failed, newMonthYear };
  },
});
