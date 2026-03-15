# Codes Automations

Automation workspace for scraping game codes and syncing updates into Supabase and WordPress.

## Project layout

- `src/automations/`: runnable workflows and CLI entry points
- `src/providers/`: source-specific scraping logic
- `src/integrations/`: external system integrations such as Supabase and WordPress
- `src/types/`: shared TypeScript contracts
- `supabase/`: database schema, migrations, config, and Edge Functions

## Commands

- `npm run scrape -- <beebom-article-url>`
- `npm run scrape:supabase -- <beebom-article-url> --game-name "Game Name" --our-article-url <our-article-url>`
- `npm run reveal:letroso -- [beebom-letroso-url]`
  Updates Supabase and the Letroso WordPress marker block by default.
- `npm run reveal:letroso:chrome -- --timezone Asia/Tokyo --word-only`
  Local Letroso extraction through your installed Chrome profile via Playwright. It supports the same Supabase and WordPress sync flags as the Beebom CLI; use `--dry-run` to inspect without writing.
- `npm run reveal:letroso:supabase -- [beebom-letroso-url]`
- `npm run reveal:connections -- --timezone Asia/Kolkata --dry-run --json`
  Fetches the NYT Connections groups from the NYT endpoint, stores them in Supabase, and updates the configured WordPress article reveal block. Add `<!-- TN_CONNECTIONS_ANSWER_START -->` and `<!-- TN_CONNECTIONS_ANSWER_END -->` to the article where the block should appear. If you also add `<!-- TN_CONNECTIONS_CURRENT_DATE_START -->` and `<!-- TN_CONNECTIONS_CURRENT_DATE_END -->`, the sync will fill in the answer date there too.
- `npm run reveal:strands -- --timezone Asia/Kolkata --dry-run --json`
  Fetches the NYT Strands answers from the NYT endpoint, stores them in Supabase, and updates the configured WordPress article. Add `<!-- TN_STRANDS_SPANGRAM_START -->` and `<!-- TN_STRANDS_SPANGRAM_END -->` for the spangram block, plus `<!-- TN_STRANDS_THEME_WORDS_START -->` and `<!-- TN_STRANDS_THEME_WORDS_END -->` for the theme words block. If you also add `<!-- TN_STRANDS_CURRENT_DATE_START -->` and `<!-- TN_STRANDS_CURRENT_DATE_END -->`, the sync will fill in the answer date there too. If you add `<!-- TN_STRANDS_CLUE_START -->` and `<!-- TN_STRANDS_CLUE_END -->`, the sync will fill in the clue as plain text.
- `npm run reveal:wordle -- --timezone Asia/Kolkata --dry-run --json`
  Fetches the NYT Wordle answer from the NYT endpoint, stores it in Supabase, and updates the configured WordPress article reveal block. Add `<!-- TN_WORDLE_ANSWER_START -->` and `<!-- TN_WORDLE_ANSWER_END -->` to the article where the block should appear.
- `npm run sync:codes -- --dry-run`
- `npm run typecheck`

## Adding new automations

Add new runnable scripts under `src/automations/` and keep reusable logic out of those files:

- put source-specific parsing in `src/providers/`
- put API/database clients in `src/integrations/`
- put shared models in `src/types/`

That keeps each automation small and makes it easier to add new providers and workflows without growing the repo root.
