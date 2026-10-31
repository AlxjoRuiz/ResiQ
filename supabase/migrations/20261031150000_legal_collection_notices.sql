-- Módulo jurídico, entrega 2 (31/10/2026, pedido de Alejandro): «Requerimiento de pago». Desde el detalle
-- del apartamento la abogada elige las deudas, el destinatario y escribe el mensaje; el correo lleva el
-- detalle de las deudas elegidas y su firma. Cada envío queda guardado y en auditoría.
-- * Destinatarios permitidos: correos del censo del apartamento (contactos y correo de facturas
--   autorizado) y cuentas con acceso a la cartera del apartamento. No se puede escribir otro correo.
-- * Va por la misma cola de correos (email_jobs). Mientras ResiQ siga en modo de prueba
--   (private.invitation_delivery.live = false) el correo queda «retenido» y no sale.
-- * El trabajador vuelve a validar antes de enviar: abogada activa y conjunto todavía asignado.
begin;

create table public.legal_collection_notices (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid not null,
  staff_id uuid not null references public.legal_staff(id) on delete restrict,
  sent_by uuid not null references public.profiles(id) on delete restrict,
  recipient_email text not null check (char_length(recipient_email) between 3 and 254),
  recipient_name text,
  subject text not null check (char_length(subject) between 3 and 150),
  message text not null check (char_length(message) between 10 and 5000),
  items jsonb not null,
  total numeric(14,2) not null check (total > 0),
  created_at timestamptz not null default now(),
  foreign key (property_id, unit_id) references public.units(property_id, id) on delete restrict
);
create index legal_collection_notices_unit_idx on public.legal_collection_notices(property_id, unit_id, created_at desc);
alter table public.legal_collection_notices enable row level security;
revoke all on public.legal_collection_notices from public, anon, authenticated;

-- La cola de correos acepta el requerimiento como origen y su plantilla.
alter table public.email_jobs add column legal_notice_id uuid references public.legal_collection_notices(id) on delete restrict;
alter table public.email_jobs drop constraint email_jobs_one_source_check;
alter table public.email_jobs add constraint email_jobs_one_source_check check (num_nonnulls(notification_id, invitation_id, census_record_id, legal_notice_id) = 1);
alter table public.email_jobs drop constraint email_jobs_template_key_check;
alter table public.email_jobs add constraint email_jobs_template_key_check check (template_key in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice','attention_call_created','assembly_published','assembly_reminder','assembly_updated','assembly_cancelled','visit_requested','visit_rejected','resident_invitation','legal_collection_notice'));

-- Correos a los que la abogada puede enviar el requerimiento de un apartamento.
create or replace function private.legal_unit_recipients(target_property_id uuid, target_unit_id uuid)
returns table(email text, name text, kind text) language sql stable security definer set search_path = '' as $$
  with options as (
    select c.email_normalized as email, c.full_name as name, 'Censo' || coalesce(' · ' || c.user_type, '') as kind, 1 as rank
    from public.census_records c
    where c.property_id = target_property_id and c.unit_id = target_unit_id and c.email_normalized is not null
    union all
    select private.census_billing_email(c.id), c.full_name, 'Correo de facturas', 2
    from public.census_records c where c.property_id = target_property_id and c.unit_id = target_unit_id
    union all
    select lower(u.email::text), p.display_name, 'Cuenta ResiQ', 3
    from public.unit_memberships um
    join public.property_members pm on pm.id = um.member_id and pm.property_id = um.property_id
    join auth.users u on u.id = pm.user_id left join public.profiles p on p.id = pm.user_id
    where um.property_id = target_property_id and um.unit_id = target_unit_id and um.finance_access and pm.status = 'active'
      and um.valid_from <= now() and (um.valid_to is null or um.valid_to > now())
  )
  select distinct on (o.email) o.email, o.name, o.kind from options o
  where o.email is not null and o.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  order by o.email, o.rank;
$$;
revoke all on function private.legal_unit_recipients(uuid, uuid) from public, anon, authenticated;

-- Abogada: destinatarios posibles del requerimiento.
create or replace function public.legal_unit_recipients(target_property_id uuid, target_unit_id uuid)
returns table(email text, name text, kind text) language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  return query select r.email, r.name, r.kind from private.legal_unit_recipients(target_property_id, target_unit_id) r order by r.kind, r.email;
end;
$$;

-- Abogada: envía el requerimiento de pago. Las deudas deben ser del apartamento, estar activas y tener
-- saldo; el detalle (concepto, vencimiento y saldo) se toma de la base de datos, no del navegador.
create or replace function public.legal_send_collection_notice(target_property_id uuid, target_unit_id uuid, target_receivable_ids uuid[],
  target_recipient_email text, target_subject text, target_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.legal_staff_id(); recipient text := lower(trim(coalesce(target_recipient_email, '')));
  clean_subject text := trim(coalesce(target_subject, '')); clean_message text := trim(coalesce(target_message, ''));
  recipient_label text; item_list jsonb; total_value numeric; notice_id uuid; live_value boolean;
  signer text; signer_email text; property_label text; unit_label text;
begin
  if auth.uid() is null or me is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.units where property_id = target_property_id and id = target_unit_id) then raise exception 'unit_not_found'; end if;
  if char_length(clean_subject) not between 3 and 150 or char_length(clean_message) not between 10 and 5000 then raise exception 'invalid_message'; end if;
  if coalesce(cardinality(target_receivable_ids), 0) = 0 or cardinality(target_receivable_ids) > 200 then raise exception 'no_debts_selected'; end if;
  select r.name into recipient_label from private.legal_unit_recipients(target_property_id, target_unit_id) r where r.email = recipient;
  if not found then raise exception 'recipient_not_allowed'; end if;

  select jsonb_agg(jsonb_build_object('receivable_id', d.id, 'concept', d.concept, 'due_on', d.due_on, 'outstanding', d.owed) order by d.due_on, d.concept), sum(d.owed)
  into item_list, total_value
  from (select ar.id, ar.concept, ar.due_on, private.receivable_outstanding(ar.id) as owed from public.accounts_receivable ar
        where ar.property_id = target_property_id and ar.unit_id = target_unit_id and ar.status = 'active' and ar.id = any(target_receivable_ids)) d
  where d.owed > 0;
  if item_list is null or jsonb_array_length(item_list) <> (select count(distinct x) from unnest(target_receivable_ids) x) then raise exception 'invalid_debts'; end if;

  select coalesce(p.display_name, 'Abogada de cobros'), lower(u.email::text) into signer, signer_email from public.profiles p join auth.users u on u.id = p.id where p.id = auth.uid();
  select p.name into property_label from public.properties p where p.id = target_property_id;
  select b.name || ' · ' || u.code into unit_label from public.units u join public.buildings b on b.property_id = u.property_id and b.id = u.building_id where u.id = target_unit_id;

  insert into public.legal_collection_notices(property_id, unit_id, staff_id, sent_by, recipient_email, recipient_name, subject, message, items, total)
  values (target_property_id, target_unit_id, me, auth.uid(), recipient, recipient_label, clean_subject, clean_message, item_list, total_value)
  returning id into notice_id;

  select live into live_value from private.invitation_delivery;
  insert into public.email_jobs(property_id, legal_notice_id, recipient_email, template_key, template_data, dedupe_key, status)
  values (target_property_id, notice_id, recipient, 'legal_collection_notice',
    jsonb_build_object('subject', clean_subject, 'message', clean_message, 'items', item_list, 'total', total_value, 'currency', 'COP',
      'signer_name', signer, 'signer_email', signer_email, 'property_name', property_label, 'unit_label', unit_label, 'recipient_name', recipient_label),
    'legal_notice:' || notice_id, case when coalesce(live_value, false) then 'queued' else 'held' end);

  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (target_property_id, auth.uid(), 'property', 'legal.collection_notice_sent', 'unit', target_unit_id,
    jsonb_build_object('notice_id', notice_id, 'debts', jsonb_array_length(item_list), 'total', total_value));
  return notice_id;
end;
$$;

-- Abogada: requerimientos enviados de un apartamento, con el estado del correo.
create or replace function public.legal_unit_notices(target_property_id uuid, target_unit_id uuid)
returns table(notice_id uuid, created_at timestamptz, recipient_email text, recipient_name text, subject text, total numeric, debt_count integer, delivery_status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  return query
  select n.id, n.created_at, n.recipient_email, n.recipient_name, n.subject, n.total, jsonb_array_length(n.items),
    coalesce((select j.status from public.email_jobs j where j.legal_notice_id = n.id order by j.created_at desc limit 1), 'held')
  from public.legal_collection_notices n
  where n.property_id = target_property_id and n.unit_id = target_unit_id
  order by n.created_at desc;
end;
$$;

-- Solo el trabajador: revalida un requerimiento justo antes de enviarlo.
create or replace function public.authorize_legal_notice_job(target_job_id uuid, worker_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare j public.email_jobs%rowtype; permitted boolean;
begin
  select * into j from public.email_jobs where id = target_job_id for update;
  if not found or j.legal_notice_id is null or j.status <> 'processing'
     or j.locked_by is distinct from worker_name or j.locked_until <= now() then
    return false;
  end if;
  permitted := coalesce((select live from private.invitation_delivery), false) and exists(
    select 1 from public.legal_collection_notices n
    join public.legal_staff s on s.id = n.staff_id and s.status = 'active'
    join public.legal_assignments a on a.property_id = n.property_id
    join public.properties p on p.id = n.property_id and p.status = 'active'
    where n.id = j.legal_notice_id and n.property_id = j.property_id);
  if not permitted then
    update public.email_jobs set status = 'cancelled', locked_by = null, locked_until = null, last_error_code = 'legal_notice_not_authorized' where id = j.id;
  end if;
  return permitted;
end;
$$;

-- Detalle del apartamento: igual que antes, con el id de cada cobro para poder elegirlo en el requerimiento.
create or replace function public.legal_unit_detail(target_property_id uuid, target_unit_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; today date;
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.units where property_id = target_property_id and id = target_unit_id) then raise exception 'unit_not_found'; end if;
  select (now() at time zone p.timezone)::date into today from public.properties p where p.id = target_property_id;
  select jsonb_build_object(
    'unit', (select jsonb_build_object('building', b.name, 'code', u.code, 'floor', u.floor) from public.units u join public.buildings b on b.property_id = u.property_id and b.id = u.building_id where u.id = target_unit_id),
    'property', (select p.name from public.properties p where p.id = target_property_id),
    'overdue_days', private.property_overdue_days(target_property_id),
    'today', today,
    'signer', (select p.display_name from public.profiles p where p.id = auth.uid()),
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('name', c.full_name, 'type', c.user_type, 'email', c.email_normalized, 'phone', c.phone, 'primary', c.invitation_primary) order by c.invitation_primary desc, c.source_row)
      from public.census_records c where c.property_id = target_property_id and c.unit_id = target_unit_id), '[]'::jsonb),
    'receivables', coalesce((select jsonb_agg(jsonb_build_object('id', ar.id, 'concept', ar.concept, 'amount', ar.amount, 'outstanding', private.receivable_outstanding(ar.id), 'issued_on', ar.issued_on, 'due_on', ar.due_on, 'status', ar.status, 'source', ar.source) order by ar.due_on desc, ar.created_at desc)
      from public.accounts_receivable ar where ar.property_id = target_property_id and ar.unit_id = target_unit_id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('amount', p.amount, 'paid_on', p.paid_on, 'reference', p.reference, 'status', p.status) order by p.paid_on desc, p.created_at desc)
      from public.payments p where p.property_id = target_property_id and p.unit_id = target_unit_id), '[]'::jsonb),
    'agreements', coalesce((select jsonb_agg(jsonb_build_object('total', g.total_amount, 'status', g.status, 'notes', g.notes, 'created_at', g.created_at,
        'installments', coalesce((select jsonb_agg(jsonb_build_object('amount', i.amount, 'due_on', i.due_on) order by i.due_on) from public.payment_agreement_installments i where i.property_id = g.property_id and i.agreement_id = g.id), '[]'::jsonb)) order by g.created_at desc)
      from public.payment_agreements g where g.property_id = target_property_id and g.unit_id = target_unit_id), '[]'::jsonb)
  ) into result;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (target_property_id, auth.uid(), 'property', 'legal.unit_viewed', 'unit', target_unit_id, '{}'::jsonb);
  return result;
end;
$$;

revoke all on function public.legal_unit_recipients(uuid, uuid), public.legal_send_collection_notice(uuid, uuid, uuid[], text, text, text),
  public.legal_unit_notices(uuid, uuid), public.authorize_legal_notice_job(uuid, text) from public, anon, authenticated;
grant execute on function public.legal_unit_recipients(uuid, uuid), public.legal_send_collection_notice(uuid, uuid, uuid[], text, text, text),
  public.legal_unit_notices(uuid, uuid) to authenticated;
grant execute on function public.authorize_legal_notice_job(uuid, text) to service_role;
notify pgrst, 'reload schema';

commit;

-- Debe dar 4 veces true.
select
  exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'legal_collection_notices') as requerimientos_creados,
  not has_table_privilege('authenticated', 'public.legal_collection_notices', 'select') as requerimientos_protegidos,
  has_function_privilege('service_role', 'public.authorize_legal_notice_job(uuid,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.authorize_legal_notice_job(uuid,text)', 'execute') as trabajador_valida,
  (select live = false from private.invitation_delivery) as modo_prueba_sigue_activo;
