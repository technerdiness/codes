# Admin Panel Features

## Purpose

This admin panel is an internal operations UI for managing Roblox code articles
across:

- Beebom source articles
- Tech Nerdiness target articles
- Gaming Wize target articles
- WordPress post ID resolution state
- Manual sync and rerun workflows

It is intended for local or private internal use, not public deployment with
exposed admin credentials.

## Current V1 Structure

The admin panel should have a sidebar with only two sections:

- `Automations`
- `Code Articles`

### 1. Automations

- Buttons to manually run project functions
- Support dry run and real run where applicable
- For now include:
  - `sync-codes`
  - `sync-letroso`
  - `sync-nyt-puzzles`
- Show the latest action result clearly

### 2. Code Articles

- Load all rows from `roblox_game_code_articles`
- Search by game name or URL
- Sort rows by game name, status, or last updated
- Show row data clearly:
  - `game_name`
  - `status`
  - `source_beebom_url`
  - `technerdiness_article_url`
  - `gamingwize_article_url`
  - Tech Nerdiness post ID
  - Gaming Wize post ID
- Edit any row
- `Add New` button to create a row
- If an entered URL already exists on another row, offer opening that existing
  row for editing instead of inserting a duplicate
- Row-level actions should include:
  - edit
  - resolve post IDs
  - dry run sync
  - real sync

## Important Safety Rules

- The panel should be treated as admin-only
- Do not deploy it publicly with a hardcoded service role key
- Real sync buttons should require confirmation

## Good Next Features After V1

- Bulk select and bulk rerun resolve
- Bulk update of missing Gaming Wize or Tech Nerdiness links
- Dedicated queue view for failed resolve attempts
- Dedicated queue view for sync failures
- Supabase Auth gated access
- Server-side proxy so service role keys and webhook secrets are never exposed
  to the browser
