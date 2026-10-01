-- Etapa 9: recepción, notificación y entrega privada de paquetes.

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid not null,
  recipient_member_id uuid,
  recipient_name text not null check (char_length(trim(recipient_name)) between 2 and 120),
  carrier text check (carrier is null or char_length(carrier) between 2 and 100),
  tracking_number text check (tracking_number is null or char_length(tracking_number) between 2 and 100),
  sender_name text check (sender_name is null or char_length(sender_name) between 2 and 120),
  origin text check (origin is null or char_length(origin) between 2 and 120),
  description text not null check (char_length(trim(description)) between 3 and 500),
  notes text check (notes is null or char_length(notes) <= 1000),
  status text not null default 'received' check (status in ('received','notified','delivered')),
  received_at timestamptz not null default now(),
  received_by uuid not null references public.profiles(id) on delete restrict,
  notified_at timestamptz,
  delivered_at timestamptz,
  delivered_by uuid references public.profiles(id) on delete restrict,
  collected_by_name text check (collected_by_name is null or char_length(collected_by_name) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,id),
  foreign key(property_id,unit_id) references public.units(property_id,id) on delete restrict,
  foreign key(property_id,recipient_member_id) references public.property_members(property_id,id) on delete restrict,
  check (status<>'notified' or notified_at is not null),
  check ((status='delivered')=(delivered_at is not null and delivered_by is not null and collected_by_name is not null)),
  check (delivered_at is null or delivered_at>=received_at)
);
create index packages_property_status_received_idx on public.packages(property_id,status,received_at desc);
create index packages_unit_status_idx on public.packages(property_id,unit_id,status);
create index packages_recipient_created_idx on public.packages(property_id,recipient_member_id,created_at desc) where recipient_member_id is not null;
create trigger packages_set_updated_at before update on public.packages for each row execute function private.set_updated_at();

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('pqrs_created','pqrs_updated','package_received'));
alter table public.notifications drop constraint notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check check (target_type in ('pqrs','package'));
alter table public.email_jobs drop constraint email_jobs_template_key_check;
alter table public.email_jobs add constraint email_jobs_template_key_check check (template_key in ('pqrs_created','pqrs_updated','package_received'));

alter table public.activity_events add column package_id uuid;
alter table public.activity_events alter column pqrs_id drop not null;
alter table public.activity_events add foreign key(property_id,package_id) references public.packages(property_id,id) on delete restrict;
alter table public.activity_events add constraint activity_events_one_parent_check check (num_nonnulls(pqrs_id,package_id)=1);
alter table public.activity_events drop constraint activity_events_event_type_check;
alter table public.activity_events add constraint activity_events_event_type_check check (event_type in ('created','message_added','status_changed','attachment_added','package_received','package_recipient_assigned','package_notified','package_delivered'));
create index activity_events_package_idx on public.activity_events(property_id,package_id,occurred_at,id) where package_id is not null;

create or replace function private.can_read_package(target_package_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.packages p
    where p.id=target_package_id and (
      private.is_active_member(p.property_id,'administrator')
      or private.is_active_member(p.property_id,'concierge')
      or exists (
        select 1 from public.property_members pm
        join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id and um.unit_id=p.unit_id
        where pm.id=p.recipient_member_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
          and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
      )
    )
  );
$$;

alter table public.packages enable row level security;
create policy packages_read_authorized on public.packages for select to authenticated using (private.can_read_package(id));
create policy activity_events_read_package on public.activity_events for select to authenticated using (package_id is not null and private.can_read_package(package_id));
grant select on public.packages to authenticated;
revoke all on function private.can_read_package(uuid) from public;
grant execute on function private.can_read_package(uuid) to authenticated;

create or replace function public.get_package_registration_directory(target_property_id uuid)
returns table(unit_id uuid,unit_code text,building_name text,member_id uuid,display_name text)
language sql stable security definer set search_path='' as $$
  select u.id,u.code,b.name,pm.id,pr.display_name
  from public.units u join public.buildings b on b.id=u.building_id and b.property_id=u.property_id
  left join public.unit_memberships um on um.property_id=u.property_id and um.unit_id=u.id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
  left join public.property_members pm on pm.id=um.member_id and pm.property_id=um.property_id and pm.status='active' and 'member'=any(pm.roles)
  left join public.profiles pr on pr.id=pm.user_id
  where u.property_id=target_property_id and u.status='active' and b.active
    and (private.is_active_member(target_property_id,'administrator') or private.is_active_member(target_property_id,'concierge'))
  order by b.name,u.code,pr.display_name;
$$;

create or replace function private.enqueue_package_notification(target_package_id uuid,target_member_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p public.packages%rowtype; notification_id uuid; recipient_email text;
begin
  select * into p from public.packages where id=target_package_id;
  if not found then raise exception 'package_not_found'; end if;
  insert into public.notifications(property_id,recipient_member_id,type,subject,body,target_type,target_id,dedupe_key)
  values(p.property_id,target_member_id,'package_received','Paquete recibido','Portería registró un paquete para ti.','package',p.id,'package-received:'||p.id||':'||target_member_id)
  on conflict(property_id,recipient_member_id,dedupe_key) do nothing returning id into notification_id;
  if notification_id is null then return; end if;
  select lower(au.email) into recipient_email from public.property_members pm join auth.users au on au.id=pm.user_id where pm.id=target_member_id and pm.status='active';
  if recipient_email is not null then
    insert into public.email_jobs(property_id,notification_id,recipient_email,template_key,template_data,dedupe_key)
    values(p.property_id,notification_id,recipient_email,'package_received',jsonb_build_object('property_id',p.property_id,'package_id',p.id,'recipient_name',p.recipient_name,'carrier',p.carrier),'package-received:'||p.id||':'||target_member_id);
  end if;
end;
$$;

create or replace function public.register_package(
  target_property_id uuid,target_unit_id uuid,target_recipient_member_id uuid,target_recipient_name text,
  target_carrier text,target_tracking_number text,target_sender_name text,target_origin text,target_description text,target_notes text
) returns uuid language plpgsql security definer set search_path='' as $$
declare created_id uuid; clean_recipient text; clean_carrier text; clean_tracking text; clean_sender text; clean_origin text; clean_notes text;
begin
  if not (private.is_active_member(target_property_id,'administrator') or private.is_active_member(target_property_id,'concierge')) then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.units u where u.id=target_unit_id and u.property_id=target_property_id and u.status='active') then raise exception 'invalid_unit'; end if;
  clean_recipient:=nullif(trim(target_recipient_name),''); clean_carrier:=nullif(trim(target_carrier),''); clean_tracking:=nullif(trim(target_tracking_number),''); clean_sender:=nullif(trim(target_sender_name),''); clean_origin:=nullif(trim(target_origin),''); clean_notes:=nullif(trim(target_notes),'');
  if target_recipient_member_id is not null then
    select pr.display_name into clean_recipient from public.property_members pm join public.profiles pr on pr.id=pm.user_id join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id
    where pm.id=target_recipient_member_id and pm.property_id=target_property_id and pm.status='active' and 'member'=any(pm.roles) and um.unit_id=target_unit_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now());
    if clean_recipient is null then raise exception 'invalid_recipient'; end if;
  end if;
  if clean_recipient is null or char_length(clean_recipient) not between 2 and 120 or char_length(trim(target_description)) not between 3 and 500 then raise exception 'invalid_input'; end if;
  if coalesce(char_length(clean_carrier),2) not between 2 and 100 or coalesce(char_length(clean_tracking),2) not between 2 and 100 or coalesce(char_length(clean_sender),2) not between 2 and 120 or coalesce(char_length(clean_origin),2) not between 2 and 120 or coalesce(char_length(clean_notes),0)>1000 then raise exception 'invalid_input'; end if;
  insert into public.packages(property_id,unit_id,recipient_member_id,recipient_name,carrier,tracking_number,sender_name,origin,description,notes,received_by)
  values(target_property_id,target_unit_id,target_recipient_member_id,clean_recipient,clean_carrier,clean_tracking,clean_sender,clean_origin,trim(target_description),clean_notes,auth.uid()) returning id into created_id;
  insert into public.activity_events(property_id,package_id,actor_id,event_type,new_state,description) values(target_property_id,created_id,auth.uid(),'package_received','received','Paquete recibido en portería');
  perform private.write_property_audit(target_property_id,'package.received','package',created_id,jsonb_build_object('unit_id',target_unit_id));
  if target_recipient_member_id is not null then perform private.enqueue_package_notification(created_id,target_recipient_member_id); end if;
  return created_id;
end;
$$;

create or replace function public.assign_package_recipient(target_package_id uuid,target_member_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p public.packages%rowtype; resolved_name text;
begin
  select * into p from public.packages where id=target_package_id for update;
  if not found or not (private.is_active_member(p.property_id,'administrator') or private.is_active_member(p.property_id,'concierge')) then raise exception 'not_authorized'; end if;
  if p.status='delivered' or p.recipient_member_id is not null then raise exception 'invalid_transition'; end if;
  select pr.display_name into resolved_name from public.property_members pm join public.profiles pr on pr.id=pm.user_id join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id
  where pm.id=target_member_id and pm.property_id=p.property_id and pm.status='active' and 'member'=any(pm.roles) and um.unit_id=p.unit_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now());
  if resolved_name is null then raise exception 'invalid_recipient'; end if;
  update public.packages set recipient_member_id=target_member_id,recipient_name=resolved_name where id=p.id;
  insert into public.activity_events(property_id,package_id,actor_id,event_type,description) values(p.property_id,p.id,auth.uid(),'package_recipient_assigned','Destinatario asociado');
  perform private.write_property_audit(p.property_id,'package.recipient_assigned','package',p.id,jsonb_build_object('recipient_member_id',target_member_id));
  perform private.enqueue_package_notification(p.id,target_member_id);
end;
$$;

create or replace function public.deliver_package(target_package_id uuid,target_collected_by_name text)
returns void language plpgsql security definer set search_path='' as $$
declare p public.packages%rowtype; collector text:=trim(target_collected_by_name);
begin
  select * into p from public.packages where id=target_package_id for update;
  if not found or not (private.is_active_member(p.property_id,'administrator') or private.is_active_member(p.property_id,'concierge')) then raise exception 'not_authorized'; end if;
  if p.status='delivered' or char_length(collector) not between 2 and 120 then raise exception 'invalid_transition'; end if;
  update public.packages set status='delivered',delivered_at=now(),delivered_by=auth.uid(),collected_by_name=collector where id=p.id;
  insert into public.activity_events(property_id,package_id,actor_id,event_type,previous_state,new_state,description) values(p.property_id,p.id,auth.uid(),'package_delivered',p.status,'delivered','Paquete entregado a '||collector);
  perform private.write_property_audit(p.property_id,'package.delivered','package',p.id,jsonb_build_object('collected_by_name',collector));
end;
$$;

revoke all on function private.enqueue_package_notification(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_package_registration_directory(uuid),public.register_package(uuid,uuid,uuid,text,text,text,text,text,text,text),public.assign_package_recipient(uuid,uuid),public.deliver_package(uuid,text) from public,anon;
grant execute on function public.get_package_registration_directory(uuid),public.register_package(uuid,uuid,uuid,text,text,text,text,text,text,text),public.assign_package_recipient(uuid,uuid),public.deliver_package(uuid,text) to authenticated;

create or replace function public.complete_email_job(target_job_id uuid,provider_id text,target_subject text,target_body text)
returns void language plpgsql security definer set search_path='' as $$
declare j public.email_jobs%rowtype; package_target_id uuid; package_property_id uuid;
begin
  select * into j from public.email_jobs where id=target_job_id for update;
  if not found or j.status<>'processing' then raise exception 'invalid_job'; end if;
  insert into public.email_logs(property_id,email_job_id,attempt_number,recipient_email,subject,body_snapshot,provider_message_id,status)
  values(j.property_id,j.id,j.attempt_count,j.recipient_email,left(target_subject,200),left(target_body,2000),provider_id,'accepted');
  update public.email_jobs set status='accepted',locked_until=null,locked_by=null,last_error_code=null where id=j.id;
  if j.template_key='package_received' then
    select n.target_id,n.property_id into package_target_id,package_property_id from public.notifications n where n.id=j.notification_id and n.target_type='package';
    update public.packages set status='notified',notified_at=now() where id=package_target_id and property_id=package_property_id and status='received';
    if found then insert into public.activity_events(property_id,package_id,actor_id,event_type,previous_state,new_state,description) values(package_property_id,package_target_id,null,'package_notified','received','notified','Correo aceptado por el proveedor'); end if;
  end if;
end;
$$;
revoke all on function public.complete_email_job(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_email_job(uuid,text,text,text) to service_role;
