create extension if not exists pgcrypto;
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;
create schema if not exists vault;
create extension if not exists "supabase_vault" with schema vault;
create schema if not exists util;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

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

create table if not exists public.roblox_game_code_articles (
  id uuid primary key default gen_random_uuid(),
  game_name text not null,
  our_article_url text not null,
  beebom_article_url text not null,
  source_provider text not null default 'beebom',
  wordpress_post_id bigint,
  wordpress_post_type text,
  wordpress_lookup_status text not null default 'pending',
  wordpress_lookup_error text,
  wordpress_lookup_requested_at timestamptz,
  wordpress_lookup_completed_at timestamptz,
  last_wordpress_codes_hash text,
  last_wordpress_sync_at timestamptz,
  last_wordpress_sync_error text,
  last_scraped_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint roblox_game_code_articles_source_provider_check
    check (source_provider = 'beebom'),
  constraint roblox_game_code_articles_wordpress_lookup_status_check
    check (
      wordpress_lookup_status in ('pending', 'queued', 'processing', 'resolved', 'not_found', 'error')
    ),
  constraint roblox_game_code_articles_our_article_url_key
    unique (our_article_url),
  constraint roblox_game_code_articles_beebom_article_url_key
    unique (beebom_article_url)
);

create index if not exists roblox_game_code_articles_game_name_idx
  on public.roblox_game_code_articles (game_name);

create index if not exists roblox_game_code_articles_last_scraped_at_idx
  on public.roblox_game_code_articles (last_scraped_at desc nulls last);

create unique index if not exists roblox_game_code_articles_wordpress_post_id_key
  on public.roblox_game_code_articles (wordpress_post_id)
  where wordpress_post_id is not null;

create index if not exists roblox_game_code_articles_wordpress_lookup_status_idx
  on public.roblox_game_code_articles (wordpress_lookup_status);

create index if not exists roblox_game_code_articles_last_wordpress_sync_at_idx
  on public.roblox_game_code_articles (last_wordpress_sync_at desc nulls last);

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

drop trigger if exists set_roblox_game_code_articles_updated_at on public.roblox_game_code_articles;
create trigger set_roblox_game_code_articles_updated_at
before update on public.roblox_game_code_articles
for each row
execute function public.set_updated_at();

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

create table if not exists public.roblox_game_codes (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.roblox_game_code_articles(id) on delete cascade,
  game_name text not null,
  provider text not null default 'beebom',
  code text not null,
  status text not null check (status in ('active', 'expired')),
  rewards_text text,
  is_new boolean not null default false,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint roblox_game_codes_provider_check
    check (provider = 'beebom'),
  constraint roblox_game_codes_article_code_key
    unique (article_id, code)
);

create index if not exists roblox_game_codes_game_name_idx
  on public.roblox_game_codes (game_name);

create index if not exists roblox_game_codes_status_idx
  on public.roblox_game_codes (status);

create index if not exists roblox_game_codes_last_seen_at_idx
  on public.roblox_game_codes (last_seen_at desc);

drop trigger if exists set_roblox_game_codes_updated_at on public.roblox_game_codes;
create trigger set_roblox_game_codes_updated_at
before update on public.roblox_game_codes
for each row
execute function public.set_updated_at();
