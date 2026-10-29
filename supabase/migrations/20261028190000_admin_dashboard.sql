-- Inicio del admin (28/10/2026): todo en una sola consulta. «Por atender» (comprobantes por registrar,
-- reservas por aprobar, PQRS sin cerrar, visitas por aprobar, convocatorias por aprobar), cifras de
-- cartera del mes y datos para las gráficas (recaudo de 6 meses y estado de las cuentas). Solo
-- cantidades y sumas; meses en la zona horaria del conjunto.
begin;

create or replace function public.get_admin_dashboard(target_property_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare zone text; today date; month_start date; result jsonb;
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  select timezone into zone from public.properties where id = target_property_id;
  today := (now() at time zone coalesce(zone, 'America/Bogota'))::date;
  month_start := date_trunc('month', today)::date;

  with accounts as (
    select ar.unit_id,
      sum(private.receivable_outstanding(ar.id)) as outstanding,
      sum(case when ar.due_on < today then private.receivable_outstanding(ar.id) else 0 end) as overdue
    from public.accounts_receivable ar where ar.property_id = target_property_id and ar.status = 'active'
    group by ar.unit_id
  ), pending_evidence as (
    select distinct e.unit_id from public.finance_payment_evidence e
    where e.property_id = target_property_id and private.evidence_is_pending(e.id)
  ), months as (
    select generate_series(month_start - interval '5 months', month_start, interval '1 month')::date as month
  )
  select jsonb_build_object(
    'pending_evidence', jsonb_build_object(
      'count', (select count(*) from public.finance_payment_evidence e where e.property_id = target_property_id and private.evidence_is_pending(e.id)),
      'units', coalesce((select jsonb_agg(jsonb_build_object('unit_id', u.id, 'label', b.name || ' · ' || u.code) order by b.name, u.code)
        from pending_evidence p join public.units u on u.id = p.unit_id join public.buildings b on b.id = u.building_id), '[]'::jsonb)),
    'pending_reservations', (select count(*) from public.reservations r where r.property_id = target_property_id and r.status = 'pending'),
    'urgent_reservations', (select count(*) from public.reservations r where r.property_id = target_property_id and r.status = 'pending' and r.hold_expires_at <= now() + interval '2 hours'),
    'open_pqrs', (select count(*) from public.pqrs q where q.property_id = target_property_id and q.status in ('pending','in_review','in_progress')),
    'visit_requests', (select count(*) from public.visitors v where v.property_id = target_property_id and v.status = 'pending'),
    'convocations_to_approve', (select count(*) from public.assemblies a where a.property_id = target_property_id and a.status = 'scheduled'
      and a.published_at is not null and a.requires_attendance_quorum and a.attendance_approved_at is null),
    'month', jsonb_build_object(
      'billed', coalesce((select sum(ar.amount) from public.accounts_receivable ar where ar.property_id = target_property_id and ar.status = 'active' and ar.issued_on >= month_start and ar.issued_on <= today), 0),
      'collected', coalesce((select sum(p.amount) from public.payments p where p.property_id = target_property_id and p.status = 'posted' and p.paid_on >= month_start and p.paid_on <= today), 0),
      'overdue', coalesce((select sum(overdue) from accounts), 0),
      'units_in_arrears', (select count(*) from accounts where overdue > 0),
      'active_agreements', (select count(*) from public.payment_agreements pa where pa.property_id = target_property_id and pa.status = 'active')),
    'series', (select jsonb_agg(jsonb_build_object('month', to_char(m.month, 'YYYY-MM'),
        'billed', coalesce((select sum(ar.amount) from public.accounts_receivable ar where ar.property_id = target_property_id and ar.status = 'active' and date_trunc('month', ar.issued_on) = m.month), 0),
        'collected', coalesce((select sum(p.amount) from public.payments p where p.property_id = target_property_id and p.status = 'posted' and date_trunc('month', p.paid_on) = m.month), 0)) order by m.month)
      from months m),
    'statuses', jsonb_build_object(
      'current', (select count(*) from public.units u where u.property_id = target_property_id and u.status = 'active'
        and coalesce((select outstanding from accounts a where a.unit_id = u.id), 0) = 0),
      'pending', (select count(*) from accounts where outstanding > 0 and overdue = 0),
      'overdue', (select count(*) from accounts where overdue > 0))
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_admin_dashboard(uuid) from public, anon;
grant execute on function public.get_admin_dashboard(uuid) to authenticated;

commit;

select has_function_privilege('authenticated', 'public.get_admin_dashboard(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_admin_dashboard(uuid)', 'execute') as inicio_admin_disponible;
