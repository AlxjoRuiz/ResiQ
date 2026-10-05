create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'project_url') then
    raise exception 'missing Vault secret: project_url';
  end if;

  if not exists (select 1 from vault.decrypted_secrets where name = 'email_worker_secret') then
    raise exception 'missing Vault secret: email_worker_secret';
  end if;

  perform cron.schedule(
    'process-email-jobs',
    '* * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/process-email-jobs',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'email_worker_secret')
        ),
        body := jsonb_build_object('scheduled_at', now()),
        timeout_milliseconds := 10000
      ) as request_id;
    $job$
  );
end;
$$;