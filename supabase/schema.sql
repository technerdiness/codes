create extension if not exists pgcrypto;
create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
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

create table if not exists public.letroso_answers (
  id uuid primary key default gen_random_uuid(),
  answer_date date not null,
  answer_date_source text not null,
  answer text not null,
  source_url text not null,
  page_title text,
  og_title text,
  published_at timestamptz,
  modified_at timestamptz,
  fetched_at timestamptz not null,
  section_heading text not null,
  section_selector text not null,
  extracted_from text not null,
  tile_count integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint letroso_answers_answer_date_key
    unique (answer_date),
  constraint letroso_answers_answer_date_source_check
    check (
      answer_date_source in (
        'page-title',
        'og-title',
        'published-at',
        'modified-at',
        'fetched-at',
        'chrome:state-title'
      )
    ),
  constraint letroso_answers_extracted_from_check
    check (
      extracted_from in (
        'answer-reveal:data-answer',
        'answer-reveal:tiles',
        'schema:faq',
        'schema:article-body',
        'chrome:page-state'
      )
    ),
  constraint letroso_answers_tile_count_check
    check (tile_count >= 0)
);

comment on table public.letroso_answers is 'Letroso Answer';

create index if not exists letroso_answers_answer_idx
  on public.letroso_answers (answer);

create index if not exists letroso_answers_fetched_at_idx
  on public.letroso_answers (fetched_at desc);

drop trigger if exists set_letroso_answers_updated_at on public.letroso_answers;
create trigger set_letroso_answers_updated_at
before update on public.letroso_answers
for each row
execute function public.set_updated_at();

create table if not exists public.wordle_answers (
  id uuid primary key default gen_random_uuid(),
  answer_date date not null,
  answer_date_source text not null,
  answer text not null,
  source_url text not null,
  puzzle_id integer not null,
  days_since_launch integer not null,
  editor text,
  fetched_at timestamptz not null,
  extracted_from text not null,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint wordle_answers_answer_date_key
    unique (answer_date),
  constraint wordle_answers_answer_date_source_check
    check (answer_date_source in ('api:print-date', 'fetched-at')),
  constraint wordle_answers_extracted_from_check
    check (extracted_from in ('nyt:solution-endpoint')),
  constraint wordle_answers_puzzle_id_check
    check (puzzle_id > 0),
  constraint wordle_answers_days_since_launch_check
    check (days_since_launch >= 0)
);

comment on table public.wordle_answers is 'NYT Wordle Answer';

create index if not exists wordle_answers_answer_idx
  on public.wordle_answers (answer);

create index if not exists wordle_answers_fetched_at_idx
  on public.wordle_answers (fetched_at desc);

drop trigger if exists set_wordle_answers_updated_at on public.wordle_answers;
create trigger set_wordle_answers_updated_at
before update on public.wordle_answers
for each row
execute function public.set_updated_at();

create table if not exists public.connections_answers (
  id uuid primary key default gen_random_uuid(),
  answer_date date not null,
  answer_date_source text not null,
  source_url text not null,
  puzzle_id integer not null,
  editor text,
  category_count integer not null default 0,
  categories jsonb not null,
  fetched_at timestamptz not null,
  extracted_from text not null,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint connections_answers_answer_date_key
    unique (answer_date),
  constraint connections_answers_answer_date_source_check
    check (answer_date_source in ('api:print-date', 'fetched-at')),
  constraint connections_answers_extracted_from_check
    check (extracted_from in ('nyt:connections-endpoint')),
  constraint connections_answers_puzzle_id_check
    check (puzzle_id > 0),
  constraint connections_answers_category_count_check
    check (category_count >= 0)
);

comment on table public.connections_answers is 'NYT Connections Answers';

create index if not exists connections_answers_puzzle_id_idx
  on public.connections_answers (puzzle_id);

create index if not exists connections_answers_fetched_at_idx
  on public.connections_answers (fetched_at desc);

drop trigger if exists set_connections_answers_updated_at on public.connections_answers;
create trigger set_connections_answers_updated_at
before update on public.connections_answers
for each row
execute function public.set_updated_at();

create table if not exists public.strands_answers (
  id uuid primary key default gen_random_uuid(),
  answer_date date not null,
  answer_date_source text not null,
  source_url text not null,
  puzzle_id integer not null,
  clue text not null,
  spangram text not null,
  theme_word_count integer not null default 0,
  theme_words jsonb not null,
  theme_coords jsonb not null,
  spangram_coords jsonb not null,
  editor text,
  constructors text,
  starting_board jsonb not null,
  fetched_at timestamptz not null,
  extracted_from text not null,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint strands_answers_answer_date_key
    unique (answer_date),
  constraint strands_answers_answer_date_source_check
    check (answer_date_source in ('api:print-date', 'fetched-at')),
  constraint strands_answers_extracted_from_check
    check (extracted_from in ('nyt:strands-endpoint')),
  constraint strands_answers_puzzle_id_check
    check (puzzle_id > 0),
  constraint strands_answers_theme_word_count_check
    check (theme_word_count >= 0)
);

comment on table public.strands_answers is 'NYT Strands Answers';

create index if not exists strands_answers_puzzle_id_idx
  on public.strands_answers (puzzle_id);

create index if not exists strands_answers_fetched_at_idx
  on public.strands_answers (fetched_at desc);

drop trigger if exists set_strands_answers_updated_at on public.strands_answers;
create trigger set_strands_answers_updated_at
before update on public.strands_answers
for each row
execute function public.set_updated_at();

create or replace function public.invoke_nyt_puzzles_sync()
returns bigint
language plpgsql
security definer
set search_path = public, util, extensions
as $$
declare
  project_url text;
  webhook_secret text;
  request_id bigint;
begin
  project_url := util.get_vault_secret('project_url');
  webhook_secret := util.get_vault_secret('nyt_puzzles_sync_webhook_secret');

  if project_url is null or webhook_secret is null then
    raise exception 'Missing Vault secret project_url or nyt_puzzles_sync_webhook_secret';
  end if;

  select net.http_post(
    url := project_url || '/functions/v1/sync-nyt-puzzles',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', webhook_secret
    ),
    body := jsonb_build_object(
      'source', 'pg_cron',
      'triggeredAt', timezone('utc', now())
    )
  )
  into request_id;

  return request_id;
end;
$$;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'sync-nyt-puzzles-daily';
exception
  when undefined_table then
    null;
end;
$$;

select cron.schedule(
  'sync-nyt-puzzles-daily',
  '30 0 * * *',
  $$select public.invoke_nyt_puzzles_sync();$$
);

create or replace function public.invoke_codes_sync()
returns bigint
language plpgsql
security definer
set search_path = public, util, extensions
as $$
declare
  project_url text;
  webhook_secret text;
  request_id bigint;
begin
  project_url := util.get_vault_secret('project_url');
  webhook_secret := util.get_vault_secret('sync_codes_webhook_secret');

  if project_url is null or webhook_secret is null then
    raise exception 'Missing Vault secret project_url or sync_codes_webhook_secret';
  end if;

  select net.http_post(
    url := project_url || '/functions/v1/sync-codes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', webhook_secret
    ),
    body := jsonb_build_object(
      'source', 'pg_cron',
      'triggeredAt', timezone('utc', now())
    )
  )
  into request_id;

  return request_id;
end;
$$;

create or replace function public.invoke_letroso_sync()
returns bigint
language plpgsql
security definer
set search_path = public, util, extensions
as $$
declare
  project_url text;
  webhook_secret text;
  request_id bigint;
begin
  project_url := util.get_vault_secret('project_url');
  webhook_secret := util.get_vault_secret('sync_letroso_webhook_secret');

  if project_url is null or webhook_secret is null then
    raise exception 'Missing Vault secret project_url or sync_letroso_webhook_secret';
  end if;

  select net.http_post(
    url := project_url || '/functions/v1/sync-letroso',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', webhook_secret
    ),
    body := jsonb_build_object(
      'source', 'pg_cron',
      'triggeredAt', timezone('utc', now())
    )
  )
  into request_id;

  return request_id;
end;
$$;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname in (
    'sync-codes-every-6-hours',
    'sync-letroso-evening-retries',
    'sync-letroso-midnight-ist',
    'sync-letroso-one-am-ist',
    'sync-letroso-morning-902-ist',
    'sync-letroso-morning-910-ist'
  );
exception
  when undefined_table then
    null;
end;
$$;

select cron.schedule(
  'sync-codes-every-6-hours',
  '0 */6 * * *',
  $$select public.invoke_codes_sync();$$
);

select cron.schedule(
  'sync-letroso-morning-902-ist',
  '32 3 * * *',
  $$select public.invoke_letroso_sync();$$
);

select cron.schedule(
  'sync-letroso-morning-910-ist',
  '40 3 * * *',
  $$select public.invoke_letroso_sync();$$
);
