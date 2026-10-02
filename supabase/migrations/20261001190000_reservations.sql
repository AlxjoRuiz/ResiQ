-- Etapa 11: zonas comunes, horarios, cierres y reservas exclusivas.

create extension if not exists btree_gist;

create table public.property_policies (
  property_id uuid primary key references public.properties(id) on delete cascade,
  restrict_reservations_for_debt boolean not null default false,
  minimum_overdue_days integer not null default 30 check (minimum_overdue_days >= 0),
  pending_reservations_block boolean not null default true,
  pending_hold_minutes integer not null default 1440 check (pending_hold_minutes between 60 and 2880),
  visitor_document_required boolean not null default false,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger property_policies_set_updated_at before update on public.property_policies for each row execute function private.set_updated_at();
insert into public.property_policies(property_id) select id from public.properties on conflict do nothing;

create or replace function private.create_default_property_policy()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.property_policies(property_id) values(new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger properties_create_default_policy after insert on public.properties for each row execute function private.create_default_property_policy();

create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 100),
  description text check (description is null or char_length(description) <= 1000),
  capacity integer not null check (capacity between 1 and 10000),
  status text not null default 'active' check (status in ('active','inactive')),
  requires_approval boolean not null default false,
  rules text check (rules is null or char_length(rules) <= 3000),
  booking_mode text not null default 'exclusive' check (booking_mode='exclusive'),
  slot_minutes integer not null default 60 check (slot_minutes between 15 and 1440),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,id),
  unique(property_id,name)
);
create index amenities_property_status_idx on public.amenities(property_id,status,name);
create trigger amenities_set_updated_at before update on public.amenities for each row execute function private.set_updated_at();

create table public.amenity_hours (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  amenity_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  unique(property_id,id),
  unique(property_id,amenity_id,weekday,opens_at,closes_at),
  foreign key(property_id,amenity_id) references public.amenities(property_id,id) on delete cascade,
  check (opens_at < closes_at)
);
create index amenity_hours_lookup_idx on public.amenity_hours(property_id,amenity_id,weekday,opens_at);

create table public.amenity_blackouts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  amenity_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(property_id,id),
  foreign key(property_id,amenity_id) references public.amenities(property_id,id) on delete restrict,
  check (ends_at > starts_at),
  exclude using gist (property_id with =, amenity_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
);
create index amenity_blackouts_lookup_idx on public.amenity_blackouts(property_id,amenity_id,starts_at);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  amenity_id uuid not null,
  unit_id uuid not null,
  requester_member_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  attendee_count integer not null check (attendee_count > 0),
  status text not null check (status in ('pending','approved','rejected','cancelled','expired','completed')),
  blocks_slot boolean not null,
  hold_expires_at timestamptz,
  decision_by uuid references public.profiles(id) on delete restrict,
  decision_at timestamptz,
  decision_reason text check (decision_reason is null or char_length(decision_reason) between 3 and 500),
  cancelled_at timestamptz,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,id),
  unique(property_id,requester_member_id,idempotency_key),
  foreign key(property_id,amenity_id) references public.amenities(property_id,id) on delete restrict,
  foreign key(property_id,unit_id) references public.units(property_id,id) on delete restrict,
  foreign key(property_id,requester_member_id) references public.property_members(property_id,id) on delete restrict,
  check (ends_at > starts_at),
  check ((status='pending')=(hold_expires_at is not null)),
  check ((status in ('pending','approved'))=blocks_slot),
  check (status not in ('rejected','cancelled') or decision_reason is not null),
  check ((status='cancelled')=(cancelled_at is not null)),
  exclude using gist (property_id with =, amenity_id with =, tstzrange(starts_at,ends_at,'[)') with &&) where (blocks_slot)
);
create index reservations_property_status_start_idx on public.reservations(property_id,status,starts_at);
create index reservations_unit_start_idx on public.reservations(property_id,unit_id,starts_at desc);
create index reservations_requester_idx on public.reservations(property_id,requester_member_id,created_at desc);
create trigger reservations_set_updated_at before update on public.reservations for each row execute function private.set_updated_at();

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired'));
alter table public.notifications drop constraint notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check check (target_type in ('pqrs','package','visitor','reservation'));
alter table public.email_jobs drop constraint email_jobs_template_key_check;
alter table public.email_jobs add constraint email_jobs_template_key_check check (template_key in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired'));

alter table public.activity_events add column reservation_id uuid;
alter table public.activity_events add foreign key(property_id,reservation_id) references public.reservations(property_id,id) on delete restrict;
alter table public.activity_events drop constraint activity_events_one_parent_check;
alter table public.activity_events add constraint activity_events_one_parent_check check (num_nonnulls(pqrs_id,package_id,visitor_id,reservation_id)=1);
alter table public.activity_events drop constraint activity_events_event_type_check;
alter table public.activity_events add constraint activity_events_event_type_check check (event_type in ('created','message_added','status_changed','attachment_added','package_received','package_recipient_assigned','package_notified','package_delivered','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','reservation_completed'));
create index activity_events_reservation_idx on public.activity_events(property_id,reservation_id,occurred_at,id) where reservation_id is not null;

alter table public.property_policies enable row level security;
alter table public.amenities enable row level security;
alter table public.amenity_hours enable row level security;
alter table public.amenity_blackouts enable row level security;
alter table public.reservations enable row level security;

create policy property_policies_read_member on public.property_policies for select to authenticated using (private.is_active_member(property_id));
create policy amenities_read_member on public.amenities for select to authenticated using (private.is_active_member(property_id));
create policy amenity_hours_read_member on public.amenity_hours for select to authenticated using (private.is_active_member(property_id));
create policy amenity_blackouts_read_admin on public.amenity_blackouts for select to authenticated using (private.is_active_member(property_id,'administrator'));

create or replace function private.can_read_reservation(target_reservation_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.reservations r
    where r.id=target_reservation_id and (
      private.is_active_member(r.property_id,'administrator') or exists(
        select 1 from public.property_members pm
        join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id and um.unit_id=r.unit_id
        where pm.id=r.requester_member_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
          and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
      )
    )
  );
$$;
create policy reservations_read_authorized on public.reservations for select to authenticated using (private.can_read_reservation(id));
create policy activity_events_read_reservation on public.activity_events for select to authenticated using (reservation_id is not null and private.can_read_reservation(reservation_id));

grant select on public.property_policies,public.amenities,public.amenity_hours,public.amenity_blackouts,public.reservations to authenticated;
revoke all on function private.can_read_reservation(uuid) from public;
grant execute on function private.can_read_reservation(uuid) to authenticated;

create or replace function private.enqueue_reservation_notification(target_reservation_id uuid,target_type text,target_subject text,target_body text,target_suffix text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations%rowtype; notification_id uuid; recipient_email text; amenity_name text;
begin
  select * into r from public.reservations where id=target_reservation_id;
  if not found then raise exception 'reservation_not_found'; end if;
  select a.name into amenity_name from public.amenities a where a.id=r.amenity_id and a.property_id=r.property_id;
  insert into public.notifications(property_id,recipient_member_id,type,subject,body,target_type,target_id,dedupe_key)
  values(r.property_id,r.requester_member_id,target_type,target_subject,target_body,'reservation',r.id,'reservation:'||r.id||':'||target_suffix)
  on conflict(property_id,recipient_member_id,dedupe_key) do nothing returning id into notification_id;
  if notification_id is null then return; end if;
  select lower(au.email) into recipient_email from public.property_members pm join auth.users au on au.id=pm.user_id where pm.id=r.requester_member_id and pm.status='active';
  if recipient_email is not null then
    insert into public.email_jobs(property_id,notification_id,recipient_email,template_key,template_data,dedupe_key)
    values(r.property_id,notification_id,recipient_email,target_type,jsonb_build_object('property_id',r.property_id,'reservation_id',r.id,'amenity_name',amenity_name,'starts_at',r.starts_at,'ends_at',r.ends_at,'status',r.status,'timezone',(select p.timezone from public.properties p where p.id=r.property_id)),'reservation:'||r.id||':'||target_suffix);
  end if;
end;
$$;

create or replace function private.refresh_reservation_states(target_property_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare changed public.reservations%rowtype;
begin
  for changed in
    update public.reservations set status='expired',blocks_slot=false,hold_expires_at=null,decision_reason='Solicitud vencida sin aprobación'
    where property_id=target_property_id and status='pending' and hold_expires_at<=now()
    returning *
  loop
    insert into public.activity_events(property_id,reservation_id,actor_id,event_type,previous_state,new_state,description)
    values(changed.property_id,changed.id,null,'reservation_expired','pending','expired','Solicitud vencida sin aprobación');
    perform private.write_property_audit(changed.property_id,'reservation.expired','reservation',changed.id,'{}'::jsonb);
    perform private.enqueue_reservation_notification(changed.id,'reservation_expired','Solicitud de reserva vencida','La solicitud venció sin aprobación y el horario volvió a estar disponible.','expired');
  end loop;
  for changed in
    update public.reservations set status='completed',blocks_slot=false
    where property_id=target_property_id and status='approved' and ends_at<=now()
    returning *
  loop
    insert into public.activity_events(property_id,reservation_id,actor_id,event_type,previous_state,new_state,description)
    values(changed.property_id,changed.id,null,'reservation_completed','approved','completed','Reserva finalizada');
    perform private.write_property_audit(changed.property_id,'reservation.completed','reservation',changed.id,'{}'::jsonb);
  end loop;
end;
$$;

create or replace function public.refresh_reservations(target_property_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_active_member(target_property_id) then raise exception 'not_authorized'; end if;
  perform private.refresh_reservation_states(target_property_id);
end;
$$;

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
    if item_weekday not between 1 and 7 or item_opens>=item_closes then raise exception 'invalid_hours'; end if;
    if exists(select 1 from public.amenity_hours h where h.property_id=target_property_id and h.amenity_id=saved_id and h.weekday=item_weekday and h.opens_at < item_closes and h.closes_at > item_opens) then raise exception 'overlapping_hours'; end if;
    insert into public.amenity_hours(property_id,amenity_id,weekday,opens_at,closes_at) values(target_property_id,saved_id,item_weekday,item_opens,item_closes);
  end loop;
  insert into public.property_policies(property_id,updated_by) values(target_property_id,auth.uid()) on conflict(property_id) do nothing;
  perform private.write_property_audit(target_property_id,case when target_amenity_id is null then 'amenity.created' else 'amenity.updated' end,'amenity',saved_id,jsonb_build_object('status',target_status,'capacity',target_capacity));
  return saved_id;
exception when unique_violation then raise exception 'amenity_name_exists';
end;
$$;

create or replace function public.update_reservation_policy(target_property_id uuid,target_pending_hold_minutes integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if target_pending_hold_minutes not between 60 and 2880 then raise exception 'invalid_input'; end if;
  insert into public.property_policies(property_id,pending_reservations_block,pending_hold_minutes,updated_by)
  values(target_property_id,true,target_pending_hold_minutes,auth.uid())
  on conflict(property_id) do update set pending_reservations_block=true,pending_hold_minutes=excluded.pending_hold_minutes,updated_by=auth.uid();
  perform private.write_property_audit(target_property_id,'reservation.policy_updated','property_policy',target_property_id,jsonb_build_object('pending_hold_minutes',target_pending_hold_minutes));
end;
$$;

create or replace function public.create_amenity_blackout(target_amenity_id uuid,target_starts_at timestamp,target_ends_at timestamp,target_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.amenities%rowtype; created_id uuid; clean_reason text:=trim(target_reason); property_timezone text; actual_start timestamptz; actual_end timestamptz;
begin
  select * into a from public.amenities where id=target_amenity_id for update;
  if not found or not private.is_active_member(a.property_id,'administrator') then raise exception 'not_authorized'; end if;
  select p.timezone into property_timezone from public.properties p where p.id=a.property_id;
  actual_start:=target_starts_at at time zone property_timezone; actual_end:=target_ends_at at time zone property_timezone;
  if actual_end<=actual_start or actual_end<=now() or char_length(clean_reason) not between 3 and 500 then raise exception 'invalid_input'; end if;
  perform private.refresh_reservation_states(a.property_id);
  if exists(select 1 from public.reservations r where r.property_id=a.property_id and r.amenity_id=a.id and r.blocks_slot and tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(actual_start,actual_end,'[)')) then raise exception 'active_reservations_exist'; end if;
  insert into public.amenity_blackouts(property_id,amenity_id,starts_at,ends_at,reason,created_by) values(a.property_id,a.id,actual_start,actual_end,clean_reason,auth.uid()) returning id into created_id;
  perform private.write_property_audit(a.property_id,'amenity.blackout_created','amenity_blackout',created_id,jsonb_build_object('amenity_id',a.id));
  return created_id;
exception when exclusion_violation then raise exception 'blackout_conflict';
end;
$$;

create or replace function public.delete_amenity_blackout(target_blackout_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare b public.amenity_blackouts%rowtype;
begin
  select * into b from public.amenity_blackouts where id=target_blackout_id for update;
  if not found or not private.is_active_member(b.property_id,'administrator') then raise exception 'not_authorized'; end if;
  delete from public.amenity_blackouts where id=b.id;
  perform private.write_property_audit(b.property_id,'amenity.blackout_deleted','amenity_blackout',b.id,jsonb_build_object('amenity_id',b.amenity_id));
end;
$$;

create or replace function public.get_amenity_availability(target_amenity_id uuid,target_from timestamptz,target_to timestamptz)
returns table(starts_at timestamptz,ends_at timestamptz,kind text)
language plpgsql security definer set search_path='' as $$
declare target_property_id uuid;
begin
  select a.property_id into target_property_id from public.amenities a where a.id=target_amenity_id and a.status='active';
  if target_property_id is null or not private.is_active_member(target_property_id) then raise exception 'not_authorized'; end if;
  if target_to<=target_from or target_to>target_from+interval '93 days' then raise exception 'invalid_window'; end if;
  perform private.refresh_reservation_states(target_property_id);
  return query
    select r.starts_at,r.ends_at,'occupied'::text from public.reservations r where r.property_id=target_property_id and r.amenity_id=target_amenity_id and r.blocks_slot and r.starts_at<target_to and r.ends_at>target_from
    union all
    select b.starts_at,b.ends_at,'closed'::text from public.amenity_blackouts b where b.property_id=target_property_id and b.amenity_id=target_amenity_id and b.starts_at<target_to and b.ends_at>target_from
    order by 1;
end;
$$;

create or replace function public.create_reservation(target_property_id uuid,target_amenity_id uuid,target_unit_id uuid,target_starts_at timestamp,target_ends_at timestamp,target_attendee_count integer,target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.amenities%rowtype; policy public.property_policies%rowtype; requester_id uuid; property_timezone text; actual_start timestamptz; actual_end timestamptz; initial_status text; hold_until timestamptz; created_id uuid; start_minutes integer; duration_minutes integer;
begin
  select pm.id into requester_id from public.property_members pm
  join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id and um.unit_id=target_unit_id
  where pm.property_id=target_property_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles) and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now()) limit 1;
  if requester_id is null then raise exception 'not_authorized'; end if;
  select * into a from public.amenities where id=target_amenity_id and property_id=target_property_id for update;
  if not found or a.status<>'active' then raise exception 'amenity_unavailable'; end if;
  select timezone into property_timezone from public.properties where id=target_property_id and status='active';
  actual_start:=target_starts_at at time zone property_timezone; actual_end:=target_ends_at at time zone property_timezone;
  if actual_start<now() or actual_end<=actual_start or target_attendee_count not between 1 and a.capacity then raise exception 'invalid_input'; end if;
  if target_starts_at::date<>target_ends_at::date then raise exception 'outside_amenity_hours'; end if;
  start_minutes:=extract(hour from target_starts_at)::integer*60+extract(minute from target_starts_at)::integer;
  duration_minutes:=extract(epoch from (target_ends_at-target_starts_at))::integer/60;
  if mod(start_minutes,a.slot_minutes)<>0 or duration_minutes<=0 or mod(duration_minutes,a.slot_minutes)<>0 then raise exception 'invalid_slot'; end if;
  if not exists(select 1 from public.amenity_hours h where h.property_id=target_property_id and h.amenity_id=a.id and h.weekday=extract(isodow from target_starts_at)::integer and h.opens_at<=target_starts_at::time and h.closes_at>=target_ends_at::time) then raise exception 'outside_amenity_hours'; end if;
  perform private.refresh_reservation_states(target_property_id);
  if exists(select 1 from public.amenity_blackouts b where b.property_id=target_property_id and b.amenity_id=a.id and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(actual_start,actual_end,'[)')) then raise exception 'amenity_closed'; end if;
  if exists(select 1 from public.reservations r where r.property_id=target_property_id and r.amenity_id=a.id and r.blocks_slot and tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(actual_start,actual_end,'[)')) then raise exception 'reservation_conflict'; end if;
  insert into public.property_policies(property_id) values(target_property_id) on conflict do nothing;
  select * into policy from public.property_policies where property_id=target_property_id;
  if policy.restrict_reservations_for_debt then raise exception 'debt_policy_unavailable'; end if;
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

create or replace function public.decide_reservation(target_reservation_id uuid,target_approve boolean,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations%rowtype; clean_reason text:=nullif(trim(target_reason),''); new_status text;
begin
  select * into r from public.reservations where id=target_reservation_id for update;
  if not found or not private.is_active_member(r.property_id,'administrator') then raise exception 'not_authorized'; end if;
  perform private.refresh_reservation_states(r.property_id);
  select * into r from public.reservations where id=target_reservation_id for update;
  if r.status<>'pending' then raise exception 'invalid_transition'; end if;
  if not target_approve and (clean_reason is null or char_length(clean_reason) not between 3 and 500) then raise exception 'reason_required'; end if;
  new_status:=case when target_approve then 'approved' else 'rejected' end;
  update public.reservations set status=new_status,blocks_slot=target_approve,hold_expires_at=null,decision_by=auth.uid(),decision_at=now(),decision_reason=case when target_approve then null else clean_reason end where id=r.id;
  insert into public.activity_events(property_id,reservation_id,actor_id,event_type,previous_state,new_state,description) values(r.property_id,r.id,auth.uid(),case when target_approve then 'reservation_approved' else 'reservation_rejected' end,'pending',new_status,case when target_approve then 'Reserva aprobada' else 'Reserva rechazada: '||clean_reason end);
  perform private.write_property_audit(r.property_id,'reservation.'||new_status,'reservation',r.id,jsonb_build_object('reason',clean_reason));
  perform private.enqueue_reservation_notification(r.id,case when target_approve then 'reservation_approved' else 'reservation_rejected' end,case when target_approve then 'Reserva aprobada' else 'Reserva rechazada' end,case when target_approve then 'La administración aprobó tu reserva.' else 'La administración rechazó tu reserva: '||clean_reason end,new_status);
end;
$$;

create or replace function public.cancel_reservation(target_reservation_id uuid,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations%rowtype; clean_reason text:=trim(target_reason); requester boolean; administrator boolean;
begin
  select * into r from public.reservations where id=target_reservation_id for update;
  if not found then raise exception 'reservation_not_found'; end if;
  requester:=exists(select 1 from public.property_members pm join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id and um.unit_id=r.unit_id where pm.id=r.requester_member_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles) and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now()));
  administrator:=private.is_active_member(r.property_id,'administrator');
  if not requester and not administrator then raise exception 'not_authorized'; end if;
  if r.status not in ('pending','approved') or r.starts_at<=now() or char_length(clean_reason) not between 3 and 500 then raise exception 'invalid_transition'; end if;
  update public.reservations set status='cancelled',blocks_slot=false,hold_expires_at=null,cancelled_at=now(),decision_by=auth.uid(),decision_at=now(),decision_reason=clean_reason where id=r.id;
  insert into public.activity_events(property_id,reservation_id,actor_id,event_type,previous_state,new_state,description) values(r.property_id,r.id,auth.uid(),'reservation_cancelled',r.status,'cancelled','Reserva cancelada: '||clean_reason);
  perform private.write_property_audit(r.property_id,'reservation.cancelled','reservation',r.id,jsonb_build_object('reason',clean_reason));
  perform private.enqueue_reservation_notification(r.id,'reservation_cancelled','Reserva cancelada','La reserva fue cancelada: '||clean_reason,'cancelled');
end;
$$;

create or replace function public.list_operational_reservations(target_property_id uuid,target_from timestamptz,target_to timestamptz)
returns table(reservation_id uuid,amenity_name text,building_name text,unit_code text,requester_name text,attendee_count integer,status text,starts_at timestamptz,ends_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if not (private.is_active_member(target_property_id,'administrator') or private.is_active_member(target_property_id,'concierge')) then raise exception 'not_authorized'; end if;
  perform private.refresh_reservation_states(target_property_id);
  return query select r.id,a.name,b.name,u.code,p.display_name,r.attendee_count,r.status,r.starts_at,r.ends_at
  from public.reservations r join public.amenities a on a.id=r.amenity_id and a.property_id=r.property_id join public.units u on u.id=r.unit_id and u.property_id=r.property_id join public.buildings b on b.id=u.building_id and b.property_id=u.property_id join public.property_members pm on pm.id=r.requester_member_id and pm.property_id=r.property_id join public.profiles p on p.id=pm.user_id
  where r.property_id=target_property_id and r.starts_at<target_to and r.ends_at>target_from order by r.starts_at;
end;
$$;

revoke all on function private.create_default_property_policy(),private.enqueue_reservation_notification(uuid,text,text,text,text),private.refresh_reservation_states(uuid) from public,anon,authenticated;
revoke all on function public.refresh_reservations(uuid),public.save_amenity(uuid,uuid,text,text,integer,boolean,text,integer,text,jsonb),public.update_reservation_policy(uuid,integer),public.create_amenity_blackout(uuid,timestamp,timestamp,text),public.delete_amenity_blackout(uuid),public.get_amenity_availability(uuid,timestamptz,timestamptz),public.create_reservation(uuid,uuid,uuid,timestamp,timestamp,integer,uuid),public.decide_reservation(uuid,boolean,text),public.cancel_reservation(uuid,text),public.list_operational_reservations(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.refresh_reservations(uuid),public.save_amenity(uuid,uuid,text,text,integer,boolean,text,integer,text,jsonb),public.update_reservation_policy(uuid,integer),public.create_amenity_blackout(uuid,timestamp,timestamp,text),public.delete_amenity_blackout(uuid),public.get_amenity_availability(uuid,timestamptz,timestamptz),public.create_reservation(uuid,uuid,uuid,timestamp,timestamp,integer,uuid),public.decide_reservation(uuid,boolean,text),public.cancel_reservation(uuid,text),public.list_operational_reservations(uuid,timestamptz,timestamptz) to authenticated;

notify pgrst, 'reload schema';
