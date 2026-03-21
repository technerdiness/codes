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

  update public.roblox_game_code_articles
  set
    wordpress_post_id = null,
    wordpress_post_type = null,
    wordpress_lookup_status = case
      when new.technerdiness_article_url is null then 'pending'
      else 'queued'
    end,
    wordpress_lookup_error = null,
    wordpress_lookup_requested_at = case
      when new.technerdiness_article_url is null then null
      else requested_at
    end,
    wordpress_lookup_completed_at = null,
    last_wordpress_codes_hash = null,
    last_wordpress_sync_at = null,
    last_wordpress_sync_error = null
  where id = new.id;

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
      update public.roblox_game_code_articles
      set
        wordpress_lookup_status = 'error',
        wordpress_lookup_error = config_error,
        wordpress_lookup_completed_at = requested_at
      where id = new.id;

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

drop trigger if exists enqueue_wordpress_lookup_for_site_article_urls on public.roblox_game_code_articles;
create trigger enqueue_wordpress_lookup_for_site_article_urls
after insert or update of technerdiness_article_url, gamingwize_article_url
on public.roblox_game_code_articles
for each row
execute function public.enqueue_wordpress_lookup_for_site_article_urls();
