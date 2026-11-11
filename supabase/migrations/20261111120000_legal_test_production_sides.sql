-- Jurídica separada en prueba y producción (11/11/2026, pedido de Alejandro). Hasta ahora toda abogada veía todos
-- los conjuntos asignados a jurídica, de prueba y de producción. Ahora, con la misma regla de mantenimiento:
-- * La abogada es de prueba si su correo es @resiq.invalid o está en Pruebas ResiQ › Correos de prueba.
-- * Una abogada de prueba solo ve conjuntos asignados marcados de prueba (properties.is_test).
-- * Una abogada de producción solo ve conjuntos asignados que NO son de prueba.
-- legal_can_view lo usan casi todas las funciones de jurídica (cartera, detalle, requerimientos, respuestas, informe);
-- legal_list_properties pasa a usarlo también. Mismas firmas que antes.
begin;

-- ¿La abogada que consulta es de prueba?
create or replace function private.legal_staff_is_test()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select lower(u.email::text) like '%@resiq.invalid'
      or exists(select 1 from public.platform_test_emails t where t.email_normalized = lower(u.email::text))
    from auth.users u where u.id = auth.uid()), false);
$$;
revoke all on function private.legal_staff_is_test() from public, anon, authenticated;

create or replace function private.legal_can_view(target_property_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.legal_staff_id() is not null and exists(
    select 1 from public.legal_assignments a join public.properties p on p.id = a.property_id
    where a.property_id = target_property_id and p.status = 'active' and p.is_test = private.legal_staff_is_test());
$$;
revoke all on function private.legal_can_view(uuid) from public, anon;
grant execute on function private.legal_can_view(uuid) to authenticated;

-- Abogada: sus conjuntos (solo los de su lado) con las cifras de cartera y las novedades desde su última visita.
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

commit;

-- Debe dar true. La segunda consulta muestra cada conjunto asignado a jurídica y si es de prueba.
select pg_get_functiondef('private.legal_can_view(uuid)'::regprocedure) like '%legal_staff_is_test%' as juridica_separada;
select p.name as conjunto, p.is_test as de_prueba from public.legal_assignments a join public.properties p on p.id = a.property_id order by p.is_test, p.name;
