-- Inicio del residente (28/10/2026): todo en una sola consulta. Mi cartera (saldo, vencido y próxima
-- fecha de pago), paquetes por recoger, próximas reservas y visitas, próxima asamblea con mi respuesta
-- y comunicados recientes. Solo datos de los apartamentos vigentes de la cuenta.
begin;

create or replace function public.get_resident_dashboard(target_property_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid; zone text; today date; result jsonb;
begin
  select pm.id into me from public.property_members pm
  where pm.property_id = target_property_id and pm.user_id = auth.uid() and pm.status = 'active' and 'member' = any(pm.roles);
  if me is null then raise exception 'not_authorized'; end if;
  select timezone into zone from public.properties where id = target_property_id;
  today := (now() at time zone coalesce(zone, 'America/Bogota'))::date;

  with my_units as (
    select distinct um.unit_id from public.unit_memberships um
    where um.property_id = target_property_id and um.member_id = me and um.valid_from <= now() and (um.valid_to is null or um.valid_to > now())
  ), debts as (
    select ar.id, ar.concept, ar.due_on, private.receivable_outstanding(ar.id) as outstanding
    from public.accounts_receivable ar
    where ar.property_id = target_property_id and ar.status = 'active' and ar.unit_id in (select unit_id from my_units)
      and private.can_access_unit_finance(target_property_id, ar.unit_id)
  ), next_assembly as (
    select a.id, a.title, a.starts_at, a.location, a.status, aa.rsvp from public.assemblies a
    join public.assembly_attendees aa on aa.assembly_id = a.id and aa.property_id = a.property_id and aa.member_id = me
    where a.property_id = target_property_id and a.published_at is not null and a.status in ('scheduled','in_progress')
    order by a.starts_at limit 1
  )
  select jsonb_build_object(
    'finance', jsonb_build_object(
      'balance', coalesce((select sum(outstanding) from debts), 0),
      'overdue', coalesce((select sum(outstanding) from debts where due_on < today), 0),
      'next_due', (select jsonb_build_object('concept', concept, 'due_on', due_on, 'amount', outstanding) from debts where outstanding > 0 order by due_on limit 1),
      'unit_id', (select unit_id from my_units limit 1)),
    'packages', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'utility_service', p.utility_service, 'received_at', p.received_at) order by p.received_at desc)
      from public.packages p where p.property_id = target_property_id and p.unit_id in (select unit_id from my_units) and p.status <> 'delivered'), '[]'::jsonb),
    'reservations', coalesce((select jsonb_agg(row_data order by starts_at) from (
      select jsonb_build_object('id', r.id, 'amenity', am.name, 'starts_at', r.starts_at, 'ends_at', r.ends_at, 'status', r.status) as row_data, r.starts_at
      from public.reservations r join public.amenities am on am.id = r.amenity_id and am.property_id = r.property_id
      where r.property_id = target_property_id and r.unit_id in (select unit_id from my_units) and r.status in ('pending','approved') and r.ends_at >= now()
      order by r.starts_at limit 3) upcoming), '[]'::jsonb),
    'visitors', coalesce((select jsonb_agg(row_data order by scheduled_start) from (
      select jsonb_build_object('id', v.id, 'visitor_name', v.visitor_name, 'scheduled_start', v.scheduled_start, 'status', v.status) as row_data, v.scheduled_start
      from public.visitors v
      where v.property_id = target_property_id and v.unit_id in (select unit_id from my_units) and v.status in ('pending','authorized','entered') and v.scheduled_end >= now()
      order by v.scheduled_start limit 3) upcoming), '[]'::jsonb),
    'assembly', (select jsonb_build_object('id', id, 'title', title, 'starts_at', starts_at, 'location', location, 'status', status, 'rsvp', rsvp) from next_assembly),
    'announcements', coalesce((select jsonb_agg(row_data order by published_at desc) from (
      select jsonb_build_object('id', an.id, 'subject', an.subject, 'published_at', an.published_at) as row_data, an.published_at
      from public.announcements an join public.announcement_recipients ar on ar.announcement_id = an.id and ar.member_id = me
      where an.property_id = target_property_id and an.status = 'published'
      order by an.published_at desc limit 3) recent), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_resident_dashboard(uuid) from public, anon;
grant execute on function public.get_resident_dashboard(uuid) to authenticated;

commit;

select has_function_privilege('authenticated', 'public.get_resident_dashboard(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_resident_dashboard(uuid)', 'execute') as inicio_residente_disponible;
