-- El calendario puede mostrar el motivo de un cierre a los miembros de la propiedad.
-- Las reservas de otros residentes siguen exponiendo solo su intervalo ocupado.
-- Se conserva la función anterior para las versiones de la interfaz aún abiertas.

create function public.get_amenity_availability_with_reason(target_amenity_id uuid,target_from timestamptz,target_to timestamptz)
returns table(starts_at timestamptz,ends_at timestamptz,kind text,reason text)
language plpgsql security definer set search_path='' as $$
declare target_property_id uuid;
begin
  select a.property_id into target_property_id from public.amenities a where a.id=target_amenity_id and a.status='active';
  if target_property_id is null or not private.is_active_member(target_property_id) then raise exception 'not_authorized'; end if;
  if target_to<=target_from or target_to>target_from+interval '93 days' then raise exception 'invalid_window'; end if;
  perform private.refresh_reservation_states(target_property_id);
  return query
    select r.starts_at,r.ends_at,'occupied'::text,null::text
    from public.reservations r
    where r.property_id=target_property_id and r.amenity_id=target_amenity_id
      and r.blocks_slot and r.starts_at<target_to and r.ends_at>target_from
    union all
    select b.starts_at,b.ends_at,'closed'::text,b.reason
    from public.amenity_blackouts b
    where b.property_id=target_property_id and b.amenity_id=target_amenity_id
      and b.starts_at<target_to and b.ends_at>target_from
    order by 1;
end;
$$;

revoke all on function public.get_amenity_availability_with_reason(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.get_amenity_availability_with_reason(uuid,timestamptz,timestamptz) to authenticated;
notify pgrst, 'reload schema';
