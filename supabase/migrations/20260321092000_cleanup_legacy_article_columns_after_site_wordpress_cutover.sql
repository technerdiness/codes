-- Run this migration only after the application and Edge Functions have been
-- updated to read from:
--   public.roblox_game_code_articles.source_beebom_url
--   public.roblox_game_code_articles.technerdiness_article_url
--   public.roblox_game_code_articles.gamingwize_article_url
--   public.technerdiness_wordpress_state
--   public.gamingwize_wordpress_state

drop trigger if exists prepare_wordpress_post_lookup on public.roblox_game_code_articles;
drop trigger if exists enqueue_wordpress_post_lookup on public.roblox_game_code_articles;

drop function if exists public.prepare_wordpress_post_lookup();
drop function if exists public.enqueue_wordpress_post_lookup();

drop index if exists roblox_game_code_articles_wordpress_post_id_key;
drop index if exists roblox_game_code_articles_wordpress_lookup_status_idx;
drop index if exists roblox_game_code_articles_last_wordpress_sync_at_idx;

alter table public.roblox_game_code_articles
  drop constraint if exists roblox_game_code_articles_our_article_url_key,
  drop constraint if exists roblox_game_code_articles_beebom_article_url_key;

alter table public.roblox_game_code_articles
  alter column game_name drop not null,
  alter column our_article_url drop not null,
  alter column beebom_article_url drop not null;

alter table public.roblox_game_code_articles
  drop column if exists wordpress_post_id,
  drop column if exists wordpress_post_type,
  drop column if exists wordpress_lookup_status,
  drop column if exists wordpress_lookup_error,
  drop column if exists wordpress_lookup_requested_at,
  drop column if exists wordpress_lookup_completed_at,
  drop column if exists last_wordpress_codes_hash,
  drop column if exists last_wordpress_sync_at,
  drop column if exists last_wordpress_sync_error,
  drop column if exists our_article_url,
  drop column if exists beebom_article_url;

create or replace function public.enqueue_wordpress_lookup_for_site_article_urls()
returns trigger
language plpgsql
security definer
set search_path = public, util, extensions
as $$
declare
  project_url text;
  webhook_secret text;
  requested_at timestamptz := timezone('utc', now());
  config_error text := 'Missing Vault secret project_url or wordpress_lookup_webhook_secret';
begin
  insert into public.technerdiness_wordpress_state (
    article_id,
    wordpress_post_id,
    wordpress_post_type,
    wordpress_lookup_status,
    wordpress_lookup_error,
    wordpress_lookup_requested_at,
    wordpress_lookup_completed_at,
    last_wordpress_codes_hash,
    last_wordpress_sync_at,
    last_wordpress_sync_error
  )
  values (
    new.id,
    null,
    null,
    case when new.technerdiness_article_url is null then 'pending' else 'queued' end,
    null,
    case when new.technerdiness_article_url is null then null else requested_at end,
    null,
    null,
    null,
    null
  )
  on conflict (article_id) do update
  set
    wordpress_post_id = excluded.wordpress_post_id,
    wordpress_post_type = excluded.wordpress_post_type,
    wordpress_lookup_status = excluded.wordpress_lookup_status,
    wordpress_lookup_error = excluded.wordpress_lookup_error,
    wordpress_lookup_requested_at = excluded.wordpress_lookup_requested_at,
    wordpress_lookup_completed_at = excluded.wordpress_lookup_completed_at,
    last_wordpress_codes_hash = excluded.last_wordpress_codes_hash,
    last_wordpress_sync_at = excluded.last_wordpress_sync_at,
    last_wordpress_sync_error = excluded.last_wordpress_sync_error;

  insert into public.gamingwize_wordpress_state (
    article_id,
    wordpress_post_id,
    wordpress_post_type,
    wordpress_lookup_status,
    wordpress_lookup_error,
    wordpress_lookup_requested_at,
    wordpress_lookup_completed_at,
    last_wordpress_codes_hash,
    last_wordpress_sync_at,
    last_wordpress_sync_error
  )
  values (
    new.id,
    null,
    null,
    case when new.gamingwize_article_url is null then 'pending' else 'queued' end,
    null,
    case when new.gamingwize_article_url is null then null else requested_at end,
    null,
    null,
    null,
    null
  )
  on conflict (article_id) do update
  set
    wordpress_post_id = excluded.wordpress_post_id,
    wordpress_post_type = excluded.wordpress_post_type,
    wordpress_lookup_status = excluded.wordpress_lookup_status,
    wordpress_lookup_error = excluded.wordpress_lookup_error,
    wordpress_lookup_requested_at = excluded.wordpress_lookup_requested_at,
    wordpress_lookup_completed_at = excluded.wordpress_lookup_completed_at,
    last_wordpress_codes_hash = excluded.last_wordpress_codes_hash,
    last_wordpress_sync_at = excluded.last_wordpress_sync_at,
    last_wordpress_sync_error = excluded.last_wordpress_sync_error;

  if new.technerdiness_article_url is null and new.gamingwize_article_url is null then
    return new;
  end if;

  project_url := util.get_vault_secret('project_url');
  webhook_secret := util.get_vault_secret('wordpress_lookup_webhook_secret');

  if project_url is null or webhook_secret is null then
    if new.technerdiness_article_url is not null then
      update public.technerdiness_wordpress_state
      set
        wordpress_lookup_status = 'error',
        wordpress_lookup_error = config_error,
        wordpress_lookup_completed_at = requested_at
      where article_id = new.id;
    end if;

    if new.gamingwize_article_url is not null then
      update public.gamingwize_wordpress_state
      set
        wordpress_lookup_status = 'error',
        wordpress_lookup_error = config_error,
        wordpress_lookup_completed_at = requested_at
      where article_id = new.id;
    end if;

    return new;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/resolve-wordpress-post-id',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', webhook_secret
    ),
    body := jsonb_build_object(
      'articleId', new.id
    )
  );

  return new;
end;
$$;
