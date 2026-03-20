# Codes Automations

Automation workspace for scraping puzzle answers and game codes, with Supabase Edge Functions as the production sync path.

## Project layout

- `src/automations/`: runnable workflows and CLI entry points
- `src/providers/`: source-specific scraping logic
- `src/integrations/`: external system integrations such as Supabase and WordPress
- `src/types/`: shared TypeScript contracts
- `supabase/`: database schema, migrations, config, and Edge Functions

## Commands

- `npm run scrape -- <beebom-article-url>`
- `npm run reveal:letroso:chrome -- --timezone Asia/Tokyo --word-only`
  Local Letroso extraction through your installed Chrome profile via Playwright. This is a read-only local utility for manual checks.
- `npm run reveal:connections -- --timezone Asia/Kolkata --json`
  Read-only local fetch for NYT Connections. Use it for manual checks or date backfills before triggering the Edge Function.
- `npm run reveal:strands -- --timezone Asia/Kolkata --json`
  Read-only local fetch for NYT Strands.
- `npm run reveal:wordle -- --timezone Asia/Kolkata --json`
  Read-only local fetch for NYT Wordle.
- `npm run typecheck`

## Production sync path

Supabase Edge Functions are the only production write/update path for:

- codes
- Letroso
- NYT Wordle
- NYT Connections
- NYT Strands

The local CLIs are intentionally read-only now. Use them for inspection, debugging, and date-specific lookups. Use the Edge Functions when you want Supabase and WordPress to be updated.

## Supabase scheduler

The scheduled jobs now run from Supabase instead of GitHub Actions.

Files involved:
- `supabase/functions/sync-codes/index.ts`
- `supabase/functions/sync-letroso/index.ts`
- `supabase/functions/sync-nyt-puzzles/index.ts`
- `supabase/migrations/20260318010000_schedule_nyt_puzzles_sync.sql`
- `supabase/migrations/20260318023000_schedule_codes_and_letroso_sync.sql`

Setup steps:
- Deploy the Edge Functions:
  - `supabase functions deploy sync-codes --use-api --no-verify-jwt`
  - `supabase functions deploy sync-letroso --use-api --no-verify-jwt`
- Deploy the Edge Function: `supabase functions deploy sync-nyt-puzzles --use-api --no-verify-jwt`
- Set Supabase function secrets for the WordPress, Supabase, timezone, and marker env vars used by the NYT sync
- Store the project URL in Vault as `project_url`
- Store the webhook secret in both:
  - Edge Function secret: `NYT_PUZZLES_SYNC_WEBHOOK_SECRET`
  - Vault secret: `nyt_puzzles_sync_webhook_secret`
- Do the same for codes:
  - Edge Function secret: `SYNC_CODES_WEBHOOK_SECRET`
  - Vault secret: `sync_codes_webhook_secret`
- Do the same for Letroso:
  - Edge Function secret: `SYNC_LETROSO_WEBHOOK_SECRET`
  - Vault secret: `sync_letroso_webhook_secret`

Schedules:
- NYT puzzles: `30 0 * * *` -> `6:00 AM IST`
- Roblox codes: `0 */6 * * *`
- Letroso: `32 3 * * *`, `40 3 * * *` -> `9:02 AM IST`, `9:10 AM IST`

Note:
- Use the `--use-api` deploy path for these functions. Supabase announced on February 14, 2025 that this path supports shared imports and files outside the single function folder. The default deploy path can fail with `Module not found` for sibling `_shared` imports.

## Adding new automations

Add new runnable scripts under `src/automations/` and keep reusable logic out of those files:

- put source-specific parsing in `src/providers/`
- put API/database clients in `src/integrations/`
- put shared models in `src/types/`

Keep local CLIs read-only when possible. If a workflow needs to write to Supabase or WordPress on a schedule, prefer an Edge Function entrypoint under `supabase/functions/`.
