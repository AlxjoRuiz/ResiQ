-- Expose creation time in the role-scoped operational list so every profile
-- can order reservations by when the request was submitted.
create function public.list_operational_reservations_recent(
  target_property_id uuid,target_from timestamptz,target_to timestamptz
) returns table(
  reservation_id uuid,amenity_name text,building_name text,unit_code text,
  requester_name text,attendee_count integer,status text,starts_at timestamptz,
  ends_at timestamptz,purpose text,review_message text,decision_reason text,
  created_at timestamptz
) language plpgsql security definer set search_path='' as $$
begin
  if not (private.is_active_member(target_property_id,'administrator') or private.is_active_member(target_property_id,'concierge')) then
    raise exception 'not_authorized';
  end if;
  if target_to <= target_from or target_to > target_from + interval '124 days' then
    raise exception 'invalid_window';
  end if;
  perform private.refresh_reservation_states(target_property_id);
  return query select
    r.id,a.name,b.name,u.code,p.display_name,r.attendee_count,r.status,
    r.starts_at,r.ends_at,r.purpose,r.review_message,r.decision_reason,r.created_at
  from public.reservations r
  join public.amenities a on a.id=r.amenity_id and a.property_id=r.property_id
  join public.units u on u.id=r.unit_id and u.property_id=r.property_id
  join public.buildings b on b.id=u.building_id and b.property_id=u.property_id
  join public.property_members pm on pm.id=r.requester_member_id and pm.property_id=r.property_id
  join public.profiles p on p.id=pm.user_id
  where r.property_id=target_property_id and r.starts_at<target_to and r.ends_at>target_from
  order by r.created_at desc,r.id desc;
end;
$$;

revoke all on function public.list_operational_reservations_recent(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.list_operational_reservations_recent(uuid,timestamptz,timestamptz) to authenticated;
notify pgrst, 'reload schema';
