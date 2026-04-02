# Codes Automations

Convex-powered automation for scraping game codes, puzzle answers, and syncing them to WordPress.

## Project layout

- `convex/`: schema, queries, mutations, actions, cron jobs, and shared libraries
- `admin/`: React admin panel for managing articles and triggering syncs
- `scripts/`: one-time migration utilities

## Setup

1. Install dependencies:
   ```bash
   npm install
   cd admin && npm install
   ```

2. Start Convex dev server:
   ```bash
   npx convex dev
   ```

3. Set Convex environment variables:
   ```bash
   npx convex env set WORDPRESS_USERNAME "your-username"
   npx convex env set WORDPRESS_APPLICATION_PASSWORD "your-app-password"
   npx convex env set GW_WORDPRESS_USERNAME "your-gw-username"
   npx convex env set GW_WORDPRESS_APPLICATION_PASSWORD "your-gw-app-password"
   npx convex env set WORDPRESS_UPDATE_TIMEZONE "Asia/Kolkata"
   ```

4. Run the admin panel:
   ```bash
   cd admin && npm run dev
   ```

## Convex functions

All backend logic runs as Convex functions:

- **syncCodes**: scrapes Beebom for game codes, saves to DB, updates WordPress
- **syncLetroso**: scrapes Letroso answer, saves to DB, updates WordPress
- **syncNytPuzzles**: fetches Wordle/Connections/Strands/Spelling Bee/Letter Boxed/Sudoku/Pips from NYT, saves answers, and updates WordPress where configured
- **resolveWordpressPostId**: looks up WordPress post IDs by article URL

## Cron schedules

| Job | Schedule | IST |
|-----|----------|-----|
| NYT puzzles | `30 0 * * *` | 6:00 AM |
| Roblox codes | `0 */6 * * *` | every 6 hours |
| Letroso (1) | `32 3 * * *` | 9:02 AM |
| Letroso (2) | `40 3 * * *` | 9:10 AM |

## Dashboard

View data, logs, and cron status at the [Convex dashboard](https://dashboard.convex.dev).
