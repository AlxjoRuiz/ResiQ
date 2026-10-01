-- Etapa 10: autorizaciones de visitas, mantenimiento, ingresos y salidas.

create table public.visitors (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid not null,
  host_member_id uuid not null,
  visitor_name text not null check (char_length(trim(visitor_name)) between 2 and 120),
  document_last_digits text check (document_last_digits is null or document_last_digits ~ '^[0-9]{2,6}$'),
  kind text not null check (kind in ('personal','maintenance')),
  company text check (company is null or char_length(company) between 2 and 120),
  service_type text check (service_type is null or char_length(service_type) between 2 and 120),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  people_count integer not null default 1 check (people_count between 1 and 20),
  notes text check (notes is null or char_length(notes) <= 1000),
  authorization_source text not null check (authorization_source in ('resident_self','concierge_confirmed','administration')),
  authorization_note text check (authorization_note is null or char_length(authorization_note) between 5 and 500),
  status text not null default 'authorized' check (status in ('authorized','entered','exited','cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,id),
  foreign key(property_id,unit_id) references public.units(property_id,id) on delete restrict,
  foreign key(property_id,host_member_id) references public.property_members(property_id,id) on delete restrict,
  check (scheduled_end>scheduled_start and scheduled_end<=scheduled_start+interval '24 hours'),
  check ((authorization_source='resident_self' and authorization_note is null) or (authorization_source<>'resident_self' and authorization_note is not null))
);
create index visitors_property_schedule_idx on public.visitors(property_id,scheduled_start,status);
create index visitors_unit_schedule_idx on public.visitors(property_id,unit_id,scheduled_start);
create index visitors_host_idx on public.visitors(property_id,host_member_id,created_at desc);
create trigger visitors_set_updated_at before update on public.visitors for each row execute function private.set_updated_at();

create table public.visitor_entries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  visitor_id uuid not null,
  entered_at timestamptz not null default now(),
  entered_by uuid not null references public.profiles(id) on delete restrict,
  exited_at timestamptz,
  exited_by uuid references public.profiles(id) on delete restrict,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  unique(property_id,id),
  foreign key(property_id,visitor_id) references public.visitors(property_id,id) on delete restrict,
  check ((exited_at is null and exited_by is null) or (exited_at is not null and exited_by is not null and exited_at>=entered_at))
);
create index visitor_entries_history_idx on public.visitor_entries(property_id,visitor_id,entered_at desc);
create unique index visitor_entries_one_open_idx on public.visitor_entries(property_id,visitor_id) where exited_at is null;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled'));
alter table public.notifications drop constraint notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check check (target_type in ('pqrs','package','visitor'));
alter table public.email_jobs drop constraint email_jobs_template_key_check;
alter table public.email_jobs add constraint email_jobs_template_key_check check (template_key in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled'));

alter table public.activity_events add column visitor_id uuid;
alter table public.activity_events add foreign key(property_id,visitor_id) references public.visitors(property_id,id) on delete restrict;
alter table public.activity_events drop constraint activity_events_one_parent_check;
alter table public.activity_events add constraint activity_events_one_parent_check check (num_nonnulls(pqrs_id,package_id,visitor_id)=1);
alter table public.activity_events drop constraint activity_events_event_type_check;
alter table public.activity_events add constraint activity_events_event_type_check check (event_type in ('created','message_added','status_changed','attachment_added','package_received','package_recipient_assigned','package_notified','package_delivered','visit_authorized','visit_entered','visit_exited','visit_cancelled'));
create index activity_events_visitor_idx on public.activity_events(property_id,visitor_id,occurred_at,id) where visitor_id is not null;

create or replace function private.can_read_visitor(target_visitor_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.visitors v
    where v.id=target_visitor_id and (
      private.is_active_member(v.property_id,'administrator')
      or private.is_active_member(v.property_id,'concierge')
      or exists (
        select 1 from public.property_members pm
        join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id and um.unit_id=v.unit_id
        where pm.id=v.host_member_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
          and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
      )
    )
  );
$$;

alter table public.visitors enable row level security;
alter table public.visitor_entries enable row level security;
create policy visitors_read_authorized on public.visitors for select to authenticated using (private.can_read_visitor(id));
create policy visitor_entries_read_authorized on public.visitor_entries for select to authenticated using (private.can_read_visitor(visitor_id));
create policy activity_events_read_visitor on public.activity_events for select to authenticated using (visitor_id is not null and private.can_read_visitor(visitor_id));
grant select on public.visitors,public.visitor_entries to authenticated;
revoke all on function private.can_read_visitor(uuid) from public;
grant execute on function private.can_read_visitor(uuid) to authenticated;

create or replace function private.enqueue_visit_notification(target_visitor_id uuid,target_type text,target_subject text,target_body text,target_suffix text)
returns void language plpgsql security definer set search_path='' as $$
declare v public.visitors%rowtype; notification_id uuid; recipient_email text;
begin
  select * into v from public.visitors where id=target_visitor_id;
  if not found then raise exception 'visitor_not_found'; end if;
  insert into public.notifications(property_id,recipient_member_id,type,subject,body,target_type,target_id,dedupe_key)
  values(v.property_id,v.host_member_id,target_type,target_subject,target_body,'visitor',v.id,'visit:'||v.id||':'||target_suffix)
  on conflict(property_id,recipient_member_id,dedupe_key) do nothing returning id into notification_id;
  if notification_id is null then return; end if;
  select lower(au.email) into recipient_email from public.property_members pm join auth.users au on au.id=pm.user_id where pm.id=v.host_member_id and pm.status='active';
  if recipient_email is not null then
    insert into public.email_jobs(property_id,notification_id,recipient_email,template_key,template_data,dedupe_key)
    values(v.property_id,notification_id,recipient_email,target_type,jsonb_build_object('property_id',v.property_id,'visitor_id',v.id,'visitor_name',v.visitor_name,'kind',v.kind,'scheduled_start',v.scheduled_start), 'visit:'||v.id||':'||target_suffix);
  end if;
end;
$$;

create or replace function public.create_visit(
  target_property_id uuid,target_unit_id uuid,target_host_member_id uuid,target_visitor_name text,target_document_last_digits text,
  target_kind text,target_company text,target_service_type text,target_scheduled_start timestamptz,target_scheduled_end timestamptz,
  target_people_count integer,target_notes text,target_authorization_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare caller_member_id uuid; resolved_host_id uuid; created_id uuid; source text; clean_auth_note text:=nullif(trim(target_authorization_note),''); is_admin boolean; is_concierge boolean;
begin
  select pm.id into caller_member_id from public.property_members pm where pm.property_id=target_property_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles) limit 1;
  is_admin:=private.is_active_member(target_property_id,'administrator');
  is_concierge:=private.is_active_member(target_property_id,'concierge');
  if caller_member_id is null and not is_admin and not is_concierge then raise exception 'not_authorized'; end if;
  resolved_host_id:=coalesce(target_host_member_id,caller_member_id);
  if resolved_host_id is null then raise exception 'invalid_host'; end if;
  if caller_member_id=resolved_host_id then source:='resident_self'; clean_auth_note:=null;
  elsif is_admin then source:='administration';
  elsif is_concierge then source:='concierge_confirmed';
  else raise exception 'not_authorized'; end if;
  if source<>'resident_self' and (clean_auth_note is null or char_length(clean_auth_note) not between 5 and 500) then raise exception 'authorization_evidence_required'; end if;
  if not exists(select 1 from public.units u where u.id=target_unit_id and u.property_id=target_property_id and u.status='active') then raise exception 'invalid_unit'; end if;
  if not exists(select 1 from public.property_members pm join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id where pm.id=resolved_host_id and pm.property_id=target_property_id and pm.status='active' and 'member'=any(pm.roles) and um.unit_id=target_unit_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())) then raise exception 'invalid_host'; end if;
  if char_length(trim(target_visitor_name)) not between 2 and 120 or target_kind not in ('personal','maintenance') or target_people_count not between 1 and 20 then raise exception 'invalid_input'; end if;
  if target_document_last_digits is not null and nullif(trim(target_document_last_digits),'') is not null and trim(target_document_last_digits) !~ '^[0-9]{2,6}$' then raise exception 'invalid_document'; end if;
  if target_kind='maintenance' and (nullif(trim(target_service_type),'') is null or char_length(trim(target_service_type))>120) then raise exception 'service_required'; end if;
  if target_scheduled_start<now()-interval '15 minutes' or target_scheduled_end<=target_scheduled_start or target_scheduled_end>target_scheduled_start+interval '24 hours' then raise exception 'invalid_window'; end if;
  insert into public.visitors(property_id,unit_id,host_member_id,visitor_name,document_last_digits,kind,company,service_type,scheduled_start,scheduled_end,people_count,notes,authorization_source,authorization_note,created_by)
  values(target_property_id,target_unit_id,resolved_host_id,trim(target_visitor_name),nullif(trim(target_document_last_digits),''),target_kind,nullif(trim(target_company),''),case when target_kind='maintenance' then nullif(trim(target_service_type),'') else null end,target_scheduled_start,target_scheduled_end,target_people_count,nullif(trim(target_notes),''),source,clean_auth_note,auth.uid()) returning id into created_id;
  insert into public.activity_events(property_id,visitor_id,actor_id,event_type,new_state,description) values(target_property_id,created_id,auth.uid(),'visit_authorized','authorized','Visita autorizada');
  perform private.write_property_audit(target_property_id,'visit.authorized','visitor',created_id,jsonb_build_object('unit_id',target_unit_id,'authorization_source',source));
  perform private.enqueue_visit_notification(created_id,'visit_authorized','Visita autorizada','Se registró una visita para tu apartamento.','authorized');
  return created_id;
end;
$$;

create or replace function public.cancel_visit(target_visitor_id uuid,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v public.visitors%rowtype; reason text:=trim(target_reason); caller_host boolean;
begin
  select * into v from public.visitors where id=target_visitor_id for update;
  if not found then raise exception 'visitor_not_found'; end if;
  caller_host:=exists(select 1 from public.property_members pm join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id and um.unit_id=v.unit_id where pm.id=v.host_member_id and pm.user_id=auth.uid() and pm.status='active' and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now()));
  if not caller_host and not private.is_active_member(v.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if v.status<>'authorized' or char_length(reason) not between 3 and 500 then raise exception 'invalid_transition'; end if;
  update public.visitors set status='cancelled' where id=v.id;
  insert into public.activity_events(property_id,visitor_id,actor_id,event_type,previous_state,new_state,description) values(v.property_id,v.id,auth.uid(),'visit_cancelled','authorized','cancelled','Cancelada: '||reason);
  perform private.write_property_audit(v.property_id,'visit.cancelled','visitor',v.id,jsonb_build_object('reason',reason));
  perform private.enqueue_visit_notification(v.id,'visit_cancelled','Visita cancelada','La autorización de visita fue cancelada.','cancelled');
end;
$$;

create or replace function public.register_visit_entry(target_visitor_id uuid,target_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.visitors%rowtype; entry_id uuid;
begin
  select * into v from public.visitors where id=target_visitor_id for update;
  if not found or not (private.is_active_member(v.property_id,'administrator') or private.is_active_member(v.property_id,'concierge')) then raise exception 'not_authorized'; end if;
  if v.status<>'authorized' then raise exception 'invalid_transition'; end if;
  if now()<v.scheduled_start or now()>v.scheduled_end then raise exception 'outside_authorized_window'; end if;
  insert into public.visitor_entries(property_id,visitor_id,entered_by,notes) values(v.property_id,v.id,auth.uid(),nullif(trim(target_notes),'')) returning id into entry_id;
  update public.visitors set status='entered' where id=v.id;
  insert into public.activity_events(property_id,visitor_id,actor_id,event_type,previous_state,new_state,description) values(v.property_id,v.id,auth.uid(),'visit_entered','authorized','entered','Ingreso registrado');
  perform private.write_property_audit(v.property_id,'visit.entered','visitor',v.id,jsonb_build_object('entry_id',entry_id));
  perform private.enqueue_visit_notification(v.id,'visit_entered','Tu visita ingresó','Portería registró el ingreso de tu visita.','entered');
  return entry_id;
end;
$$;

create or replace function public.register_visit_exit(target_visitor_id uuid,target_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare v public.visitors%rowtype; entry_id uuid;
begin
  select * into v from public.visitors where id=target_visitor_id for update;
  if not found or not (private.is_active_member(v.property_id,'administrator') or private.is_active_member(v.property_id,'concierge')) then raise exception 'not_authorized'; end if;
  if v.status<>'entered' then raise exception 'invalid_transition'; end if;
  select e.id into entry_id from public.visitor_entries e where e.property_id=v.property_id and e.visitor_id=v.id and e.exited_at is null for update;
  if entry_id is null then raise exception 'open_entry_not_found'; end if;
  update public.visitor_entries set exited_at=now(),exited_by=auth.uid(),notes=coalesce(nullif(trim(target_notes),''),notes) where id=entry_id;
  update public.visitors set status='exited' where id=v.id;
  insert into public.activity_events(property_id,visitor_id,actor_id,event_type,previous_state,new_state,description) values(v.property_id,v.id,auth.uid(),'visit_exited','entered','exited','Salida registrada');
  perform private.write_property_audit(v.property_id,'visit.exited','visitor',v.id,jsonb_build_object('entry_id',entry_id));
  perform private.enqueue_visit_notification(v.id,'visit_exited','Tu visita salió','Portería registró la salida de tu visita.','exited');
end;
$$;

revoke all on function private.enqueue_visit_notification(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.create_visit(uuid,uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,integer,text,text),public.cancel_visit(uuid,text),public.register_visit_entry(uuid,text),public.register_visit_exit(uuid,text) from public,anon;
grant execute on function public.create_visit(uuid,uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,integer,text,text),public.cancel_visit(uuid,text),public.register_visit_entry(uuid,text),public.register_visit_exit(uuid,text) to authenticated;
