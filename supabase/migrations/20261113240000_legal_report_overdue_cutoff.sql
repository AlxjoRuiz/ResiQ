-- Cartera vencida en el informe jurídico (13/11/2026, pedido de Alejandro). En Bonavento las cuotas de octubre vencen el
-- 31/10 y el informe de octubre hace el corte el 31/10; como la regla era «vencida si vence ANTES del corte», ninguna
-- salía vencida en octubre (solo lo pagado). Ahora, si el día del corte ya terminó (mes cerrado o pasado), lo que vencía
-- ese día y no se pagó cuenta como vencido, y los días de mora se cuentan hasta el día siguiente al corte. En el mes en
-- curso (corte a hoy) lo que vence hoy sigue sin vencer hasta que termine el día.
-- Los cierres ya guardados se rehacen con esta regla: queda una versión nueva automática de cada mes cerrado.
-- Solo cambia private.legal_report_state (igual que en 20261112100000 salvo el corte de vencimiento).
begin;

create or replace function private.legal_report_state(target_property_id uuid, as_of date, month_start date, month_end date)
returns jsonb language sql stable security definer set search_path = '' as $$
  with prop as (select p.timezone as zone from public.properties p where p.id = target_property_id),
  -- Si el día del corte ya terminó, lo que vencía ese día y no se pagó ya está vencido (se mira al día siguiente).
  cut as (select case when as_of < (now() at time zone (select zone from prop))::date then as_of + 1 else as_of end as d),
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
    select o.unit_id, sum(o.outstanding) as total, coalesce(sum(o.outstanding) filter (where o.due_on < (select d from cut)), 0) as overdue,
      min(o.due_on) filter (where o.outstanding > 0 and o.due_on < (select d from cut)) as oldest
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
      coalesce(w.overdue, 0) as overdue, coalesce(w.total, 0) as total, w.oldest, coalesce((select d from cut) - w.oldest, 0) as days,
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

-- Rehacer los cierres guardados (última versión de cada mes) con la regla nueva.
insert into public.legal_report_closures(property_id, month, version, snapshot, automatic, reason)
select c.property_id, c.month, c.version + 1, private.legal_report_build(c.property_id, c.month, 'Actualización automática de ResiQ'), true,
  'Recalculado: lo que vence el último día del mes y no se pagó cuenta como vencido'
from (select distinct on (property_id, month) property_id, month, version from public.legal_report_closures order by property_id, month, version desc) c;

commit;

-- Debe dar true.
select pg_get_functiondef('private.legal_report_state(uuid,date,date,date)'::regprocedure) like '%select d from cut%' as vencidas_al_corte;
