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
  constraint letroso_answers_answer_date_key unique (answer_date),
  constraint letroso_answers_answer_date_source_check
    check (answer_date_source in ('page-title', 'og-title', 'published-at', 'modified-at', 'fetched-at')),
  constraint letroso_answers_extracted_from_check
    check (
      extracted_from in (
        'answer-reveal:data-answer',
        'answer-reveal:tiles',
        'schema:faq',
        'schema:article-body'
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
