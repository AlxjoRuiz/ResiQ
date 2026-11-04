-- Correo de invitación al administrador del conjunto (04/11/2026, pedido de Alejandro).
-- * Al crear el conjunto, al invitar otro administrador o al generar un enlace nuevo, el correo de la
--   invitación queda en la cola (email_jobs) con el mismo enlace que ve el superadmin.
-- * Mientras ResiQ siga en modo de prueba (private.invitation_delivery.live = false) queda «retenido» y no sale;
--   el superadmin sigue compartiendo el enlace. Al activar el envío real sale solo.
-- * Antes de enviarlo, el trabajador revisa que la invitación siga pendiente y vigente y que el enlace sea el
--   último generado (si se generó otro, se envía el nuevo, que reemplaza al anterior en la cola).
begin;

alter table public.email_jobs drop constraint email_jobs_template_key_check;
alter table public.email_jobs add constraint email_jobs_template_key_check check (template_key in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice','attention_call_created','assembly_published','assembly_reminder','assembly_updated','assembly_cancelled','visit_requested','visit_rejected','resident_invitation','legal_collection_notice','legal_notice_reply','admin_invitation'));

-- Superadmin: pone en la cola el correo de una invitación de administrador recién creada o con enlace nuevo.
create or replace function public.queue_admin_invitation_email(invitation_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare inv public.invitations%rowtype; live_value boolean; property_label text;
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  select * into inv from public.invitations
  where token_hash = encode(extensions.digest(coalesce(invitation_token, ''), 'sha256'), 'hex') and status = 'pending' and 'administrator' = any(roles);
  if not found or inv.expires_at <= now() then return false; end if;
  select p.name into property_label from public.properties p where p.id = inv.property_id;
  select live into live_value from private.invitation_delivery;
  insert into public.email_jobs(property_id, invitation_id, recipient_email, template_key, template_data, dedupe_key, status)
  values (inv.property_id, inv.id, inv.email_normalized, 'admin_invitation',
    jsonb_build_object('link_token', invitation_token, 'property_name', property_label, 'assistant', inv.is_admin_assistant, 'expires_at', inv.expires_at),
    'admin_invitation:' || inv.id, case when coalesce(live_value, false) then 'queued' else 'held' end)
  on conflict (invitation_id) where invitation_id is not null do update
    set template_data = excluded.template_data, recipient_email = excluded.recipient_email, status = excluded.status,
        attempt_count = 0, next_attempt_at = now(), last_error_code = null, locked_by = null, locked_until = null;
  return true;
end;
$$;
revoke all on function public.queue_admin_invitation_email(text) from public, anon;
grant execute on function public.queue_admin_invitation_email(text) to authenticated;

-- Solo el trabajador: revalida el correo de una invitación de administrador justo antes de enviarlo.
create or replace function public.authorize_admin_invitation_job(target_job_id uuid, worker_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare j public.email_jobs%rowtype; permitted boolean;
begin
  select * into j from public.email_jobs where id = target_job_id for update;
  if not found or j.template_key <> 'admin_invitation' or j.invitation_id is null or j.status <> 'processing'
     or j.locked_by is distinct from worker_name or j.locked_until <= now() then
    return false;
  end if;
  permitted := coalesce((select live from private.invitation_delivery), false) and exists(
    select 1 from public.invitations i
    where i.id = j.invitation_id and i.status = 'pending' and i.expires_at > now()
      and i.token_hash = encode(extensions.digest(coalesce(j.template_data ->> 'link_token', ''), 'sha256'), 'hex'));
  if not permitted then
    update public.email_jobs set status = 'cancelled', locked_by = null, locked_until = null, last_error_code = 'admin_invitation_not_available' where id = j.id;
  end if;
  return permitted;
end;
$$;
revoke all on function public.authorize_admin_invitation_job(uuid, text) from public, anon, authenticated;
grant execute on function public.authorize_admin_invitation_job(uuid, text) to service_role;

-- Interruptor del envío real (igual que antes): ahora también mueve las invitaciones de administrador.
create or replace function private.set_invitation_delivery(enable boolean, release_held boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare moved integer := 0;
begin
  update private.invitation_delivery set live = enable, updated_at = now();
  if enable and release_held then
    update public.email_jobs set status = 'queued', next_attempt_at = now()
    where template_key in ('resident_invitation', 'admin_invitation') and status = 'held';
    get diagnostics moved = row_count;
  elsif not enable then
    update public.email_jobs set status = 'held'
    where template_key in ('resident_invitation', 'admin_invitation') and status = 'queued';
    get diagnostics moved = row_count;
  end if;
  return case when enable then 'envio_activo' else 'modo_prueba' end || ': ' || moved || ' trabajos movidos';
end;
$$;
revoke all on function private.set_invitation_delivery(boolean, boolean) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;

-- Debe dar true.
select has_function_privilege('authenticated', 'public.queue_admin_invitation_email(text)', 'execute')
  and has_function_privilege('service_role', 'public.authorize_admin_invitation_job(uuid,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.authorize_admin_invitation_job(uuid,text)', 'execute') as invitacion_admin_por_correo;
