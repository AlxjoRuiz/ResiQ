-- Informe de gestión de cartera por conjunto para la abogada (11/11/2026, pedido de Alejandro).
-- Solo lectura. Un «caso» es un apartamento al que la abogada le envió al menos un requerimiento de pago.
-- * Inicio de la gestión: fecha en que ResiQ le asignó el conjunto (legal_assignments.created_at).
-- * Cartera entregada de cada caso: el total de su primer requerimiento.
-- * Recaudo de cada caso: pagos vigentes del apartamento desde su primer requerimiento.
-- * Estado: «finalizado» si hoy no debe nada; «convenio» si tiene acuerdo de pago vigente; si no, «prejuridico».
-- * Además: apartamentos en mora sin requerimiento, recaudo por mes (últimos 6 meses) y cifras del conjunto.
begin;

create or replace function public.legal_property_report(target_property_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare today date; zone text; result jsonb;
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  select p.timezone, (now() at time zone p.timezone)::date into zone, today from public.properties p where p.id = target_property_id;

  with notices as (
    select n.unit_id, min(n.created_at) as first_at, count(*) as notice_count,
      (array_agg(n.total order by n.created_at))[1] as first_total
    from public.legal_collection_notices n where n.property_id = target_property_id group by n.unit_id
  ), owed as (
    select ar.unit_id, sum(private.receivable_outstanding(ar.id)) as outstanding,
      sum(private.receivable_outstanding(ar.id)) filter (where ar.due_on < today) as overdue
    from public.accounts_receivable ar where ar.property_id = target_property_id and ar.status = 'active' group by ar.unit_id
  ), owners as (
    select distinct on (c.unit_id) c.unit_id, c.full_name from public.census_records c
    where c.property_id = target_property_id and c.full_name is not null order by c.unit_id, c.invitation_primary desc, c.source_row
  ), agreements as (
    select distinct g.unit_id from public.payment_agreements g where g.property_id = target_property_id and g.status = 'active'
  ), cases as (
    select n.unit_id, b.name || ' · ' || u.code as unit_label, o.full_name as owner_name, n.first_at, n.notice_count, n.first_total,
      coalesce(w.outstanding, 0) as outstanding,
      coalesce((select sum(p.amount) from public.payments p where p.property_id = target_property_id and p.unit_id = n.unit_id
        and p.status = 'posted' and p.paid_on >= (n.first_at at time zone zone)::date), 0) as collected,
      case when coalesce(w.outstanding, 0) <= 0 then 'finalized' when ag.unit_id is not null then 'agreement' else 'pre_legal' end as state
    from notices n
    join public.units u on u.property_id = target_property_id and u.id = n.unit_id
    join public.buildings b on b.property_id = u.property_id and b.id = u.building_id
    left join owed w on w.unit_id = n.unit_id left join owners o on o.unit_id = n.unit_id left join agreements ag on ag.unit_id = n.unit_id
  ), months as (
    select generate_series(date_trunc('month', today) - interval '5 months', date_trunc('month', today), interval '1 month')::date as month
  ), monthly as (
    select m.month, coalesce(sum(p.amount), 0) as amount
    from months m left join public.payments p on p.property_id = target_property_id and p.status = 'posted'
      and date_trunc('month', p.paid_on)::date = m.month
      and exists(select 1 from cases c where c.unit_id = p.unit_id and p.paid_on >= (c.first_at at time zone zone)::date)
    group by m.month
  )
  select jsonb_build_object(
    'property', (select jsonb_build_object('name', p.name, 'city', p.city, 'address', p.address) from public.properties p where p.id = target_property_id),
    'today', today,
    'started_on', (select (a.created_at at time zone zone)::date from public.legal_assignments a where a.property_id = target_property_id),
    'first_notice_on', (select (min(c.first_at) at time zone zone)::date from cases c),
    'cases', coalesce((select jsonb_agg(jsonb_build_object('unit_id', c.unit_id, 'unit_label', c.unit_label, 'owner_name', c.owner_name,
        'first_notice_on', (c.first_at at time zone zone)::date, 'notice_count', c.notice_count, 'first_total', c.first_total,
        'outstanding', c.outstanding, 'collected', c.collected, 'state', c.state)
      order by case c.state when 'finalized' then 0 when 'agreement' then 1 else 2 end, c.unit_label) from cases c), '[]'::jsonb),
    'monthly', (select jsonb_agg(jsonb_build_object('month', m.month, 'amount', m.amount) order by m.month) from monthly m),
    'units_total', (select count(*) from public.units u where u.property_id = target_property_id and u.status = 'active'),
    'units_in_arrears', (select count(*) from owed w where coalesce(w.overdue, 0) > 0),
    'arrears_total', (select coalesce(sum(w.overdue), 0) from owed w),
    'unmanaged', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(w.overdue), 0)) from owed w
      where coalesce(w.overdue, 0) > 0 and not exists(select 1 from notices n where n.unit_id = w.unit_id))
  ) into result;
  return result;
end;
$$;

revoke all on function public.legal_property_report(uuid) from public, anon;
grant execute on function public.legal_property_report(uuid) to authenticated;

commit;

-- Debe dar true.
select exists(select 1 from pg_proc where proname = 'legal_property_report') as informe_juridico;
