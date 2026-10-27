-- Reservas: el residente sabe antes de llenar el formulario si la mora lo bloquea (26/10/2026).
-- Devuelve los días de mora de la política cuando todos los apartamentos vigentes de la cuenta
-- tienen una deuda con esa antigüedad; null si puede reservar. Misma regla que create_reservation.
begin;

create or replace function public.get_reservation_debt_block(target_property_id uuid)
returns integer language sql stable security definer set search_path='' as $$
  with policy as (
    select coalesce(pp.restrict_reservations_for_debt,false) as restricted,coalesce(pp.minimum_overdue_days,30) as days
    from (select 1) one left join public.property_policies pp on pp.property_id=target_property_id
  ), my_units as (
    select distinct um.unit_id from public.unit_memberships um
    join public.property_members pm on pm.property_id=um.property_id and pm.id=um.member_id
    where um.property_id=target_property_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
      and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
  )
  select p.days from policy p
  where p.restricted and exists(select 1 from my_units)
    and not exists(select 1 from my_units u where not private.unit_has_blocking_debt(target_property_id,u.unit_id,p.days));
$$;
revoke all on function public.get_reservation_debt_block(uuid) from public,anon;
grant execute on function public.get_reservation_debt_block(uuid) to authenticated;

commit;

select has_function_privilege('authenticated','public.get_reservation_debt_block(uuid)','execute')
  and not has_function_privilege('anon','public.get_reservation_debt_block(uuid)','execute') as consulta_mora_disponible;
