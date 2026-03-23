import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync NYT puzzles daily at 00:30 UTC
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

export default crons;
