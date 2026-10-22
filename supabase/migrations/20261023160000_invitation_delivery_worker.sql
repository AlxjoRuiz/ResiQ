-- Cola de invitaciones (entrega 3): el trabajador puede enviar invitaciones cuando el envío
-- real esté activo. Esta migración NO lo activa: private.invitation_delivery.live sigue en
-- false y los trabajos retenidos («held») no cambian.
-- * El trabajador solo reclama invitaciones con el envío activo y dentro del límite diario
--   (daily_limit, por defecto 90, para dejar margen a los demás avisos en el plan de Resend).
-- * Justo antes de enviar, issue_invitation_for_job revalida la invitación y genera el código
--   (72 horas). Si ya no corresponde, el trabajo queda cancelado y no se envía.
-- * El envío real se activa solo con private.set_invitation_delivery(true, ...) desde SQL.
begin;

alter table private.invitation_delivery
  add column daily_limit integer not null default 90 check (daily_limit between 1 and 1000);

create or replace function public.claim_email_jobs(worker_name text, batch_size integer default 10)
returns setof public.email_jobs language plpgsql security definer set search_path = '' as $$
declare
  batch integer := greatest(1, least(batch_size, 50));
  live_value boolean;
  daily_limit_value integer;
  invitation_slots integer := 0;
begin
  select live, daily_limit into live_value, daily_limit_value from private.invitation_delivery;
  if coalesce(live_value, false) then
    invitation_slots := greatest(0, daily_limit_value - (
      select count(*) from public.email_jobs
      where template_key = 'resident_invitation'
        and (status = 'processing' or (status = 'accepted' and updated_at > now() - interval '24 hours'))));
  end if;
  return query
  with regular as (
    select id, next_attempt_at from public.email_jobs
    where template_key <> 'resident_invitation'
      and (status = 'queued' or (status = 'processing' and locked_until < now())) and next_attempt_at <= now()
    order by next_attempt_at for update skip locked limit batch
  ), invitation_jobs as (
    select id, next_attempt_at from public.email_jobs
    where template_key = 'resident_invitation'
      and (status = 'queued' or (status = 'processing' and locked_until < now())) and next_attempt_at <= now()
    order by next_attempt_at for update skip locked limit least(batch, invitation_slots)
  ), picked as (
    select id from (select * from regular union all select * from invitation_jobs) c
    order by next_attempt_at limit batch
  )
  update public.email_jobs j
  set status = 'processing', locked_by = left(worker_name, 80), locked_until = now() + interval '5 minutes', attempt_count = j.attempt_count + 1
  from picked p where j.id = p.id returning j.*;
end;
$$;
revoke all on function public.claim_email_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.claim_email_jobs(text, integer) to service_role;

-- Solo el trabajador: revalida y genera el código de la invitación del trabajo reclamado.
-- Devuelve null si no debe enviarse (el trabajo queda cancelado o vuelve a «held»).
create or replace function public.issue_invitation_for_job(target_job_id uuid, worker_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  j public.email_jobs%rowtype;
  live_value boolean;
  raw_token text;
  details jsonb;
begin
  select * into j from public.email_jobs where id = target_job_id for update;
  if not found or j.template_key <> 'resident_invitation' or j.status <> 'processing'
     or j.locked_by is distinct from worker_name or j.locked_until <= now() then
    return null;
  end if;
  select live into live_value from private.invitation_delivery;
  if not coalesce(live_value, false) then
    update public.email_jobs set status = 'held', locked_by = null, locked_until = null where id = j.id;
    return null;
  end if;
  raw_token := private.issue_invitation_token(j.invitation_id);
  if raw_token is null then return null; end if;
  select jsonb_build_object('token', raw_token, 'property_name', p.name, 'building_name', b.name, 'unit_code', u.code,
                            'relationship', i.relationship, 'expires_at', i.expires_at)
  into details
  from public.invitations i
  join public.properties p on p.id = i.property_id
  join public.units u on u.id = i.unit_id and u.property_id = i.property_id
  join public.buildings b on b.id = u.building_id and b.property_id = u.property_id
  where i.id = j.invitation_id;
  return details;
end;
$$;
revoke all on function public.issue_invitation_for_job(uuid, text) from public, anon, authenticated;
grant execute on function public.issue_invitation_for_job(uuid, text) to service_role;

-- Interruptor del envío real. Ejecutar solo desde SQL Editor:
--   select private.set_invitation_delivery(true, false);  -- activa; los retenidos siguen retenidos
--   select private.set_invitation_delivery(true, true);   -- activa y pasa los retenidos a la cola
--   select private.set_invitation_delivery(false, false); -- apaga; lo que estaba en cola vuelve a retenido
create or replace function private.set_invitation_delivery(enable boolean, release_held boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare moved integer := 0;
begin
  update private.invitation_delivery set live = enable, updated_at = now();
  if enable and release_held then
    update public.email_jobs set status = 'queued', next_attempt_at = now()
    where template_key = 'resident_invitation' and status = 'held';
    get diagnostics moved = row_count;
  elsif not enable then
    update public.email_jobs set status = 'held'
    where template_key = 'resident_invitation' and status = 'queued';
    get diagnostics moved = row_count;
  end if;
  return case when enable then 'envio_activo' else 'modo_prueba' end || ': ' || moved || ' trabajos movidos';
end;
$$;
revoke all on function private.set_invitation_delivery(boolean, boolean) from public, anon, authenticated;

commit;

select
  (select live = false from private.invitation_delivery) as modo_prueba_sigue_activo,
  (select daily_limit from private.invitation_delivery) as limite_diario,
  has_function_privilege('service_role', 'public.issue_invitation_for_job(uuid,text)', 'execute') as trabajador_puede_emitir,
  not has_function_privilege('authenticated', 'public.issue_invitation_for_job(uuid,text)', 'execute') as app_no_puede_emitir,
  (select count(*) from public.email_jobs where template_key = 'resident_invitation' and status = 'held') as invitaciones_retenidas;
