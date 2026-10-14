-- slot_minutes is the maximum reservation duration, not a required time increment.
-- Preserve the existing authorization, finance lock, schedule, conflict, and notification checks.
create or replace function public.save_amenity(
  target_property_id uuid,target_amenity_id uuid,target_name text,target_description text,target_capacity integer,
  target_requires_approval boolean,target_rules text,target_slot_minutes integer,target_status text,target_hours jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare saved_id uuid; item jsonb; item_weekday integer; item_opens time; item_closes time; clean_name text:=trim(target_name);
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if char_length(clean_name) not between 2 and 100 or target_capacity not between 1 and 10000 or target_slot_minutes not between 15 and 1440 or target_status not in ('active','inactive') then raise exception 'invalid_input'; end if;
  if target_hours is null or jsonb_typeof(target_hours)<>'array' or jsonb_array_length(target_hours)=0 then raise exception 'hours_required'; end if;
  if target_amenity_id is null then
    insert into public.amenities(property_id,name,description,capacity,requires_approval,rules,slot_minutes,status,created_by)
    values(target_property_id,clean_name,nullif(trim(target_description),''),target_capacity,target_requires_approval,nullif(trim(target_rules),''),target_slot_minutes,target_status,auth.uid()) returning id into saved_id;
  else
    select id into saved_id from public.amenities where id=target_amenity_id and property_id=target_property_id for update;
    if saved_id is null then raise exception 'amenity_not_found'; end if;
    perform private.refresh_reservation_states(target_property_id);
    if target_status='inactive' and exists(select 1 from public.reservations where property_id=target_property_id and amenity_id=saved_id and blocks_slot and ends_at>now()) then raise exception 'active_reservations_exist'; end if;
    update public.amenities set name=clean_name,description=nullif(trim(target_description),''),capacity=target_capacity,requires_approval=target_requires_approval,rules=nullif(trim(target_rules),''),slot_minutes=target_slot_minutes,status=target_status where id=saved_id;
    delete from public.amenity_hours where property_id=target_property_id and amenity_id=saved_id;
  end if;
  for item in select value from jsonb_array_elements(target_hours)
  loop
    item_weekday:=(item->>'weekday')::integer; item_opens:=(item->>'opens_at')::time; item_closes:=(item->>'closes_at')::time;
    if item_weekday not between 1 and 7 or item_opens is null or item_closes is null then raise exception 'invalid_hours'; end if;
    if exists (
      select 1 from public.amenity_hours h
      where h.property_id=target_property_id and h.amenity_id=saved_id
        and (
          h.weekday=item_weekday
          or ((item_weekday-h.weekday+7)%7=1 and h.closes_at<=h.opens_at and item_opens<h.closes_at)
          or ((h.weekday-item_weekday+7)%7=1 and item_closes<=item_opens and h.opens_at<item_closes)
        )
    ) then raise exception 'overlapping_hours'; end if;
    insert into public.amenity_hours(property_id,amenity_id,weekday,opens_at,closes_at) values(target_property_id,saved_id,item_weekday,item_opens,item_closes);
  end loop;
  insert into public.property_policies(property_id,updated_by) values(target_property_id,auth.uid()) on conflict(property_id) do nothing;
  perform private.write_property_audit(target_property_id,case when target_amenity_id is null then 'amenity.created' else 'amenity.updated' end,'amenity',saved_id,jsonb_build_object('status',target_status,'capacity',target_capacity));
  return saved_id;
exception when unique_violation then raise exception 'amenity_name_exists';
end;
$$;

create or replace function public.create_reservation(target_property_id uuid,target_amenity_id uuid,target_unit_id uuid,target_starts_at timestamp,target_ends_at timestamp,target_attendee_count integer,target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.amenities%rowtype; policy public.property_policies%rowtype; requester_id uuid; property_timezone text; actual_start timestamptz; actual_end timestamptz; initial_status text; hold_until timestamptz; created_id uuid;
begin
  select pm.id into requester_id from public.property_members pm
  join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id and um.unit_id=target_unit_id
  where pm.property_id=target_property_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles) and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now()) limit 1;
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
  insert into public.reservations(property_id,amenity_id,unit_id,requester_member_id,starts_at,ends_at,attendee_count,status,blocks_slot,hold_expires_at,idempotency_key)
  values(target_property_id,a.id,target_unit_id,requester_id,actual_start,actual_end,target_attendee_count,initial_status,true,hold_until,target_idempotency_key) returning id into created_id;
  insert into public.activity_events(property_id,reservation_id,actor_id,event_type,new_state,description) values(target_property_id,created_id,auth.uid(),'reservation_created',initial_status,case when initial_status='pending' then 'Solicitud de reserva creada' else 'Reserva confirmada' end);
  perform private.write_property_audit(target_property_id,'reservation.created','reservation',created_id,jsonb_build_object('amenity_id',a.id,'unit_id',target_unit_id,'status',initial_status));
  if initial_status='pending' then perform private.enqueue_reservation_notification(created_id,'reservation_created','Solicitud de reserva recibida','La solicitud está pendiente de aprobación.','created'); else perform private.enqueue_reservation_notification(created_id,'reservation_approved','Reserva confirmada','La reserva fue confirmada automáticamente.','approved'); end if;
  return created_id;
exception when exclusion_violation then raise exception 'reservation_conflict';
end;
$$;

revoke all on function public.save_amenity(uuid,uuid,text,text,integer,boolean,text,integer,text,jsonb),public.create_reservation(uuid,uuid,uuid,timestamp,timestamp,integer,uuid) from public,anon;
grant execute on function public.save_amenity(uuid,uuid,text,text,integer,boolean,text,integer,text,jsonb),public.create_reservation(uuid,uuid,uuid,timestamp,timestamp,integer,uuid) to authenticated;
notify pgrst, 'reload schema';
