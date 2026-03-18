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
    'sync-letroso-one-am-ist'
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
  'sync-letroso-evening-retries',
  '35,40,45,50,55 18 * * *',
  $$select public.invoke_letroso_sync();$$
);

select cron.schedule(
  'sync-letroso-midnight-ist',
  '0 19 * * *',
  $$select public.invoke_letroso_sync();$$
);

select cron.schedule(
  'sync-letroso-one-am-ist',
  '30 19 * * *',
  $$select public.invoke_letroso_sync();$$
);
