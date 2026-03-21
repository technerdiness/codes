alter table public.roblox_game_code_articles
  add column if not exists status text,
  add column if not exists source_beebom_url text,
  add column if not exists technerdiness_article_url text,
  add column if not exists gamingwize_article_url text;

update public.roblox_game_code_articles
set
  source_beebom_url = coalesce(source_beebom_url, beebom_article_url),
  technerdiness_article_url = coalesce(technerdiness_article_url, our_article_url);

update public.roblox_game_code_articles
set status = case
  when coalesce(game_name, '') <> ''
    or source_beebom_url is not null
    or technerdiness_article_url is not null
    or gamingwize_article_url is not null
  then 'active'
  else 'draft'
end
where status is null;

alter table public.roblox_game_code_articles
  alter column status set default 'draft',
  alter column status set not null;

alter table public.roblox_game_code_articles
  drop constraint if exists roblox_game_code_articles_status_check;

alter table public.roblox_game_code_articles
  add constraint roblox_game_code_articles_status_check
    check (status in ('draft', 'active', 'archived'));

create unique index if not exists roblox_game_code_articles_source_beebom_url_key
  on public.roblox_game_code_articles (source_beebom_url)
  where source_beebom_url is not null;

create unique index if not exists roblox_game_code_articles_technerdiness_article_url_key
  on public.roblox_game_code_articles (technerdiness_article_url)
  where technerdiness_article_url is not null;

create unique index if not exists roblox_game_code_articles_gamingwize_article_url_key
  on public.roblox_game_code_articles (gamingwize_article_url)
  where gamingwize_article_url is not null;

create index if not exists roblox_game_code_articles_status_idx
  on public.roblox_game_code_articles (status);
