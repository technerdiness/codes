create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.roblox_game_code_articles (
  id uuid primary key default gen_random_uuid(),
  game_name text not null,
  our_article_url text not null,
  beebom_article_url text not null,
  source_provider text not null default 'beebom',
  last_scraped_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint roblox_game_code_articles_source_provider_check
    check (source_provider = 'beebom'),
  constraint roblox_game_code_articles_our_article_url_key
    unique (our_article_url),
  constraint roblox_game_code_articles_beebom_article_url_key
    unique (beebom_article_url)
);

create index if not exists roblox_game_code_articles_game_name_idx
  on public.roblox_game_code_articles (game_name);

create index if not exists roblox_game_code_articles_last_scraped_at_idx
  on public.roblox_game_code_articles (last_scraped_at desc nulls last);

drop trigger if exists set_roblox_game_code_articles_updated_at on public.roblox_game_code_articles;
create trigger set_roblox_game_code_articles_updated_at
before update on public.roblox_game_code_articles
for each row
execute function public.set_updated_at();

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
