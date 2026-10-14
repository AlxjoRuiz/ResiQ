-- Record why a reservation was requested and show decision context to every authorized role.
alter table public.reservations add column purpose text
  check (purpose is null or char_length(purpose) between 3 and 500);
alter table public.reservations add column review_message text
  check (review_message is null or char_length(review_message) between 3 and 500);

-- Keep the original RPC for clients already open in a browser during deployment.
create or replace function public.create_reservation_with_purpose(
  target_property_id uuid,target_amenity_id uuid,target_unit_id uuid,
  target_starts_at timestamp,target_ends_at timestamp,target_attendee_count integer,
  target_idempotency_key uuid,target_purpose text
) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.amenities%rowtype; policy public.property_policies%rowtype; requester_id uuid;
  property_timezone text; actual_start timestamptz; actual_end timestamptz;
  initial_status text; hold_until timestamptz; created_id uuid; clean_purpose text:=trim(target_purpose);
begin
  if clean_purpose is null or char_length(clean_purpose) not between 3 and 500 then raise exception 'purpose_required'; end if;
  select pm.id into requester_id from public.property_members pm
  join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id and um.unit_id=target_unit_id
  where pm.property_id=target_property_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
    and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now()) limit 1;
  if requester_id is null then raise exception 'not_authorized'; end if;
  perform private.lock_unit_finance(target_property_id,target_unit_id);
  select * into a from public.amenities where id=target_amenity_id and property_id=target_property_id for update;
  if not found or a.status<>'active' then raise exception 'amenity_unavailable'; end if;
  select timezone into property_timezone from public.properties where id=target_property_id and status='active';
  actual_start:=target_starts_at at time zone property_timezone; actual_end:=target_ends_at at time zone property_timezone;
  if actual_start<now() or actual_end<=actual_start or target_attendee_count not between 1 and a.capacity then raise exception 'invalid_input'; end if;
  if target_ends_at<=target_starts_at or target_ends_at-target_starts_at>make_interval(mins=>a.slot_minutes) then raise exception 'reservation_too_long'; end if;
  if not exists (
    select 1 from public.amenity_hours h
    cross join lateral (values (target_starts_at::date),(target_starts_at::date-1)) dates(opening_date)
    where h.property_id=target_property_id and h.amenity_id=a.id
      and h.weekday=extract(isodow from dates.opening_date)::integer
      and target_starts_at>=dates.opening_date+h.opens_at
      and target_ends_at<=dates.opening_date+h.closes_at+case when h.closes_at<=h.opens_at then interval '1 day' else interval '0 days' end
  ) then raise exception 'outside_amenity_hours'; end if;
  perform private.refresh_reservation_states(target_property_id);
  if exists(select 1 from public.amenity_blackouts b where b.property_id=target_property_id and b.amenity_id=a.id and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(actual_start,actual_end,'[)')) then raise exception 'amenity_closed'; end if;
  if exists(select 1 from public.reservations r where r.property_id=target_property_id and r.amenity_id=a.id and r.blocks_slot and tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(actual_start,actual_end,'[)')) then raise exception 'reservation_conflict'; end if;
  insert into public.property_policies(property_id) values(target_property_id) on conflict do nothing;
  select * into policy from public.property_policies where property_id=target_property_id for update;
  if policy.restrict_reservations_for_debt and private.unit_has_blocking_debt(target_property_id,target_unit_id,policy.minimum_overdue_days) then raise exception 'reservation_blocked_by_debt'; end if;
  if a.requires_approval then initial_status:='pending'; hold_until:=least(now()+make_interval(mins=>policy.pending_hold_minutes),actual_start); else initial_status:='approved'; hold_until:=null; end if;
  insert into public.reservations(property_id,amenity_id,unit_id,requester_member_id,starts_at,ends_at,attendee_count,status,blocks_slot,hold_expires_at,idempotency_key,purpose)
  values(target_property_id,a.id,target_unit_id,requester_id,actual_start,actual_end,target_attendee_count,initial_status,true,hold_until,target_idempotency_key,clean_purpose) returning id into created_id;
  insert into public.activity_events(property_id,reservation_id,actor_id,event_type,new_state,description)
  values(target_property_id,created_id,auth.uid(),'reservation_created',initial_status,case when initial_status='pending' then 'Solicitud de reserva creada' else 'Reserva confirmada' end);
  perform private.write_property_audit(target_property_id,'reservation.created','reservation',created_id,jsonb_build_object('amenity_id',a.id,'unit_id',target_unit_id,'status',initial_status));
  if initial_status='pending' then
    perform private.enqueue_reservation_notification(created_id,'reservation_created','Solicitud de reserva recibida','La solicitud está pendiente de aprobación.','created');
  else
    perform private.enqueue_reservation_notification(created_id,'reservation_approved','Reserva confirmada','La reserva fue confirmada automáticamente.','approved');
  end if;
  return created_id;
exception when exclusion_violation then raise exception 'reservation_conflict';
end;
$$;

create or replace function public.decide_reservation(target_reservation_id uuid,target_approve boolean,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations%rowtype; clean_reason text:=nullif(trim(target_reason),''); new_status text;
begin
  select * into r from public.reservations where id=target_reservation_id for update;
  if not found or not private.is_active_member(r.property_id,'administrator') then raise exception 'not_authorized'; end if;
  perform private.refresh_reservation_states(r.property_id);
  select * into r from public.reservations where id=target_reservation_id for update;
  if r.status<>'pending' then raise exception 'invalid_transition'; end if;
  if (not target_approve and clean_reason is null) or (clean_reason is not null and char_length(clean_reason) not between 3 and 500) then raise exception 'reason_required'; end if;
  new_status:=case when target_approve then 'approved' else 'rejected' end;
  update public.reservations set status=new_status,blocks_slot=target_approve,hold_expires_at=null,
    decision_by=auth.uid(),decision_at=now(),decision_reason=clean_reason,review_message=clean_reason where id=r.id;
  insert into public.activity_events(property_id,reservation_id,actor_id,event_type,previous_state,new_state,description)
  values(r.property_id,r.id,auth.uid(),case when target_approve then 'reservation_approved' else 'reservation_rejected' end,
    'pending',new_status,case when target_approve and clean_reason is null then 'Reserva aprobada' when target_approve then 'Reserva aprobada: '||clean_reason else 'Reserva rechazada: '||clean_reason end);
  perform private.write_property_audit(r.property_id,'reservation.'||new_status,'reservation',r.id,jsonb_build_object('reason',clean_reason));
  perform private.enqueue_reservation_notification(r.id,
    case when target_approve then 'reservation_approved' else 'reservation_rejected' end,
    case when target_approve then 'Reserva aprobada' else 'Reserva rechazada' end,
    case when target_approve and clean_reason is null then 'La administración aprobó tu reserva.' when target_approve then 'La administración aprobó tu reserva: '||clean_reason else 'La administración rechazó tu reserva: '||clean_reason end,
    new_status);
end;
$$;

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
  if new.purpose is not null then notice_body:=notice_body||' Motivo de la reserva: '||new.purpose||'.'; end if;
  if new.status='approved' and new.review_message is not null then
    notice_body:=notice_body||' Mensaje de administración: '||new.review_message||'.';
  elsif new.status='cancelled' and new.decision_reason is not null then
    notice_body:=notice_body||' Motivo de cancelación: '||new.decision_reason||'.';
  end if;

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

create or replace function public.list_operational_reservations_with_context(
  target_property_id uuid,target_from timestamptz,target_to timestamptz
) returns table(
  reservation_id uuid,amenity_name text,building_name text,unit_code text,
  requester_name text,attendee_count integer,status text,starts_at timestamptz,
  ends_at timestamptz,purpose text,review_message text,decision_reason text
) language plpgsql security definer set search_path='' as $$
begin
  if not (private.is_active_member(target_property_id,'administrator') or private.is_active_member(target_property_id,'concierge')) then raise exception 'not_authorized'; end if;
  perform private.refresh_reservation_states(target_property_id);
  return query select r.id,a.name,b.name,u.code,p.display_name,r.attendee_count,r.status,r.starts_at,r.ends_at,r.purpose,r.review_message,r.decision_reason
  from public.reservations r
  join public.amenities a on a.id=r.amenity_id and a.property_id=r.property_id
  join public.units u on u.id=r.unit_id and u.property_id=r.property_id
  join public.buildings b on b.id=u.building_id and b.property_id=u.property_id
  join public.property_members pm on pm.id=r.requester_member_id and pm.property_id=r.property_id
  join public.profiles p on p.id=pm.user_id
  where r.property_id=target_property_id and r.starts_at<target_to and r.ends_at>target_from
  order by r.starts_at;
end;
$$;

revoke all on function public.create_reservation_with_purpose(uuid,uuid,uuid,timestamp,timestamp,integer,uuid,text),
  public.list_operational_reservations_with_context(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.create_reservation_with_purpose(uuid,uuid,uuid,timestamp,timestamp,integer,uuid,text),
  public.list_operational_reservations_with_context(uuid,timestamptz,timestamptz) to authenticated;
notify pgrst, 'reload schema';
