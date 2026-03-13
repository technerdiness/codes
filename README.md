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
- `npm run reveal:letroso:supabase -- [beebom-letroso-url]`
- `npm run sync:codes -- --dry-run`
- `npm run typecheck`

## Adding new automations

Add new runnable scripts under `src/automations/` and keep reusable logic out of those files:

- put source-specific parsing in `src/providers/`
- put API/database clients in `src/integrations/`
- put shared models in `src/types/`

That keeps each automation small and makes it easier to add new providers and workflows without growing the repo root.
