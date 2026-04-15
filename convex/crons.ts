import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync all configured NYT puzzles every 6 hours so later-publishing page-based puzzles are picked up the same day.
crons.cron(
  "sync-nyt-puzzles-every-6-hours",
  "45 */6 * * *",
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

// Sync Contexto at 03:35 UTC (09:05 IST)
crons.cron(
  "sync-contexto-morning-905-ist",
  "35 3 * * *",
  internal.syncContexto.run,
  {},
);

// Sync Contexto at 03:45 UTC (09:15 IST)
crons.cron(
  "sync-contexto-morning-915-ist",
  "45 3 * * *",
  internal.syncContexto.run,
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

// Sync LinkedIn puzzles daily at 05:30 UTC (11:00 IST)
crons.cron(
  "sync-linkedin-puzzles-daily",
  "30 5 * * *",
  internal.syncLinkedInPuzzles.run,
  {},
);

export default crons;
