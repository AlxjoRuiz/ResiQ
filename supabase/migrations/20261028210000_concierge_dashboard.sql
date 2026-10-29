-- Inicio de portería (28/10/2026): todo en una sola consulta. Visitas de hoy (por llegar, adentro y
-- ya salieron), paquetes por entregar y reservas de hoy. «Hoy» en la zona horaria del conjunto.
begin;

create or replace function public.get_concierge_dashboard(target_property_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare zone text; day_start timestamptz; day_end timestamptz; result jsonb;
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'concierge') then raise exception 'not_authorized'; end if;
  select coalesce(timezone, 'America/Bogota') into zone from public.properties where id = target_property_id;
  day_start := date_trunc('day', now() at time zone zone) at time zone zone;
  day_end := day_start + interval '1 day';

  select jsonb_build_object(
    'visits', jsonb_build_object(
      'expected', (select count(*) from public.visitors v where v.property_id = target_property_id and v.status = 'authorized' and v.scheduled_start < day_end and v.scheduled_end >= day_start),
      'inside', (select count(*) from public.visitors v where v.property_id = target_property_id and v.status = 'entered'),
      'exited', (select count(*) from public.visitor_entries e where e.property_id = target_property_id and e.exited_at >= day_start and e.exited_at < day_end),
      'upcoming', coalesce((select jsonb_agg(row_data order by scheduled_start) from (
        select jsonb_build_object('id', v.id, 'visitor_name', v.visitor_name, 'scheduled_start', v.scheduled_start, 'status', v.status, 'unit', b.name || ' · ' || u.code) as row_data, v.scheduled_start
        from public.visitors v join public.units u on u.id = v.unit_id join public.buildings b on b.id = u.building_id
        where v.property_id = target_property_id and v.status in ('authorized','entered') and v.scheduled_start < day_end and v.scheduled_end >= day_start
        order by v.scheduled_start limit 5) upcoming), '[]'::jsonb)),
    'packages', jsonb_build_object(
      'count', (select count(*) from public.packages p where p.property_id = target_property_id and p.status <> 'delivered'),
      'items', coalesce((select jsonb_agg(row_data order by received_at) from (
        select jsonb_build_object('id', p.id, 'kind', p.kind, 'utility_service', p.utility_service, 'recipient_name', p.recipient_name, 'received_at', p.received_at, 'unit', b.name || ' · ' || u.code) as row_data, p.received_at
        from public.packages p join public.units u on u.id = p.unit_id join public.buildings b on b.id = u.building_id
        where p.property_id = target_property_id and p.status <> 'delivered'
        order by p.received_at limit 5) items), '[]'::jsonb)),
    'reservations', coalesce((select jsonb_agg(row_data order by starts_at) from (
      select jsonb_build_object('id', r.id, 'amenity', am.name, 'starts_at', r.starts_at, 'ends_at', r.ends_at, 'unit', b.name || ' · ' || u.code) as row_data, r.starts_at
      from public.reservations r join public.amenities am on am.id = r.amenity_id
      join public.units u on u.id = r.unit_id join public.buildings b on b.id = u.building_id
      where r.property_id = target_property_id and r.status = 'approved' and r.starts_at < day_end and r.ends_at >= day_start
      order by r.starts_at) today), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_concierge_dashboard(uuid) from public, anon;
grant execute on function public.get_concierge_dashboard(uuid) to authenticated;

commit;

select has_function_privilege('authenticated', 'public.get_concierge_dashboard(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_concierge_dashboard(uuid)', 'execute') as inicio_porteria_disponible;
