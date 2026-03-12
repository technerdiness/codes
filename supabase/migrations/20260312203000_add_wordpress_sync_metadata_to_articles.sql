alter table public.roblox_game_code_articles
  add column if not exists last_wordpress_codes_hash text,
  add column if not exists last_wordpress_sync_at timestamptz,
  add column if not exists last_wordpress_sync_error text;

create index if not exists roblox_game_code_articles_last_wordpress_sync_at_idx
  on public.roblox_game_code_articles (last_wordpress_sync_at desc nulls last);
