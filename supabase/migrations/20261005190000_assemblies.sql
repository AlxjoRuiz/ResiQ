-- Etapa 14: asambleas privadas, agenda, convocatoria, asistencia y representaciones.

create table public.assemblies (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  type text not null check (type in ('ordinary','extraordinary')),
  title text not null check (char_length(trim(title)) between 4 and 180),
  description text check (description is null or char_length(trim(description)) between 4 and 5000),
  starts_at timestamptz not null,
  location text not null check (char_length(trim(location)) between 3 and 240),
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','finished','cancelled')),
  published_at timestamptz,
  finished_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text check (cancellation_reason is null or char_length(trim(cancellation_reason)) between 4 and 1000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,id),
  check ((status='finished')=(finished_at is not null)),
  check ((status='cancelled')=(cancelled_at is not null and cancellation_reason is not null)),
  check (status in ('scheduled','in_progress') or published_at is not null)
);
create index assemblies_property_start_idx on public.assemblies(property_id,starts_at desc);
create trigger assemblies_set_updated_at before update on public.assemblies for each row execute function private.set_updated_at();

create table public.assembly_agenda (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  assembly_id uuid not null,
  position integer not null check (position between 1 and 100),
  title text not null check (char_length(trim(title)) between 3 and 180),
  description text check (description is null or char_length(trim(description)) between 3 and 1000),
  created_at timestamptz not null default now(),
  unique(property_id,assembly_id,position),
  foreign key(property_id,assembly_id) references public.assemblies(property_id,id) on delete restrict
);

create table public.assembly_attendees (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  assembly_id uuid not null,
  member_id uuid not null,
  unit_id uuid not null,
  rsvp text not null default 'pending' check (rsvp in ('pending','yes','no')),
  responded_at timestamptz,
  attendance_status text not null default 'pending' check (attendance_status in ('pending','present','absent')),
  attendance_recorded_at timestamptz,
  attended_at timestamptz,
  attendance_recorded_by uuid references public.profiles(id) on delete restrict,
  attendance_note text check (attendance_note is null or char_length(trim(attendance_note)) between 4 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,assembly_id,member_id),
  foreign key(property_id,assembly_id) references public.assemblies(property_id,id) on delete restrict,
  foreign key(property_id,member_id) references public.property_members(property_id,id) on delete restrict,
  foreign key(property_id,unit_id) references public.units(property_id,id) on delete restrict,
  check ((rsvp='pending')=(responded_at is null)),
  check ((attendance_status='pending')=(attendance_recorded_at is null and attendance_recorded_by is null)),
  check ((attendance_status='present')=(attended_at is not null))
);
create index assembly_attendees_member_idx on public.assembly_attendees(property_id,member_id,assembly_id);
create trigger assembly_attendees_set_updated_at before update on public.assembly_attendees for each row execute function private.set_updated_at();

create table public.assembly_representations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  assembly_id uuid not null,
  unit_id uuid not null,
  grantor_member_id uuid not null,
  representative_member_id uuid,
  external_representative_name text,
  status text not null default 'submitted' check (status in ('submitted','validated','rejected','revoked')),
  review_note text check (review_note is null or char_length(trim(review_note)) between 4 and 1000),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,id),
  foreign key(property_id,assembly_id) references public.assemblies(property_id,id) on delete restrict,
  foreign key(property_id,unit_id) references public.units(property_id,id) on delete restrict,
  foreign key(property_id,grantor_member_id) references public.property_members(property_id,id) on delete restrict,
  foreign key(property_id,representative_member_id) references public.property_members(property_id,id) on delete restrict,
  check (num_nonnulls(representative_member_id,external_representative_name)=1),
  check (external_representative_name is null or char_length(trim(external_representative_name)) between 3 and 120),
  check ((status='submitted')=(reviewed_at is null and reviewed_by is null and review_note is null)),
  check ((status='submitted') or (reviewed_at is not null and reviewed_by is not null and review_note is not null))
);
create unique index assembly_representations_active_idx on public.assembly_representations(property_id,assembly_id,unit_id,grantor_member_id) where status in ('submitted','validated');
create index assembly_representations_assembly_idx on public.assembly_representations(property_id,assembly_id,status);
create trigger assembly_representations_set_updated_at before update on public.assembly_representations for each row execute function private.set_updated_at();

create or replace function private.can_read_assembly(target_assembly_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.assemblies a
    where a.id=target_assembly_id and (
      private.is_active_member(a.property_id,'administrator') or
      (a.published_at is not null and exists(
        select 1 from public.assembly_attendees aa
        join public.property_members pm on pm.id=aa.member_id and pm.property_id=aa.property_id
        join public.unit_memberships um on um.property_id=aa.property_id and um.member_id=aa.member_id and um.unit_id=aa.unit_id
        where aa.assembly_id=a.id and aa.property_id=a.property_id and pm.user_id=auth.uid() and pm.status='active'
          and 'member'=any(pm.roles) and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
      )) or
      (a.published_at is not null and exists(
        select 1 from public.assembly_representations ar
        join public.property_members pm on pm.id in (ar.grantor_member_id,ar.representative_member_id) and pm.property_id=ar.property_id
        where ar.assembly_id=a.id and ar.property_id=a.property_id and ar.status in ('submitted','validated')
          and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
      ))
    )
  );
$$;

create or replace function private.can_read_assembly_representation(target_representation_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.assembly_representations ar
    where ar.id=target_representation_id and (
      private.is_active_member(ar.property_id,'administrator') or exists(
        select 1 from public.property_members pm
        where pm.property_id=ar.property_id and pm.id in (ar.grantor_member_id,ar.representative_member_id)
          and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
      )
    )
  );
$$;

alter table public.assemblies enable row level security;
alter table public.assembly_agenda enable row level security;
alter table public.assembly_attendees enable row level security;
alter table public.assembly_representations enable row level security;
create policy assemblies_read on public.assemblies for select to authenticated using (private.can_read_assembly(id));
create policy assembly_agenda_read on public.assembly_agenda for select to authenticated using (private.can_read_assembly(assembly_id));
create policy assembly_attendees_read on public.assembly_attendees for select to authenticated using (
  private.is_active_member(property_id,'administrator') or exists(
    select 1 from public.property_members pm where pm.id=member_id and pm.property_id=assembly_attendees.property_id and pm.user_id=auth.uid() and pm.status='active'
  )
);
create policy assembly_representations_read on public.assembly_representations for select to authenticated using (private.can_read_assembly_representation(id));
grant select on public.assemblies,public.assembly_agenda,public.assembly_attendees,public.assembly_representations to authenticated;
revoke all on public.assemblies,public.assembly_agenda,public.assembly_attendees,public.assembly_representations from anon;
revoke insert,update,delete,truncate,references,trigger on public.assemblies,public.assembly_agenda,public.assembly_attendees,public.assembly_representations from authenticated;

alter table public.documents add column assembly_id uuid;
alter table public.documents add column assembly_representation_id uuid;
alter table public.documents add column document_kind text check (document_kind is null or document_kind in ('convocation','support','minutes','representation_evidence'));
alter table public.documents add column version integer not null default 1 check (version between 1 and 1000);
alter table public.documents add foreign key(property_id,assembly_id) references public.assemblies(property_id,id) on delete restrict;
alter table public.documents add foreign key(property_id,assembly_representation_id) references public.assembly_representations(property_id,id) on delete restrict;
alter table public.documents drop constraint documents_one_parent_check;
alter table public.documents add constraint documents_one_parent_check check (num_nonnulls(pqrs_id,pqrs_message_id,attention_call_id,assembly_id,assembly_representation_id)=1);
alter table public.documents add constraint documents_assembly_kind_check check (
  (assembly_representation_id is not null and document_kind='representation_evidence') or
  (assembly_id is not null and document_kind in ('convocation','support','minutes')) or
  (assembly_id is null and assembly_representation_id is null and document_kind is null)
);
create index documents_assembly_idx on public.documents(property_id,assembly_id,document_kind,version) where assembly_id is not null;
create index documents_assembly_representation_idx on public.documents(property_id,assembly_representation_id) where assembly_representation_id is not null;

alter table public.activity_events add column assembly_id uuid;
alter table public.activity_events add foreign key(property_id,assembly_id) references public.assemblies(property_id,id) on delete restrict;
alter table public.activity_events drop constraint activity_events_one_parent_check;
alter table public.activity_events add constraint activity_events_one_parent_check check (num_nonnulls(pqrs_id,package_id,visitor_id,reservation_id,receivable_id,payment_id,attention_call_id,assembly_id)=1);
alter table public.activity_events drop constraint activity_events_event_type_check;
alter table public.activity_events add constraint activity_events_event_type_check check (event_type in ('created','message_added','status_changed','attachment_added','package_received','package_recipient_assigned','package_notified','package_delivered','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','reservation_completed','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice','attention_call_created','attention_call_notified','attention_call_review_started','attention_call_read','attention_call_closed','attention_call_attachment_added','assembly_created','assembly_published','assembly_updated','assembly_rsvp_changed','assembly_attendance_recorded','assembly_representation_submitted','assembly_representation_reviewed','assembly_document_added','assembly_started','assembly_finished','assembly_cancelled'));
create index activity_events_assembly_idx on public.activity_events(property_id,assembly_id,occurred_at,id) where assembly_id is not null;
create policy activity_events_read_assembly on public.activity_events for select to authenticated using (assembly_id is not null and private.can_read_assembly(assembly_id));

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice','attention_call_created','assembly_published','assembly_updated','assembly_cancelled'));
alter table public.notifications drop constraint notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check check (target_type in ('pqrs','package','visitor','reservation','receivable','payment','attention_call','assembly'));
alter table public.email_jobs drop constraint email_jobs_template_key_check;
alter table public.email_jobs add constraint email_jobs_template_key_check check (template_key in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice','attention_call_created','assembly_published','assembly_reminder','assembly_updated','assembly_cancelled'));

drop policy documents_read_parent on public.documents;
create policy documents_read_parent on public.documents for select to authenticated using (
  (status='pending' and uploaded_by=auth.uid()) or (status='available' and (
    (attention_call_id is null and assembly_id is null and assembly_representation_id is null and private.can_read_pqrs(private.pqrs_document_parent(id))) or
    (attention_call_id is not null and private.can_read_attention_call(attention_call_id)) or
    (assembly_id is not null and private.can_read_assembly(assembly_id)) or
    (assembly_representation_id is not null and private.can_read_assembly_representation(assembly_representation_id))
  ))
);

drop policy private_documents_read on storage.objects;
create policy private_documents_read on storage.objects for select to authenticated using (
  bucket_id='private-documents' and exists(
    select 1 from public.documents d where d.bucket=bucket_id and d.object_path=name and (
      (d.status='pending' and d.uploaded_by=auth.uid()) or (d.status='available' and (
        (d.attention_call_id is null and d.assembly_id is null and d.assembly_representation_id is null and private.can_read_pqrs(private.pqrs_document_parent(d.id))) or
        (d.attention_call_id is not null and private.can_read_attention_call(d.attention_call_id)) or
        (d.assembly_id is not null and private.can_read_assembly(d.assembly_id)) or
        (d.assembly_representation_id is not null and private.can_read_assembly_representation(d.assembly_representation_id))
      ))
    )
  )
);

create or replace function public.get_assembly_directory(target_property_id uuid)
returns table(unit_id uuid,unit_code text,building_name text,member_id uuid,display_name text)
language sql stable security definer set search_path='' as $$
  select u.id,u.code,b.name,pm.id,p.display_name
  from public.units u join public.buildings b on b.id=u.building_id and b.property_id=u.property_id
  join public.unit_memberships um on um.unit_id=u.id and um.property_id=u.property_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
  join public.property_members pm on pm.id=um.member_id and pm.property_id=um.property_id and pm.status='active' and 'member'=any(pm.roles)
  join public.profiles p on p.id=pm.user_id
  where u.property_id=target_property_id and u.status='active' and private.is_active_member(target_property_id,'administrator')
  order by b.name,u.code,p.display_name;
$$;

create or replace function public.get_assembly_representative_options(target_assembly_id uuid)
returns table(member_id uuid,display_name text)
language sql stable security definer set search_path='' as $$
  select pm.id,p.display_name
  from public.assemblies a join public.property_members pm on pm.property_id=a.property_id and pm.status='active' and 'member'=any(pm.roles)
  join public.profiles p on p.id=pm.user_id
  where a.id=target_assembly_id and a.published_at is not null and private.can_read_assembly(a.id)
  order by p.display_name;
$$;

create or replace function public.create_assembly(
  target_property_id uuid,target_type text,target_title text,target_description text,target_starts_at timestamptz,
  target_location text,target_agenda jsonb,target_audience jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare created_id uuid; agenda_item jsonb; audience_item jsonb; agenda_position integer:=0; target_member_id uuid; target_unit_id uuid;
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if target_type not in ('ordinary','extraordinary') or char_length(trim(target_title)) not between 4 and 180
    or (nullif(trim(target_description),'') is not null and char_length(trim(target_description)) not between 4 and 5000)
    or target_starts_at<=now() or char_length(trim(target_location)) not between 3 and 240
    or jsonb_typeof(target_agenda)<>'array' or jsonb_array_length(target_agenda) not between 1 and 100
    or jsonb_typeof(target_audience)<>'array' or jsonb_array_length(target_audience) not between 1 and 500
  then raise exception 'invalid_input'; end if;
  insert into public.assemblies(property_id,type,title,description,starts_at,location,created_by)
  values(target_property_id,target_type,trim(target_title),nullif(trim(target_description),''),target_starts_at,trim(target_location),auth.uid()) returning id into created_id;
  for agenda_item in select value from jsonb_array_elements(target_agenda) loop
    agenda_position:=agenda_position+1;
    if char_length(trim(agenda_item->>'title')) not between 3 and 180 then raise exception 'invalid_agenda'; end if;
    insert into public.assembly_agenda(property_id,assembly_id,position,title,description)
    values(target_property_id,created_id,agenda_position,trim(agenda_item->>'title'),nullif(trim(agenda_item->>'description'),''));
  end loop;
  for audience_item in select value from jsonb_array_elements(target_audience) loop
    target_member_id:=(audience_item->>'member_id')::uuid; target_unit_id:=(audience_item->>'unit_id')::uuid;
    if not exists(
      select 1 from public.property_members pm join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id
      where pm.id=target_member_id and pm.property_id=target_property_id and pm.status='active' and 'member'=any(pm.roles)
        and um.unit_id=target_unit_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
    ) then raise exception 'invalid_attendee'; end if;
    insert into public.assembly_attendees(property_id,assembly_id,member_id,unit_id)
    values(target_property_id,created_id,target_member_id,target_unit_id);
  end loop;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,new_state,description)
  values(target_property_id,created_id,auth.uid(),'assembly_created','draft','Borrador de asamblea creado');
  perform private.write_property_audit(target_property_id,'assembly.created','assembly',created_id,jsonb_build_object('type',target_type,'attendee_count',jsonb_array_length(target_audience)));
  return created_id;
exception when unique_violation then raise exception 'duplicate_attendee';
end;
$$;

create or replace function private.enqueue_assembly_message(target_assembly_id uuid,target_type text,target_subject text,target_body text,target_template text,target_suffix text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.assemblies%rowtype; attendee record; notification_id uuid; recipient_email text;
begin
  select * into item from public.assemblies where id=target_assembly_id;
  if not found then raise exception 'assembly_not_found'; end if;
  for attendee in select aa.member_id from public.assembly_attendees aa where aa.assembly_id=item.id and aa.property_id=item.property_id loop
    insert into public.notifications(property_id,recipient_member_id,type,subject,body,target_type,target_id,payload,dedupe_key)
    values(item.property_id,attendee.member_id,target_type,target_subject,target_body,'assembly',item.id,
      jsonb_build_object('assembly_id',item.id,'property_id',item.property_id,'title',item.title,'starts_at',item.starts_at,'location',item.location),
      'assembly:'||item.id||':'||target_suffix||':'||attendee.member_id)
    on conflict(property_id,recipient_member_id,dedupe_key) do nothing returning id into notification_id;
    if notification_id is not null then
      select lower(u.email) into recipient_email from public.property_members pm join auth.users u on u.id=pm.user_id where pm.id=attendee.member_id and pm.status='active';
      if recipient_email is not null then
        insert into public.email_jobs(property_id,notification_id,recipient_email,template_key,template_data,dedupe_key)
        values(item.property_id,notification_id,recipient_email,target_template,
          jsonb_build_object('assembly_id',item.id,'property_id',item.property_id,'title',item.title,'starts_at',item.starts_at,'location',item.location),
          'assembly:'||item.id||':'||target_suffix||':'||attendee.member_id);
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.publish_assembly(target_assembly_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare item public.assemblies%rowtype; attendee record; notification_id uuid; recipient_email text; reminder_time timestamptz; reminder_code text;
begin
  select * into item from public.assemblies where id=target_assembly_id for update;
  if not found or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status<>'scheduled' or item.published_at is not null or item.starts_at<=now()
    or not exists(select 1 from public.assembly_agenda where assembly_id=item.id)
    or not exists(select 1 from public.assembly_attendees where assembly_id=item.id)
  then raise exception 'invalid_publish'; end if;
  update public.assemblies set published_at=now() where id=item.id;
  for attendee in select aa.member_id from public.assembly_attendees aa where aa.assembly_id=item.id loop
    insert into public.notifications(property_id,recipient_member_id,type,subject,body,target_type,target_id,payload,dedupe_key)
    values(item.property_id,attendee.member_id,'assembly_published','Nueva convocatoria de asamblea','La administración publicó una convocatoria dirigida a ti.','assembly',item.id,
      jsonb_build_object('assembly_id',item.id,'property_id',item.property_id,'title',item.title,'starts_at',item.starts_at,'location',item.location),
      'assembly:'||item.id||':published:'||attendee.member_id) returning id into notification_id;
    select lower(u.email) into recipient_email from public.property_members pm join auth.users u on u.id=pm.user_id where pm.id=attendee.member_id and pm.status='active';
    if recipient_email is not null then
      insert into public.email_jobs(property_id,notification_id,recipient_email,template_key,template_data,dedupe_key)
      values(item.property_id,notification_id,recipient_email,'assembly_published',jsonb_build_object('assembly_id',item.id,'property_id',item.property_id,'title',item.title,'starts_at',item.starts_at,'location',item.location),'assembly:'||item.id||':published:'||attendee.member_id);
      for reminder_time,reminder_code in select item.starts_at-interval '7 days','7d' union all select item.starts_at-interval '24 hours','24h' loop
        if reminder_time>now() then
          insert into public.email_jobs(property_id,notification_id,recipient_email,template_key,template_data,dedupe_key,next_attempt_at)
          values(item.property_id,notification_id,recipient_email,'assembly_reminder',jsonb_build_object('assembly_id',item.id,'property_id',item.property_id,'title',item.title,'starts_at',item.starts_at,'location',item.location,'reminder',reminder_code),'assembly:'||item.id||':reminder-'||reminder_code||':'||attendee.member_id,reminder_time);
        end if;
      end loop;
    end if;
  end loop;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,previous_state,new_state,description)
  values(item.property_id,item.id,auth.uid(),'assembly_published','draft','scheduled','Convocatoria publicada');
  perform private.write_property_audit(item.property_id,'assembly.published','assembly',item.id,'{}'::jsonb);
end;
$$;

create or replace function public.update_assembly(
  target_assembly_id uuid,target_title text,target_description text,target_starts_at timestamptz,target_location text
) returns void language plpgsql security definer set search_path='' as $$
declare item public.assemblies%rowtype; significant boolean;
begin
  select * into item from public.assemblies where id=target_assembly_id for update;
  if not found or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status<>'scheduled' or target_starts_at<=now() or char_length(trim(target_title)) not between 4 and 180
    or char_length(trim(target_location)) not between 3 and 240 or (nullif(trim(target_description),'') is not null and char_length(trim(target_description)) not between 4 and 5000)
  then raise exception 'invalid_update'; end if;
  significant:=item.published_at is not null and (item.title<>trim(target_title) or item.starts_at<>target_starts_at or item.location<>trim(target_location));
  update public.assemblies set title=trim(target_title),description=nullif(trim(target_description),''),starts_at=target_starts_at,location=trim(target_location) where id=item.id;
  if significant then
    perform private.enqueue_assembly_message(item.id,'assembly_updated','Cambio en la asamblea','La administración actualizó la fecha, el lugar o el título.','assembly_updated','updated-'||extract(epoch from now())::bigint);
  end if;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,description) values(item.property_id,item.id,auth.uid(),'assembly_updated','Información de la asamblea actualizada');
  perform private.write_property_audit(item.property_id,'assembly.updated','assembly',item.id,jsonb_build_object('significant',significant));
end;
$$;

create or replace function public.change_assembly_status(target_assembly_id uuid,target_status text,target_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare item public.assemblies%rowtype; clean_reason text:=nullif(trim(target_reason),''); event_name text;
begin
  select * into item from public.assemblies where id=target_assembly_id for update;
  if not found or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status='scheduled' and item.published_at is not null and target_status='in_progress' and now()>=item.starts_at-interval '2 hours' then event_name:='assembly_started';
  elsif item.status='in_progress' and target_status='finished' then event_name:='assembly_finished';
  elsif item.status='scheduled' and item.published_at is not null and target_status='cancelled' and clean_reason is not null and char_length(clean_reason) between 4 and 1000 then event_name:='assembly_cancelled';
  else raise exception 'invalid_transition'; end if;
  update public.assemblies set status=target_status,finished_at=case when target_status='finished' then now() else null end,
    cancelled_at=case when target_status='cancelled' then now() else null end,cancellation_reason=case when target_status='cancelled' then clean_reason else null end where id=item.id;
  if target_status='cancelled' then perform private.enqueue_assembly_message(item.id,'assembly_cancelled','Asamblea cancelada',clean_reason,'assembly_cancelled','cancelled'); end if;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,previous_state,new_state,description)
  values(item.property_id,item.id,auth.uid(),event_name,item.status,target_status,coalesce(clean_reason,'Estado actualizado'));
  perform private.write_property_audit(item.property_id,'assembly.status_changed','assembly',item.id,jsonb_build_object('previous_status',item.status,'status',target_status));
end;
$$;

create or replace function public.set_assembly_rsvp(target_assembly_id uuid,target_rsvp text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.assemblies%rowtype; attendee public.assembly_attendees%rowtype;
begin
  select * into item from public.assemblies where id=target_assembly_id;
  select aa.* into attendee from public.assembly_attendees aa join public.property_members pm on pm.id=aa.member_id and pm.property_id=aa.property_id
  where aa.assembly_id=target_assembly_id and pm.user_id=auth.uid() and pm.status='active';
  if not found or item.published_at is null or item.status<>'scheduled' or now()>=item.starts_at or target_rsvp not in ('yes','no') then raise exception 'not_authorized'; end if;
  update public.assembly_attendees set rsvp=target_rsvp,responded_at=now() where id=attendee.id;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,previous_state,new_state,description)
  values(item.property_id,item.id,auth.uid(),'assembly_rsvp_changed',attendee.rsvp,target_rsvp,'Respuesta de asistencia actualizada');
  perform private.write_property_audit(item.property_id,'assembly.rsvp_changed','assembly',item.id,jsonb_build_object('attendee_id',attendee.id,'rsvp',target_rsvp));
end;
$$;

create or replace function public.record_assembly_attendance(target_attendee_id uuid,target_attended boolean,target_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare attendee public.assembly_attendees%rowtype; item public.assemblies%rowtype; clean_note text:=nullif(trim(target_note),''); correcting boolean;
begin
  select * into attendee from public.assembly_attendees where id=target_attendee_id for update;
  select * into item from public.assemblies where id=attendee.assembly_id;
  if attendee.id is null or not private.is_active_member(attendee.property_id,'administrator') or item.status not in ('in_progress','finished') then raise exception 'not_authorized'; end if;
  correcting:=attendee.attendance_status<>'pending';
  if correcting and (clean_note is null or char_length(clean_note) not between 4 and 1000) then raise exception 'correction_note_required'; end if;
  update public.assembly_attendees set attendance_status=case when target_attended then 'present' else 'absent' end,
    attendance_recorded_at=now(),attended_at=case when target_attended then now() else null end,
    attendance_recorded_by=auth.uid(),attendance_note=clean_note where id=attendee.id;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,previous_state,new_state,description)
  values(item.property_id,item.id,auth.uid(),'assembly_attendance_recorded',attendee.attendance_status,case when target_attended then 'present' else 'absent' end,coalesce(clean_note,'Asistencia registrada'));
  perform private.write_property_audit(item.property_id,'assembly.attendance_recorded','assembly_attendee',attendee.id,jsonb_build_object('attended',target_attended,'correction',correcting));
end;
$$;

create or replace function public.submit_assembly_representation(
  target_assembly_id uuid,target_unit_id uuid,target_representative_member_id uuid default null,target_external_name text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare item public.assemblies%rowtype; grantor_id uuid; created_id uuid; clean_external text:=nullif(trim(target_external_name),'');
begin
  select * into item from public.assemblies where id=target_assembly_id;
  select pm.id into grantor_id from public.property_members pm join public.unit_memberships um on um.member_id=pm.id and um.property_id=pm.property_id
  where pm.property_id=item.property_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
    and um.unit_id=target_unit_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now());
  if item.id is null or item.published_at is null or item.status<>'scheduled' or now()>=item.starts_at or grantor_id is null
    or num_nonnulls(target_representative_member_id,clean_external)<>1 then raise exception 'not_authorized'; end if;
  if target_representative_member_id is not null and (target_representative_member_id=grantor_id or not exists(
    select 1 from public.property_members pm where pm.id=target_representative_member_id and pm.property_id=item.property_id and pm.status='active' and 'member'=any(pm.roles)
  )) then raise exception 'invalid_representative'; end if;
  insert into public.assembly_representations(property_id,assembly_id,unit_id,grantor_member_id,representative_member_id,external_representative_name)
  values(item.property_id,item.id,target_unit_id,grantor_id,target_representative_member_id,clean_external) returning id into created_id;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,new_state,description)
  values(item.property_id,item.id,auth.uid(),'assembly_representation_submitted','submitted','Representación registrada; falta adjuntar evidencia');
  perform private.write_property_audit(item.property_id,'assembly.representation_submitted','assembly_representation',created_id,jsonb_build_object('unit_id',target_unit_id));
  return created_id;
exception when unique_violation then raise exception 'active_representation_exists';
end;
$$;

create or replace function public.review_assembly_representation(target_representation_id uuid,target_status text,target_note text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.assembly_representations%rowtype; clean_note text:=nullif(trim(target_note),'');
begin
  select * into item from public.assembly_representations where id=target_representation_id for update;
  if not found or not private.is_active_member(item.property_id,'administrator') or target_status not in ('validated','rejected','revoked')
    or clean_note is null or char_length(clean_note) not between 4 and 1000 or (target_status in ('validated','rejected') and item.status<>'submitted')
    or (target_status='revoked' and item.status<>'validated') then raise exception 'invalid_review'; end if;
  if target_status='validated' and not exists(select 1 from public.documents where assembly_representation_id=item.id and status='available') then raise exception 'evidence_required'; end if;
  update public.assembly_representations set status=target_status,review_note=clean_note,reviewed_by=auth.uid(),reviewed_at=now() where id=item.id;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,previous_state,new_state,description)
  values(item.property_id,item.assembly_id,auth.uid(),'assembly_representation_reviewed',item.status,target_status,clean_note);
  perform private.write_property_audit(item.property_id,'assembly.representation_reviewed','assembly_representation',item.id,jsonb_build_object('status',target_status));
end;
$$;

create or replace function public.prepare_assembly_document(
  target_assembly_id uuid,target_representation_id uuid,target_document_kind text,target_original_name text,target_mime_type text,target_size_bytes bigint
) returns table(document_id uuid,object_path text) language plpgsql security definer set search_path='' as $$
declare item public.assemblies%rowtype; representation public.assembly_representations%rowtype; generated_id uuid:=gen_random_uuid(); extension text; next_version integer; allowed boolean:=false;
begin
  select * into item from public.assemblies where id=target_assembly_id;
  if item.id is null then raise exception 'not_authorized'; end if;
  if target_representation_id is null then
    allowed:=private.is_active_member(item.property_id,'administrator') and target_document_kind in ('convocation','support','minutes') and item.status<>'cancelled';
  else
    select * into representation from public.assembly_representations where id=target_representation_id and assembly_id=item.id;
    allowed:=representation.id is not null and representation.status='submitted' and (private.is_active_member(item.property_id,'administrator') or exists(
      select 1 from public.property_members pm where pm.id=representation.grantor_member_id and pm.user_id=auth.uid() and pm.status='active'
    )) and target_document_kind='representation_evidence';
  end if;
  if not allowed then raise exception 'not_authorized'; end if;
  if char_length(trim(target_original_name)) not between 1 and 180 or target_mime_type not in ('application/pdf','image/jpeg','image/png') or target_size_bytes not between 1 and 10485760 then raise exception 'invalid_file'; end if;
  if target_representation_id is not null and (select count(*) from public.documents where assembly_representation_id=target_representation_id and status in ('pending','available'))>=5 then raise exception 'file_limit'; end if;
  select coalesce(max(d.version),0)+1 into next_version from public.documents d where d.assembly_id=target_assembly_id and d.document_kind=target_document_kind;
  extension:=case target_mime_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' else 'png' end;
  document_id:=generated_id;
  object_path:=item.property_id||'/assemblies/'||item.id||'/'||coalesce(target_representation_id::text,target_document_kind)||'/'||generated_id||'.'||extension;
  insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,assembly_id,assembly_representation_id,document_kind,version)
  values(generated_id,item.property_id,object_path,trim(target_original_name),target_mime_type,target_size_bytes,auth.uid(),case when target_representation_id is null then item.id else null end,target_representation_id,target_document_kind,next_version);
  return next;
end;
$$;

create or replace function public.complete_assembly_document(target_document_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare d public.documents%rowtype; parent_assembly_id uuid;
begin
  select * into d from public.documents where id=target_document_id for update;
  if not found or d.status<>'pending' or d.uploaded_by<>auth.uid() or (d.assembly_id is null and d.assembly_representation_id is null) then raise exception 'not_authorized'; end if;
  if d.assembly_id is not null then
    if not private.is_active_member(d.property_id,'administrator') then raise exception 'not_authorized'; end if; parent_assembly_id:=d.assembly_id;
  else
    select ar.assembly_id into parent_assembly_id from public.assembly_representations ar where ar.id=d.assembly_representation_id and ar.status='submitted' and (private.is_active_member(ar.property_id,'administrator') or exists(select 1 from public.property_members pm where pm.id=ar.grantor_member_id and pm.user_id=auth.uid() and pm.status='active'));
    if parent_assembly_id is null then raise exception 'not_authorized'; end if;
  end if;
  if not exists(select 1 from storage.objects o where o.bucket_id=d.bucket and o.name=d.object_path) then raise exception 'file_missing'; end if;
  update public.documents set status='available' where id=d.id;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,description) values(d.property_id,parent_assembly_id,auth.uid(),'assembly_document_added','Documento privado añadido');
  perform private.write_property_audit(d.property_id,'assembly.document_added','document',d.id,jsonb_build_object('assembly_id',parent_assembly_id,'kind',d.document_kind,'version',d.version));
end;
$$;

create or replace function public.reject_assembly_document(target_document_id uuid,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.documents set status='rejected',rejection_reason=left(coalesce(target_reason,'validation_failed'),80)
  where id=target_document_id and (assembly_id is not null or assembly_representation_id is not null) and uploaded_by=auth.uid() and status='pending';
  if not found then raise exception 'not_authorized'; end if;
end;
$$;

revoke all on function private.can_read_assembly(uuid),private.can_read_assembly_representation(uuid),private.enqueue_assembly_message(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function private.can_read_assembly(uuid),private.can_read_assembly_representation(uuid) to authenticated;
revoke all on function public.get_assembly_directory(uuid),public.get_assembly_representative_options(uuid),public.create_assembly(uuid,text,text,text,timestamptz,text,jsonb,jsonb),public.publish_assembly(uuid),public.update_assembly(uuid,text,text,timestamptz,text),public.change_assembly_status(uuid,text,text),public.set_assembly_rsvp(uuid,text),public.record_assembly_attendance(uuid,boolean,text),public.submit_assembly_representation(uuid,uuid,uuid,text),public.review_assembly_representation(uuid,text,text),public.prepare_assembly_document(uuid,uuid,text,text,text,bigint),public.complete_assembly_document(uuid),public.reject_assembly_document(uuid,text) from public,anon;
grant execute on function public.get_assembly_directory(uuid),public.get_assembly_representative_options(uuid),public.create_assembly(uuid,text,text,text,timestamptz,text,jsonb,jsonb),public.publish_assembly(uuid),public.update_assembly(uuid,text,text,timestamptz,text),public.change_assembly_status(uuid,text,text),public.set_assembly_rsvp(uuid,text),public.record_assembly_attendance(uuid,boolean,text),public.submit_assembly_representation(uuid,uuid,uuid,text),public.review_assembly_representation(uuid,text,text),public.prepare_assembly_document(uuid,uuid,text,text,text,bigint),public.complete_assembly_document(uuid),public.reject_assembly_document(uuid,text) to authenticated;

notify pgrst, 'reload schema';
