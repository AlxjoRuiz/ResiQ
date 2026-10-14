-- Keep the concierge desk informed of approved reservations and later cancellations.
-- These are in-app notices only; approval and cancellation permissions stay unchanged.
create or replace function private.notify_concierge_reservation_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  zone_name text;
  unit_label text;
  property_timezone text;
  notice_subject text;
  notice_body text;
  notice_suffix text;
begin
  if tg_op='INSERT' then
    if new.status<>'approved' then return new; end if;
  elsif old.status is not distinct from new.status or not (
    new.status='approved' or (old.status='approved' and new.status='cancelled')
  ) then return new; end if;

  select a.name, b.name||' · '||u.code, p.timezone
    into zone_name, unit_label, property_timezone
    from public.amenities a
    join public.units u on u.id=new.unit_id and u.property_id=new.property_id
    join public.buildings b on b.id=u.building_id and b.property_id=u.property_id
    join public.properties p on p.id=new.property_id
    where a.id=new.amenity_id and a.property_id=new.property_id;

  notice_suffix:=case when new.status='approved' then 'approved' else 'cancelled' end;
  notice_subject:=case when new.status='approved' then 'Reserva aprobada para portería' else 'Reserva cancelada para portería' end;
  notice_body:=zone_name||' · '||unit_label||' · '||new.attendee_count||case when new.attendee_count=1 then ' persona' else ' personas' end
    ||' · '||to_char(new.starts_at at time zone property_timezone,'DD/MM/YYYY HH24:MI')
    ||'–'||to_char(new.ends_at at time zone property_timezone,'DD/MM/YYYY HH24:MI')||'.';

  insert into public.notifications(property_id,recipient_member_id,type,subject,body,target_type,target_id,dedupe_key)
  select new.property_id,pm.id,
    case when new.status='approved' then 'reservation_approved' else 'reservation_cancelled' end,
    notice_subject,notice_body,'reservation',new.id,
    'reservation:'||new.id||':concierge:'||notice_suffix
  from public.property_members pm
  where pm.property_id=new.property_id and pm.status='active' and 'concierge'=any(pm.roles)
  on conflict(property_id,recipient_member_id,dedupe_key) do nothing;
  return new;
end;
$$;

revoke all on function private.notify_concierge_reservation_status() from public,anon,authenticated;
create trigger reservations_notify_concierge_status
after insert or update of status on public.reservations
for each row execute function private.notify_concierge_reservation_status();
