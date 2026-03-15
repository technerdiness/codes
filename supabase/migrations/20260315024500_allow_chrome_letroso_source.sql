alter table public.letroso_answers
  drop constraint if exists letroso_answers_answer_date_source_check;

alter table public.letroso_answers
  add constraint letroso_answers_answer_date_source_check
    check (
      answer_date_source in (
        'page-title',
        'og-title',
        'published-at',
        'modified-at',
        'fetched-at',
        'chrome:state-title'
      )
    );

alter table public.letroso_answers
  drop constraint if exists letroso_answers_extracted_from_check;

alter table public.letroso_answers
  add constraint letroso_answers_extracted_from_check
    check (
      extracted_from in (
        'answer-reveal:data-answer',
        'answer-reveal:tiles',
        'schema:faq',
        'schema:article-body',
        'chrome:page-state'
      )
    );
