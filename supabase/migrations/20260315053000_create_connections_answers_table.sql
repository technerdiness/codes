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
