-- Informe jurídico por mes, fase 1 (12/11/2026, pedido de Alejandro). Solo lectura, salvo las conclusiones.
-- * public.legal_report_month(conjunto, mes): el informe de ese mes calculado con las fechas de cada movimiento
--   «al cierre del mes» (o a hoy si es el mes en curso: corte parcial). Fase 1: se calcula, todavía no se guarda
--   un cierre oficial (eso es la fase 2).
--   - Obligación vigente a la fecha: emitida hasta esa fecha y no anulada todavía en esa fecha.
--   - Pago vigente a la fecha: pagado hasta esa fecha y no anulado todavía en esa fecha.
--   - Saldo de cada obligación: su valor menos lo que le aplicaron los pagos vigentes a la fecha.
--   - En mora: obligación con saldo que ya venció a la fecha. Sin intereses de mora (no aplican por ahora).
-- * public.legal_report_notes: las conclusiones de la abogada por conjunto y mes (borrador editable).
-- Todo pasa por private.legal_can_view: cada abogada solo ve los conjuntos asignados de su lado.
begin;

create table public.legal_report_notes (
  property_id uuid not null references public.properties(id) on delete restrict,
  month date not null check (extract(day from month) = 1),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (property_id, month)
);
alter table public.legal_report_notes enable row level security;
revoke all on public.legal_report_notes from public, anon, authenticated;

-- Estado de la cartera de un conjunto a una fecha (as_of), con el recaudo y lo esperado del mes [month_start, month_end].
create or replace function private.legal_report_state(target_property_id uuid, as_of date, month_start date, month_end date)
returns jsonb language sql stable security definer set search_path = '' as $$
  with prop as (select p.timezone as zone from public.properties p where p.id = target_property_id),
  recv as (
    select ar.id, ar.unit_id, ar.amount, ar.due_on, ar.issued_on from public.accounts_receivable ar
    where ar.property_id = target_property_id and ar.issued_on <= as_of
      and (ar.status = 'active' or (ar.voided_at at time zone (select zone from prop))::date > as_of)
  ), pays as (
    select p.id, p.unit_id, p.amount, p.paid_on from public.payments p
    where p.property_id = target_property_id and p.paid_on <= as_of
      and (p.status = 'posted' or (p.voided_at at time zone (select zone from prop))::date > as_of)
  ), applied as (
    select pa.receivable_id, sum(pa.amount) as amount from public.payment_allocations pa join pays on pays.id = pa.payment_id
    where pa.property_id = target_property_id group by pa.receivable_id
  ), owed as (
    select r.unit_id, r.due_on, greatest(r.amount - coalesce(a.amount, 0), 0) as outstanding
    from recv r left join applied a on a.receivable_id = r.id
  ), unit_owed as (
    select o.unit_id, sum(o.outstanding) as total, coalesce(sum(o.outstanding) filter (where o.due_on < as_of), 0) as overdue,
      min(o.due_on) filter (where o.outstanding > 0 and o.due_on < as_of) as oldest
    from owed o group by o.unit_id
  ), notices as (
    select n.unit_id, min(n.created_at) as first_at, max(n.created_at) as last_at, count(*) as notice_count
    from public.legal_collection_notices n
    where n.property_id = target_property_id and (n.created_at at time zone (select zone from prop))::date <= as_of
    group by n.unit_id
  ), agreements as (
    select distinct g.unit_id from public.payment_agreements g
    where g.property_id = target_property_id and (g.created_at at time zone (select zone from prop))::date <= as_of
      and (g.cancelled_at is null or (g.cancelled_at at time zone (select zone from prop))::date > as_of)
      and (g.completed_at is null or (g.completed_at at time zone (select zone from prop))::date > as_of)
  ), last_paid as (
    select p.unit_id, max(p.paid_on) as paid_on from pays p group by p.unit_id
  ), owners as (
    select distinct on (c.unit_id) c.unit_id, c.full_name from public.census_records c
    where c.property_id = target_property_id and c.full_name is not null order by c.unit_id, c.invitation_primary desc, c.source_row
  ), unit_rows as (
    select u.id as unit_id, b.name as building, u.code, o.full_name as owner_name,
      coalesce(w.overdue, 0) as overdue, coalesce(w.total, 0) as total, w.oldest, coalesce(as_of - w.oldest, 0) as days,
      lp.paid_on as last_payment_on, (n.first_at at time zone (select zone from prop))::date as first_notice_on,
      (n.last_at at time zone (select zone from prop))::date as last_notice_on, coalesce(n.notice_count, 0) as notice_count,
      ag.unit_id is not null as agreement_active
    from public.units u
    join public.buildings b on b.property_id = u.property_id and b.id = u.building_id
    left join unit_owed w on w.unit_id = u.id left join notices n on n.unit_id = u.id left join agreements ag on ag.unit_id = u.id
    left join last_paid lp on lp.unit_id = u.id left join owners o on o.unit_id = u.id
    where u.property_id = target_property_id and u.status = 'active'
  )
  select jsonb_build_object(
    'as_of', as_of,
    'units_total', (select count(*) from unit_rows),
    'billed_total', (select coalesce(sum(r.amount), 0) from recv r),
    'collected_month', (select coalesce(sum(p.amount), 0) from pays p where p.paid_on >= month_start),
    'payments_month', (select count(*) from pays p where p.paid_on >= month_start),
    'expected_month', (select coalesce(sum(r.amount), 0) from recv r where r.due_on between month_start and month_end),
    'buildings', coalesce((select jsonb_agg(jsonb_build_object('name', x.building, 'units', x.units) order by x.building)
      from (select r.building, count(*) as units from unit_rows r group by r.building) x), '[]'::jsonb),
    -- Apartamentos en mora y los que tuvieron requerimiento (para los casos finalizados).
    'units', coalesce((select jsonb_agg(jsonb_build_object('unit_id', r.unit_id, 'building', r.building, 'code', r.code, 'owner_name', r.owner_name,
        'overdue', r.overdue, 'total', r.total, 'oldest_due_on', r.oldest, 'days', r.days, 'last_payment_on', r.last_payment_on,
        'first_notice_on', r.first_notice_on, 'last_notice_on', r.last_notice_on, 'notice_count', r.notice_count, 'agreement_active', r.agreement_active)
      order by r.days desc, r.overdue desc) from unit_rows r where r.overdue > 0 or r.notice_count > 0), '[]'::jsonb),
    'agreements_month', (select count(*) from public.payment_agreements g where g.property_id = target_property_id
      and (g.created_at at time zone (select zone from prop))::date between month_start and as_of),
    -- Requerimientos de pago enviados en el mes, con el estado de su correo.
    'notices_month', coalesce((select jsonb_agg(jsonb_build_object('sent_at', n.created_at, 'unit', b.name || ' · ' || u.code,
        'recipient', coalesce(n.recipient_name, n.recipient_email), 'total', n.total,
        'delivery', coalesce((select j.status from public.email_jobs j where j.legal_notice_id = n.id order by j.created_at desc limit 1), 'held'))
      order by n.created_at)
      from public.legal_collection_notices n
      join public.units u on u.property_id = n.property_id and u.id = n.unit_id
      join public.buildings b on b.property_id = u.property_id and b.id = u.building_id
      where n.property_id = target_property_id and (n.created_at at time zone (select zone from prop))::date between month_start and as_of), '[]'::jsonb)
  );
$$;
revoke all on function private.legal_report_state(uuid, date, date, date) from public, anon, authenticated;

-- Abogada: el informe de un mes (el día del mes que se envíe no importa). El mes en curso es un corte parcial a hoy.
create or replace function public.legal_report_month(target_property_id uuid, target_month date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare zone text; today date; month_start date := date_trunc('month', target_month)::date; month_end date; as_of date; previous_start date;
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  select p.timezone into zone from public.properties p where p.id = target_property_id;
  today := (now() at time zone zone)::date;
  if target_month is null or month_start > today then raise exception 'invalid_month'; end if;
  month_end := (month_start + interval '1 month' - interval '1 day')::date;
  as_of := least(month_end, today);
  previous_start := (month_start - interval '1 month')::date;
  return jsonb_build_object(
    'property', (select jsonb_build_object('name', p.name, 'city', p.city, 'address', p.address) from public.properties p where p.id = target_property_id),
    'month', month_start, 'month_end', month_end, 'as_of', as_of, 'today', today, 'partial', as_of < month_end,
    'generated_at', now(), 'timezone', zone,
    'started_on', (select (a.created_at at time zone zone)::date from public.legal_assignments a where a.property_id = target_property_id),
    'first_month', (select date_trunc('month', min(ar.issued_on))::date from public.accounts_receivable ar where ar.property_id = target_property_id),
    'prepared_by', (select p.display_name from public.profiles p where p.id = auth.uid()),
    'note', (select jsonb_build_object('body', n.body, 'updated_at', n.updated_at) from public.legal_report_notes n where n.property_id = target_property_id and n.month = month_start),
    'current', private.legal_report_state(target_property_id, as_of, month_start, month_end),
    'previous', private.legal_report_state(target_property_id, (month_start - 1), previous_start, (month_start - 1))
  );
end;
$$;
revoke all on function public.legal_report_month(uuid, date) from public, anon;
grant execute on function public.legal_report_month(uuid, date) to authenticated;

-- Abogada: guarda (o borra, si queda vacío) el borrador de conclusiones del mes.
create or replace function public.legal_save_report_note(target_property_id uuid, target_month date, note_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare month_start date := date_trunc('month', target_month)::date; clean text := trim(coalesce(note_body, ''));
begin
  if auth.uid() is null or private.legal_staff_id() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  if target_month is null or char_length(clean) > 5000 then raise exception 'invalid_note'; end if;
  if clean = '' then
    delete from public.legal_report_notes where property_id = target_property_id and month = month_start;
  else
    insert into public.legal_report_notes(property_id, month, body, updated_by, updated_at) values (target_property_id, month_start, clean, auth.uid(), now())
    on conflict (property_id, month) do update set body = excluded.body, updated_by = excluded.updated_by, updated_at = now();
  end if;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (target_property_id, auth.uid(), 'property', 'legal.report_note_saved', 'property', target_property_id, jsonb_build_object('month', month_start, 'length', char_length(clean)));
end;
$$;
revoke all on function public.legal_save_report_note(uuid, date, text) from public, anon;
grant execute on function public.legal_save_report_note(uuid, date, text) to authenticated;

commit;

-- Debe dar true y true.
select exists(select 1 from pg_proc where proname = 'legal_report_month') as informe_por_mes,
  not has_table_privilege('authenticated', 'public.legal_report_notes', 'select') as conclusiones_protegidas;
