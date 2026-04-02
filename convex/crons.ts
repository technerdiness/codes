import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync all configured NYT puzzles daily at 00:30 UTC
crons.cron(
  "sync-nyt-puzzles-daily",
  "30 0 * * *",
  internal.syncNytPuzzles.run,
  {},
);

// Sync game codes every 6 hours
crons.cron(
  "sync-codes-every-6-hours",
  "0 */6 * * *",
  internal.syncCodes.run,
  {},
);

// Sync Letroso at 03:32 UTC (09:02 IST)
crons.cron(
  "sync-letroso-morning-902-ist",
  "32 3 * * *",
  internal.syncLetroso.run,
  {},
);

// Sync Letroso at 03:40 UTC (09:10 IST)
crons.cron(
  "sync-letroso-morning-910-ist",
  "40 3 * * *",
  internal.syncLetroso.run,
  {},
);

// Collect gaming news at 6:00 AM IST (00:30 UTC)
crons.cron(
  "collect-gaming-news-morning",
  "30 0 * * *",
  internal.collectGamingNews.run,
  {},
);

// Collect gaming news at 6:00 PM IST (12:30 UTC)
crons.cron(
  "collect-gaming-news-evening",
  "30 12 * * *",
  internal.collectGamingNews.run,
  {},
);

// Write gaming news articles at 6:30 AM IST (01:00 UTC)
crons.cron(
  "write-gaming-news-morning",
  "0 1 * * *",
  internal.writeGamingNewsArticle.run,
  {},
);

// Write gaming news articles at 6:30 PM IST (13:00 UTC)
crons.cron(
  "write-gaming-news-evening",
  "0 13 * * *",
  internal.writeGamingNewsArticle.run,
  {},
);

// Post one game's active codes to X every 2 hours
crons.cron(
  "post-codes-to-x-every-2-hours",
  "0 */2 * * *",
  internal.postCodesToX.run,
  {},
);

// Update article titles (month + year in brackets) on the 1st of every month at 1 AM UTC
crons.cron(
  "update-article-titles-monthly",
  "0 1 1 * *",
  internal.updateArticleTitles.run,
  {},
);

export default crons;
