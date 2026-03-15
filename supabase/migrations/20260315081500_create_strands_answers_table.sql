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
