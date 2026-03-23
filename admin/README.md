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

- `VITE_CONVEX_URL` — your Convex deployment URL

## Important

- This panel is intended for local or private internal use
- Do not deploy this publicly without authentication
