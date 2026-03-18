create extension if not exists pg_cron;

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
