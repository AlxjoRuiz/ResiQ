-- Avisos de cartera también al «correo de facturas» del censo (además del residente).
-- * Solo si «¿Autoriza recibir las facturas de administración por correo?» dice Sí y el
--   correo es válido y distinto al de las cuentas que ya reciben el aviso.
-- * Es un correo sin cuenta de ResiQ: sigue el mismo interruptor que las invitaciones
--   (private.invitation_delivery.live). En modo de prueba el trabajo queda «held».
-- * Antes de enviar, authorize_billing_email_job comprueba que la autorización siga en Sí y
--   que el correo de facturas no haya cambiado; si cambió, se cancela y los siguientes avisos
--   van al correo nuevo.
begin;

alter table public.email_jobs add column census_record_id uuid references public.census_records(id) on delete restrict;
do $drop_source_check$
declare constraint_name text;
begin
  select conname into constraint_name from pg_constraint
  where conrelid = 'public.email_jobs'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%num_nonnulls%';
  if constraint_name is null then raise exception 'email_jobs_source_check_not_found'; end if;
  execute format('alter table public.email_jobs drop constraint %I', constraint_name);
end;
$drop_source_check$;
alter table public.email_jobs add constraint email_jobs_one_source_check check (num_nonnulls(notification_id, invitation_id, census_record_id) = 1);

-- Correo de facturas autorizado de un registro del censo, o null.
create or replace function private.census_billing_email(target_record_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  rec public.census_records%rowtype;
  headers_value jsonb;
  consent text;
  billing text;
begin
  select * into rec from public.census_records where id = target_record_id;
  if not found then return null; end if;
  select headers into headers_value from public.census_imports where id = rec.import_id and property_id = rec.property_id;
  consent := lower(translate(trim(coalesce(rec.cells ->> private.census_header_index(headers_value, 'autoriza recibir las facturas de administracion por correo'), '')), 'Íí', 'ii'));
  billing := lower(trim(coalesce(rec.cells ->> private.census_header_index(headers_value, 'a que correo se le hace el envio de las facturas'), '')));
  if consent !~ '^si\M' or billing = '' or char_length(billing) > 254
     or billing !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return null;
  end if;
  return billing;
end;
$$;
revoke all on function private.census_billing_email(uuid) from public, anon, authenticated;

create or replace function private.enqueue_finance_notification(
  target_property_id uuid,target_unit_id uuid,target_entity_type text,target_entity_id uuid,
  notification_type text,notification_subject text,notification_body text,target_dedupe_prefix text,target_payload jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare recipient record; notification_id uuid; recipient_email text; unit_label text;
  sent_emails text[] := '{}'; billing_record_id uuid; billing_email text; live_value boolean;
begin
  select b.name||' · '||u.code into unit_label from public.units u join public.buildings b on b.id=u.building_id and b.property_id=u.property_id where u.id=target_unit_id and u.property_id=target_property_id;
  for recipient in
    select distinct pm.id,pm.user_id from public.unit_memberships um
    join public.property_members pm on pm.id=um.member_id and pm.property_id=um.property_id
    where um.property_id=target_property_id and um.unit_id=target_unit_id and um.finance_access
      and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now()) and pm.status='active' and 'member'=any(pm.roles)
  loop
    notification_id:=null;
    insert into public.notifications(property_id,recipient_member_id,type,subject,body,target_type,target_id,payload,dedupe_key)
    values(target_property_id,recipient.id,notification_type,notification_subject,notification_body,target_entity_type,target_entity_id,target_payload||jsonb_build_object('unit_id',target_unit_id),target_dedupe_prefix||':'||recipient.id)
    on conflict(property_id,recipient_member_id,dedupe_key) do nothing returning id into notification_id;
    if notification_id is not null then
      select lower(email) into recipient_email from auth.users where id=recipient.user_id;
      if recipient_email is not null then
        sent_emails := array_append(sent_emails, recipient_email);
        insert into public.email_jobs(property_id,notification_id,recipient_email,template_key,template_data,dedupe_key)
        values(target_property_id,notification_id,recipient_email,notification_type,target_payload||jsonb_build_object('property_id',target_property_id,'unit_id',target_unit_id,'unit_label',unit_label),target_dedupe_prefix||':'||recipient.id);
      end if;
    end if;
  end loop;

  -- Correo de facturas del censo del apartamento, si está autorizado.
  select id into billing_record_id from public.census_records where property_id=target_property_id and unit_id=target_unit_id;
  billing_email := private.census_billing_email(billing_record_id);
  if billing_email is not null and not billing_email = any(sent_emails) then
    select live into live_value from private.invitation_delivery;
    insert into public.email_jobs(property_id,census_record_id,recipient_email,template_key,template_data,dedupe_key,status)
    values(target_property_id,billing_record_id,billing_email,notification_type,
           target_payload||jsonb_build_object('property_id',target_property_id,'unit_id',target_unit_id,'unit_label',unit_label),
           target_dedupe_prefix||':billing',case when coalesce(live_value,false) then 'queued' else 'held' end)
    on conflict(property_id,dedupe_key) do nothing;
  end if;
end;
$$;

-- Solo el trabajador: revalida un aviso al correo de facturas justo antes de enviarlo.
create or replace function public.authorize_billing_email_job(target_job_id uuid, worker_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare j public.email_jobs%rowtype; permitted boolean;
begin
  select * into j from public.email_jobs where id = target_job_id for update;
  if not found or j.census_record_id is null or j.status <> 'processing'
     or j.locked_by is distinct from worker_name or j.locked_until <= now() then
    return false;
  end if;
  permitted := coalesce((select live from private.invitation_delivery), false)
    and private.census_billing_email(j.census_record_id) = lower(j.recipient_email)
    and exists (select 1 from public.census_records r join public.units u on u.id = r.unit_id and u.property_id = r.property_id
                where r.id = j.census_record_id and r.property_id = j.property_id and u.status = 'active');
  if not permitted then
    update public.email_jobs set status = 'cancelled', locked_by = null, locked_until = null, last_error_code = 'billing_email_not_authorized'
    where id = j.id;
  end if;
  return permitted;
end;
$$;
revoke all on function public.authorize_billing_email_job(uuid, text) from public, anon, authenticated;
grant execute on function public.authorize_billing_email_job(uuid, text) to service_role;

commit;

select
  exists (select 1 from information_schema.columns where table_name = 'email_jobs' and column_name = 'census_record_id') as columna_facturas,
  has_function_privilege('service_role', 'public.authorize_billing_email_job(uuid,text)', 'execute') as trabajador_valida,
  not has_function_privilege('authenticated', 'public.authorize_billing_email_job(uuid,text)', 'execute') as app_no_valida,
  (select live = false from private.invitation_delivery) as modo_prueba_sigue_activo;
