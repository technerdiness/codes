create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;

create schema if not exists vault;
create extension if not exists "supabase_vault" with schema vault;

create schema if not exists util;

alter table public.roblox_game_code_articles
  add column if not exists wordpress_post_id bigint,
  add column if not exists wordpress_post_type text,
  add column if not exists wordpress_lookup_status text not null default 'pending',
  add column if not exists wordpress_lookup_error text,
  add column if not exists wordpress_lookup_requested_at timestamptz,
  add column if not exists wordpress_lookup_completed_at timestamptz;

alter table public.roblox_game_code_articles
  drop constraint if exists roblox_game_code_articles_wordpress_lookup_status_check;

alter table public.roblox_game_code_articles
  add constraint roblox_game_code_articles_wordpress_lookup_status_check
  check (
    wordpress_lookup_status in ('pending', 'queued', 'processing', 'resolved', 'not_found', 'error')
  );

create unique index if not exists roblox_game_code_articles_wordpress_post_id_key
  on public.roblox_game_code_articles (wordpress_post_id)
  where wordpress_post_id is not null;

create index if not exists roblox_game_code_articles_wordpress_lookup_status_idx
  on public.roblox_game_code_articles (wordpress_lookup_status);

create or replace function util.get_vault_secret(secret_name text)
returns text
language sql
security definer
set search_path = vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = secret_name
  order by created_at desc
  limit 1;
$$;

create or replace function public.prepare_wordpress_post_lookup()
returns trigger
language plpgsql
as $$
begin
  if new.wordpress_post_id is not null then
    new.wordpress_lookup_status := 'resolved';
    new.wordpress_lookup_error := null;
    new.wordpress_lookup_completed_at := coalesce(new.wordpress_lookup_completed_at, timezone('utc', now()));
    return new;
  end if;

  if tg_op = 'INSERT' or new.our_article_url is distinct from old.our_article_url then
    new.wordpress_post_id := null;
    new.wordpress_post_type := null;
    new.wordpress_lookup_status := 'pending';
    new.wordpress_lookup_error := null;
    new.wordpress_lookup_requested_at := null;
    new.wordpress_lookup_completed_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.enqueue_wordpress_post_lookup()
returns trigger
language plpgsql
security definer
set search_path = public, util, extensions
as $$
declare
  project_url text;
  webhook_secret text;
begin
  if new.our_article_url is null or new.wordpress_post_id is not null then
    return new;
  end if;

  project_url := util.get_vault_secret('project_url');
  webhook_secret := util.get_vault_secret('wordpress_lookup_webhook_secret');

  if project_url is null or webhook_secret is null then
    update public.roblox_game_code_articles
    set
      wordpress_lookup_status = 'error',
      wordpress_lookup_error =
        'Missing Vault secret project_url or wordpress_lookup_webhook_secret',
      wordpress_lookup_requested_at = timezone('utc', now()),
      wordpress_lookup_completed_at = timezone('utc', now())
    where id = new.id;

    return new;
  end if;

  update public.roblox_game_code_articles
  set
    wordpress_lookup_status = 'queued',
    wordpress_lookup_error = null,
    wordpress_lookup_requested_at = timezone('utc', now()),
    wordpress_lookup_completed_at = null
  where id = new.id;

  perform net.http_post(
    url := project_url || '/functions/v1/resolve-wordpress-post-id',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', webhook_secret
    ),
    body := jsonb_build_object(
      'articleId', new.id,
      'ourArticleUrl', new.our_article_url
    )
  );

  return new;
end;
$$;

drop trigger if exists prepare_wordpress_post_lookup on public.roblox_game_code_articles;
create trigger prepare_wordpress_post_lookup
before insert or update of our_article_url, wordpress_post_id
on public.roblox_game_code_articles
for each row
execute function public.prepare_wordpress_post_lookup();

drop trigger if exists enqueue_wordpress_post_lookup on public.roblox_game_code_articles;
create trigger enqueue_wordpress_post_lookup
after insert or update of our_article_url
on public.roblox_game_code_articles
for each row
when (new.our_article_url is not null and new.wordpress_post_id is null)
execute function public.enqueue_wordpress_post_lookup();
