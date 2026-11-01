-- Módulo jurídico (01/11/2026, pedido de Alejandro): «En mora» desde el primer día de vencida cualquier
-- deuda sin pagar; «Al día» solo los apartamentos sin nada vencido. Los días de mora del admin en Cartera
-- siguen sirviendo para bloquear reservas, pero ya no filtran la lista de la abogada. Mismas firmas.
begin;

-- Abogada: sus conjuntos asignados con las cifras de cartera y las novedades desde su última visita.
create or replace function public.legal_list_properties()
returns table(property_id uuid, property_name text, city text, overdue_days integer, units_in_arrears integer, arrears_amount numeric, units_current integer, news_count integer, seen_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := private.legal_staff_id();
begin
  if auth.uid() is null or me is null then raise exception 'not_authorized'; end if;
  return query
  with props as (
    select p.id, p.name, p.city, p.timezone, private.property_overdue_days(p.id) as overdue_days, v.seen_at
    from public.legal_assignments a join public.properties p on p.id = a.property_id and p.status = 'active'
    left join public.legal_property_views v on v.property_id = p.id and v.staff_id = me
  ), recv as (
    select ar.property_id, ar.unit_id, ar.due_on, private.receivable_outstanding(ar.id) as outstanding
    from public.accounts_receivable ar join props on props.id = ar.property_id where ar.status = 'active'
  ), units as (
    select r.property_id, r.unit_id,
      sum(r.outstanding) filter (where r.due_on < (now() at time zone props.timezone)::date) as overdue,
      min(r.due_on) filter (where r.outstanding > 0 and r.due_on < (now() at time zone props.timezone)::date) as oldest
    from recv r join props on props.id = r.property_id group by r.property_id, r.unit_id
  ), totals as (
    select u.property_id,
      count(*) filter (where u.oldest is not null)::integer as in_arrears,
      coalesce(sum(u.overdue) filter (where u.oldest is not null), 0) as amount
    from units u group by u.property_id
  )
  select props.id, props.name, props.city, props.overdue_days, coalesce(t.in_arrears, 0),
    coalesce(t.amount, 0)::numeric,
    ((select count(*) from public.units x where x.property_id = props.id and x.status = 'active') - coalesce(t.in_arrears, 0))::integer,
    (select count(*)::integer from public.legal_property_news(props.id) n where n.is_new),
    props.seen_at
  from props left join totals t on t.property_id = props.id
  order by props.name;
end;
$$;

-- Abogada: cada apartamento del conjunto con su cartera en vivo. in_arrears = tiene al menos una deuda
-- vencida sin pagar (desde el primer día).
create or replace function public.legal_property_accounts(target_property_id uuid)
returns table(unit_id uuid, building_name text, unit_code text, owner_name text, outstanding numeric, overdue numeric, days_overdue integer, last_payment_on date, agreement_active boolean, in_arrears boolean)
language plpgsql stable security definer set search_path = '' as $$
declare today date;
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  select (now() at time zone p.timezone)::date into today from public.properties p where p.id = target_property_id;
  return query
  with recv as (
    select ar.unit_id, ar.due_on, private.receivable_outstanding(ar.id) as owed
    from public.accounts_receivable ar where ar.property_id = target_property_id and ar.status = 'active'
  ), agg as (
    select r.unit_id, sum(r.owed) as total, sum(r.owed) filter (where r.due_on < today) as late,
      min(r.due_on) filter (where r.owed > 0 and r.due_on < today) as oldest
    from recv r group by r.unit_id
  ), paid as (
    select p.unit_id, max(p.paid_on) as last_paid from public.payments p where p.property_id = target_property_id and p.status = 'posted' group by p.unit_id
  ), agreements as (
    select distinct g.unit_id from public.payment_agreements g where g.property_id = target_property_id and g.status = 'active'
  ), owners as (
    select distinct on (c.unit_id) c.unit_id, c.full_name from public.census_records c
    where c.property_id = target_property_id and c.full_name is not null order by c.unit_id, c.invitation_primary desc, c.source_row
  )
  select u.id, b.name, u.code, o.full_name, coalesce(g.total, 0)::numeric, coalesce(g.late, 0)::numeric,
    coalesce(today - g.oldest, 0)::integer, pd.last_paid, ag.unit_id is not null, g.oldest is not null
  from public.units u join public.buildings b on b.property_id = u.property_id and b.id = u.building_id
  left join agg g on g.unit_id = u.id left join paid pd on pd.unit_id = u.id
  left join agreements ag on ag.unit_id = u.id left join owners o on o.unit_id = u.id
  where u.property_id = target_property_id and u.status = 'active'
  order by coalesce(today - g.oldest, 0) desc, coalesce(g.late, 0) desc, b.name, u.code;
end;
$$;

commit;

-- Debe dar true.
select pg_get_functiondef('public.legal_property_accounts(uuid)'::regprocedure) not like '%threshold%' as mora_desde_el_primer_dia;
