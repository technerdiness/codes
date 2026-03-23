# Codes Admin Panel

Small internal React admin UI for:

- creating and editing article mappings
- surfacing failed WordPress post ID resolution state
- rerunning `resolve-wordpress-post-id`
- running `sync-codes` for all articles or one article
- triggering `sync-letroso` and `sync-nyt-puzzles`

## Run

From the repo root:

```bash
cd admin
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## Env Setup

Create `admin/.env` from `admin/.env.example` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SYNC_CODES_SECRET`
- `VITE_RESOLVE_SECRET`

Optional:

- `VITE_SYNC_LETROSO_SECRET`
- `VITE_NYT_PUZZLES_SECRET`

## Important

- This panel is intended for local or private internal use
- Vite exposes `VITE_` env values to the browser bundle
- Do not deploy this publicly with admin secrets
