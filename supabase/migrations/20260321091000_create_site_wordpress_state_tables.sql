create table if not exists public.technerdiness_wordpress_state (
  article_id uuid primary key references public.roblox_game_code_articles(id) on delete cascade,
  wordpress_post_id bigint,
  wordpress_post_type text,
  wordpress_lookup_status text not null default 'pending',
  wordpress_lookup_error text,
  wordpress_lookup_requested_at timestamptz,
  wordpress_lookup_completed_at timestamptz,
  last_wordpress_codes_hash text,
  last_wordpress_sync_at timestamptz,
  last_wordpress_sync_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint technerdiness_wordpress_state_post_type_check
    check (wordpress_post_type is null or wordpress_post_type in ('post', 'page')),
  constraint technerdiness_wordpress_state_lookup_status_check
    check (
      wordpress_lookup_status in ('pending', 'queued', 'processing', 'resolved', 'not_found', 'error')
    )
);

create unique index if not exists technerdiness_wordpress_state_wordpress_post_id_key
  on public.technerdiness_wordpress_state (wordpress_post_id)
  where wordpress_post_id is not null;

create index if not exists technerdiness_wordpress_state_lookup_status_idx
  on public.technerdiness_wordpress_state (wordpress_lookup_status);

create index if not exists technerdiness_wordpress_state_last_sync_at_idx
  on public.technerdiness_wordpress_state (last_wordpress_sync_at desc nulls last);

drop trigger if exists set_technerdiness_wordpress_state_updated_at on public.technerdiness_wordpress_state;
create trigger set_technerdiness_wordpress_state_updated_at
before update on public.technerdiness_wordpress_state
for each row
execute function public.set_updated_at();

create table if not exists public.gamingwize_wordpress_state (
  article_id uuid primary key references public.roblox_game_code_articles(id) on delete cascade,
  wordpress_post_id bigint,
  wordpress_post_type text,
  wordpress_lookup_status text not null default 'pending',
  wordpress_lookup_error text,
  wordpress_lookup_requested_at timestamptz,
  wordpress_lookup_completed_at timestamptz,
  last_wordpress_codes_hash text,
  last_wordpress_sync_at timestamptz,
  last_wordpress_sync_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint gamingwize_wordpress_state_post_type_check
    check (wordpress_post_type is null or wordpress_post_type in ('post', 'page')),
  constraint gamingwize_wordpress_state_lookup_status_check
    check (
      wordpress_lookup_status in ('pending', 'queued', 'processing', 'resolved', 'not_found', 'error')
    )
);

create unique index if not exists gamingwize_wordpress_state_wordpress_post_id_key
  on public.gamingwize_wordpress_state (wordpress_post_id)
  where wordpress_post_id is not null;

create index if not exists gamingwize_wordpress_state_lookup_status_idx
  on public.gamingwize_wordpress_state (wordpress_lookup_status);

create index if not exists gamingwize_wordpress_state_last_sync_at_idx
  on public.gamingwize_wordpress_state (last_wordpress_sync_at desc nulls last);

drop trigger if exists set_gamingwize_wordpress_state_updated_at on public.gamingwize_wordpress_state;
create trigger set_gamingwize_wordpress_state_updated_at
before update on public.gamingwize_wordpress_state
for each row
execute function public.set_updated_at();

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
  last_wordpress_sync_error,
  created_at,
  updated_at
)
select
  id,
  wordpress_post_id,
  wordpress_post_type,
  wordpress_lookup_status,
  wordpress_lookup_error,
  wordpress_lookup_requested_at,
  wordpress_lookup_completed_at,
  last_wordpress_codes_hash,
  last_wordpress_sync_at,
  last_wordpress_sync_error,
  created_at,
  updated_at
from public.roblox_game_code_articles
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
  last_wordpress_sync_error = excluded.last_wordpress_sync_error,
  updated_at = excluded.updated_at;
