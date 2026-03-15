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
  constraint wordle_answers_answer_date_key unique (answer_date),
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
