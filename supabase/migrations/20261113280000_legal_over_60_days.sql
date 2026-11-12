-- Jurídica solo con mora de más de 60 días (13/11/2026, pedido de Alejandro). La abogada ve en sus conjuntos solo los
-- apartamentos con más de 60 días de mora (la deuda vencida más antigua sin pagar), y ya no ve los que están al día.
-- Esta función da las cifras de la tarjeta de cada conjunto («En mora» y «Deuda en mora») con esa regla. La lista del
-- conjunto aplica el mismo filtro en la página. El informe jurídico no cambia.
-- Igual que 20261111120000 salvo el filtro de más de 60 días.
begin;

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
    where private.legal_can_view(p.id)
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
      count(*) filter (where u.oldest is not null and (now() at time zone p2.timezone)::date - u.oldest > 60)::integer as in_arrears,
      coalesce(sum(u.overdue) filter (where u.oldest is not null and (now() at time zone p2.timezone)::date - u.oldest > 60), 0) as amount
    from units u join props p2 on p2.id = u.property_id group by u.property_id
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

commit;

-- Debe dar true.
select pg_get_functiondef('public.legal_list_properties()'::regprocedure) like '%> 60%' as juridica_mas_de_60_dias;
