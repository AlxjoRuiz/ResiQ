-- Etapa 8: PQRS privadas, conversación, adjuntos, historial y outbox de correo.

create table public.pqrs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid not null,
  author_member_id uuid not null,
  category text not null check (category in ('accounting','administration','security','complaint','operations','cleaning','maintenance','suggestion')),
  subject text not null check (char_length(trim(subject)) between 4 and 140),
  description text not null check (char_length(trim(description)) between 10 and 5000),
  status text not null default 'pending' check (status in ('pending','in_review','in_progress','answered','closed')),
  assigned_member_id uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,id),
  foreign key(property_id,unit_id) references public.units(property_id,id) on delete restrict,
  foreign key(property_id,author_member_id) references public.property_members(property_id,id) on delete restrict,
  foreign key(property_id,assigned_member_id) references public.property_members(property_id,id) on delete restrict,
  check ((status='closed') = (closed_at is not null))
);
create index pqrs_property_status_created_idx on public.pqrs(property_id,status,created_at desc);
create index pqrs_author_created_idx on public.pqrs(property_id,author_member_id,created_at desc);
create index pqrs_unit_idx on public.pqrs(property_id,unit_id);

create table public.pqrs_messages (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  pqrs_id uuid not null,
  author_member_id uuid not null,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  unique(property_id,id),
  foreign key(property_id,pqrs_id) references public.pqrs(property_id,id) on delete restrict,
  foreign key(property_id,author_member_id) references public.property_members(property_id,id) on delete restrict
);
create index pqrs_messages_parent_created_idx on public.pqrs_messages(property_id,pqrs_id,created_at,id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  bucket text not null default 'private-documents' check (bucket='private-documents'),
  object_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','available','rejected','deleted')),
  pqrs_id uuid,
  pqrs_message_id uuid,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(property_id,pqrs_id) references public.pqrs(property_id,id) on delete restrict,
  foreign key(property_id,pqrs_message_id) references public.pqrs_messages(property_id,id) on delete restrict,
  check (num_nonnulls(pqrs_id,pqrs_message_id)=1)
);
create index documents_property_status_created_idx on public.documents(property_id,status,created_at desc);
create index documents_pqrs_idx on public.documents(property_id,pqrs_id) where pqrs_id is not null;
create index documents_pqrs_message_idx on public.documents(property_id,pqrs_message_id) where pqrs_message_id is not null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  recipient_member_id uuid not null,
  type text not null check (type in ('pqrs_created','pqrs_updated')),
  subject text not null,
  body text not null,
  target_type text not null check (target_type='pqrs'),
  target_id uuid,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  read_at timestamptz,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(property_id,recipient_member_id,dedupe_key),
  foreign key(property_id,recipient_member_id) references public.property_members(property_id,id) on delete restrict
);
create index notifications_recipient_unread_idx on public.notifications(property_id,recipient_member_id,read_at,created_at desc);

create table public.email_jobs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  notification_id uuid references public.notifications(id) on delete restrict,
  invitation_id uuid references public.invitations(id) on delete restrict,
  recipient_email text not null,
  template_key text not null check (template_key in ('pqrs_created','pqrs_updated')),
  template_version integer not null default 1,
  template_data jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  status text not null default 'queued' check (status in ('queued','processing','accepted','failed','cancelled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  locked_by text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,dedupe_key),
  check (num_nonnulls(notification_id,invitation_id)=1)
);
create index email_jobs_queue_idx on public.email_jobs(status,next_attempt_at);

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  email_job_id uuid not null references public.email_jobs(id) on delete restrict,
  attempt_number integer not null,
  attempted_at timestamptz not null default now(),
  recipient_email text not null,
  subject text not null,
  body_snapshot text not null,
  provider_message_id text,
  status text not null check (status in ('attempting','accepted','delivered','bounced','failed','unknown')),
  error_code text,
  error_message text,
  delivered_at timestamptz,
  unique(property_id,email_job_id,attempt_number)
);
create index email_logs_provider_idx on public.email_logs(provider_message_id) where provider_message_id is not null;

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  pqrs_id uuid not null,
  actor_id uuid references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('created','message_added','status_changed','attachment_added')),
  previous_state text,
  new_state text,
  description text,
  occurred_at timestamptz not null default now(),
  foreign key(property_id,pqrs_id) references public.pqrs(property_id,id) on delete restrict
);
create index activity_events_pqrs_idx on public.activity_events(property_id,pqrs_id,occurred_at,id);

create trigger pqrs_set_updated_at before update on public.pqrs for each row execute function private.set_updated_at();
create trigger documents_set_updated_at before update on public.documents for each row execute function private.set_updated_at();
create trigger email_jobs_set_updated_at before update on public.email_jobs for each row execute function private.set_updated_at();

create or replace function private.can_read_pqrs(target_pqrs_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.pqrs q
    where q.id=target_pqrs_id and (
      private.is_active_member(q.property_id,'administrator')
      or exists (
        select 1 from public.property_members pm
        join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id and um.unit_id=q.unit_id
        where pm.id=q.author_member_id and pm.user_id=auth.uid() and pm.status='active'
          and 'member'=any(pm.roles) and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
      )
    )
  );
$$;

create or replace function private.pqrs_document_parent(target_document_id uuid)
returns uuid language sql stable security definer set search_path='' as $$
  select coalesce(d.pqrs_id,m.pqrs_id)
  from public.documents d left join public.pqrs_messages m on m.id=d.pqrs_message_id and m.property_id=d.property_id
  where d.id=target_document_id;
$$;

alter table public.pqrs enable row level security;
alter table public.pqrs_messages enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.email_jobs enable row level security;
alter table public.email_logs enable row level security;
alter table public.activity_events enable row level security;

create policy pqrs_read_author_or_admin on public.pqrs for select to authenticated using (private.can_read_pqrs(id));
create policy pqrs_messages_read_parent on public.pqrs_messages for select to authenticated using (private.can_read_pqrs(pqrs_id));
create policy documents_read_parent on public.documents for select to authenticated using (
  (status='pending' and uploaded_by=auth.uid()) or (status='available' and private.can_read_pqrs(private.pqrs_document_parent(id)))
);
create policy notifications_read_own on public.notifications for select to authenticated using (
  exists(select 1 from public.property_members pm where pm.id=recipient_member_id and pm.property_id=notifications.property_id and pm.user_id=auth.uid() and pm.status='active')
);
create policy notifications_mark_own_read on public.notifications for update to authenticated using (
  exists(select 1 from public.property_members pm where pm.id=recipient_member_id and pm.property_id=notifications.property_id and pm.user_id=auth.uid() and pm.status='active')
) with check (
  exists(select 1 from public.property_members pm where pm.id=recipient_member_id and pm.property_id=notifications.property_id and pm.user_id=auth.uid() and pm.status='active')
);
create policy activity_events_read_parent on public.activity_events for select to authenticated using (private.can_read_pqrs(pqrs_id));

grant select on public.pqrs,public.pqrs_messages,public.documents,public.notifications,public.activity_events to authenticated;
grant update(read_at) on public.notifications to authenticated;
revoke all on public.email_jobs,public.email_logs from public,anon,authenticated;
revoke all on function private.can_read_pqrs(uuid),private.pqrs_document_parent(uuid) from public;
grant execute on function private.can_read_pqrs(uuid),private.pqrs_document_parent(uuid) to authenticated;

create or replace function private.enqueue_pqrs_notification(
  target_pqrs_id uuid, target_member_id uuid, notification_type text,
  notification_subject text, notification_body text, target_dedupe_key text
) returns void language plpgsql security definer set search_path='' as $$
declare q public.pqrs%rowtype; notification_id uuid; recipient_email text;
begin
  select * into q from public.pqrs where id=target_pqrs_id;
  if not found then raise exception 'pqrs_not_found'; end if;
  insert into public.notifications(property_id,recipient_member_id,type,subject,body,target_type,target_id,dedupe_key)
  values(q.property_id,target_member_id,notification_type,notification_subject,notification_body,'pqrs',q.id,target_dedupe_key)
  on conflict(property_id,recipient_member_id,dedupe_key) do nothing returning id into notification_id;
  if notification_id is null then return; end if;
  select lower(au.email) into recipient_email from public.property_members pm join auth.users au on au.id=pm.user_id where pm.id=target_member_id and pm.status='active';
  if recipient_email is not null then
    insert into public.email_jobs(property_id,notification_id,recipient_email,template_key,template_data,dedupe_key)
    values(q.property_id,notification_id,recipient_email,notification_type,jsonb_build_object('property_id',q.property_id,'pqrs_id',q.id,'subject',q.subject),target_dedupe_key);
  end if;
end;
$$;

create or replace function public.create_pqrs(
  target_property_id uuid,target_unit_id uuid,target_category text,target_subject text,target_description text
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor_member_id uuid; created_id uuid; recipient record;
begin
  if target_category not in ('accounting','administration','security','complaint','operations','cleaning','maintenance','suggestion')
    or char_length(trim(target_subject)) not between 4 and 140 or char_length(trim(target_description)) not between 10 and 5000 then raise exception 'invalid_input'; end if;
  select pm.id into actor_member_id
  from public.property_members pm join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id
  where pm.property_id=target_property_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
    and um.unit_id=target_unit_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now());
  if actor_member_id is null then raise exception 'not_authorized'; end if;
  insert into public.pqrs(property_id,unit_id,author_member_id,category,subject,description)
  values(target_property_id,target_unit_id,actor_member_id,target_category,trim(target_subject),trim(target_description)) returning id into created_id;
  insert into public.activity_events(property_id,pqrs_id,actor_id,event_type,new_state,description)
  values(target_property_id,created_id,auth.uid(),'created','pending','PQRS creada');
  perform private.write_property_audit(target_property_id,'pqrs.created','pqrs',created_id,jsonb_build_object('category',target_category));
  for recipient in select id from public.property_members where property_id=target_property_id and status='active' and 'administrator'=any(roles) loop
    perform private.enqueue_pqrs_notification(created_id,recipient.id,'pqrs_created','Nueva PQRS','Se creó una nueva PQRS en la propiedad.','pqrs-created:'||created_id||':'||recipient.id);
  end loop;
  return created_id;
end;
$$;

create or replace function public.add_pqrs_message(target_pqrs_id uuid,target_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare q public.pqrs%rowtype; actor_member_id uuid; actor_is_admin boolean; message_id uuid; previous_status text; recipient record;
begin
  if char_length(trim(target_body)) not between 1 and 5000 then raise exception 'invalid_input'; end if;
  select * into q from public.pqrs where id=target_pqrs_id for update;
  if not found or not private.can_read_pqrs(q.id) or q.status='closed' then raise exception 'not_authorized'; end if;
  select pm.id,('administrator'=any(pm.roles)) into actor_member_id,actor_is_admin from public.property_members pm
  where pm.property_id=q.property_id and pm.user_id=auth.uid() and pm.status='active';
  if actor_member_id is null then raise exception 'not_authorized'; end if;
  insert into public.pqrs_messages(property_id,pqrs_id,author_member_id,body) values(q.property_id,q.id,actor_member_id,trim(target_body)) returning id into message_id;
  previous_status:=q.status;
  if actor_is_admin then update public.pqrs set status='answered',closed_at=null where id=q.id;
  elsif q.status='answered' then update public.pqrs set status='in_review',closed_at=null where id=q.id; end if;
  insert into public.activity_events(property_id,pqrs_id,actor_id,event_type,previous_state,new_state,description)
  values(q.property_id,q.id,auth.uid(),'message_added',previous_status,case when actor_is_admin then 'answered' when previous_status='answered' then 'in_review' else previous_status end,'Nueva respuesta');
  perform private.write_property_audit(q.property_id,'pqrs.message_added','pqrs',q.id,jsonb_build_object('message_id',message_id));
  if actor_is_admin then
    perform private.enqueue_pqrs_notification(q.id,q.author_member_id,'pqrs_updated','Nueva respuesta a tu PQRS','La administración respondió tu PQRS.','pqrs-message:'||message_id||':'||q.author_member_id);
  else
    for recipient in select id from public.property_members where property_id=q.property_id and status='active' and 'administrator'=any(roles) loop
      perform private.enqueue_pqrs_notification(q.id,recipient.id,'pqrs_updated','Nueva respuesta en una PQRS','El residente añadió una respuesta.','pqrs-message:'||message_id||':'||recipient.id);
    end loop;
  end if;
  return message_id;
end;
$$;

create or replace function public.change_pqrs_status(target_pqrs_id uuid,target_status text)
returns void language plpgsql security definer set search_path='' as $$
declare q public.pqrs%rowtype;
begin
  select * into q from public.pqrs where id=target_pqrs_id for update;
  if not found or not private.is_active_member(q.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if q.status='closed' or target_status not in ('in_review','in_progress','answered','closed') or q.status=target_status then raise exception 'invalid_transition'; end if;
  update public.pqrs set status=target_status,closed_at=case when target_status='closed' then now() else null end where id=q.id;
  insert into public.activity_events(property_id,pqrs_id,actor_id,event_type,previous_state,new_state,description)
  values(q.property_id,q.id,auth.uid(),'status_changed',q.status,target_status,'Estado actualizado');
  perform private.write_property_audit(q.property_id,'pqrs.status_changed','pqrs',q.id,jsonb_build_object('from',q.status,'to',target_status));
  perform private.enqueue_pqrs_notification(q.id,q.author_member_id,'pqrs_updated','Estado de PQRS actualizado','La administración actualizó el estado de tu PQRS.','pqrs-status:'||q.id||':'||target_status);
end;
$$;

create or replace function public.prepare_pqrs_document(
  target_pqrs_id uuid,target_message_id uuid,target_original_name text,target_mime_type text,target_size_bytes bigint
) returns table(document_id uuid,object_path text) language plpgsql security definer set search_path='' as $$
declare q public.pqrs%rowtype; generated_id uuid:=gen_random_uuid(); extension text;
begin
  select * into q from public.pqrs where id=target_pqrs_id;
  if not found or not private.can_read_pqrs(q.id) then raise exception 'not_authorized'; end if;
  if target_message_id is not null and not exists(select 1 from public.pqrs_messages m where m.id=target_message_id and m.pqrs_id=q.id) then raise exception 'invalid_parent'; end if;
  if target_mime_type not in ('application/pdf','image/jpeg','image/png') or target_size_bytes not between 1 and 10485760 or char_length(trim(target_original_name)) not between 1 and 180 then raise exception 'invalid_file'; end if;
  if (select count(*) from public.documents d where d.property_id=q.property_id and ((target_message_id is null and d.pqrs_id=q.id) or d.pqrs_message_id=target_message_id) and d.status in ('pending','available'))>=5 then raise exception 'file_limit'; end if;
  extension:=case target_mime_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' else 'png' end;
  document_id:=generated_id; object_path:=q.property_id||'/pqrs/'||q.id||'/'||generated_id||'.'||extension;
  insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,pqrs_id,pqrs_message_id)
  values(generated_id,q.property_id,object_path,trim(target_original_name),target_mime_type,target_size_bytes,auth.uid(),case when target_message_id is null then q.id else null end,target_message_id);
  return next;
end;
$$;

create or replace function public.complete_pqrs_document(target_document_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare d public.documents%rowtype; parent_id uuid;
begin
  select * into d from public.documents where id=target_document_id for update;
  if d.id is null then raise exception 'not_authorized'; end if;
  parent_id:=private.pqrs_document_parent(target_document_id);
  if d.uploaded_by<>auth.uid() or d.status<>'pending' or not private.can_read_pqrs(parent_id) then raise exception 'not_authorized'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id=d.bucket and o.name=d.object_path) then raise exception 'file_missing'; end if;
  update public.documents set status='available' where id=d.id;
  insert into public.activity_events(property_id,pqrs_id,actor_id,event_type,description) values(d.property_id,parent_id,auth.uid(),'attachment_added','Adjunto añadido');
  perform private.write_property_audit(d.property_id,'pqrs.attachment_added','document',d.id,jsonb_build_object('pqrs_id',parent_id,'mime_type',d.mime_type,'size_bytes',d.size_bytes));
end;
$$;

create or replace function public.reject_pqrs_document(target_document_id uuid,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.documents set status='rejected',rejection_reason=left(coalesce(target_reason,'validation_failed'),80)
  where id=target_document_id and uploaded_by=auth.uid() and status='pending';
end;
$$;

revoke all on function private.enqueue_pqrs_notification(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.create_pqrs(uuid,uuid,text,text,text),public.add_pqrs_message(uuid,text),public.change_pqrs_status(uuid,text),public.prepare_pqrs_document(uuid,uuid,text,text,bigint),public.complete_pqrs_document(uuid),public.reject_pqrs_document(uuid,text) from public,anon;
grant execute on function public.create_pqrs(uuid,uuid,text,text,text),public.add_pqrs_message(uuid,text),public.change_pqrs_status(uuid,text),public.prepare_pqrs_document(uuid,uuid,text,text,bigint),public.complete_pqrs_document(uuid),public.reject_pqrs_document(uuid,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('private-documents','private-documents',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy private_documents_insert on storage.objects for insert to authenticated with check (
  bucket_id='private-documents' and exists(select 1 from public.documents d where d.bucket=bucket_id and d.object_path=name and d.status='pending' and d.uploaded_by=auth.uid())
);
create policy private_documents_read on storage.objects for select to authenticated using (
  bucket_id='private-documents' and exists(select 1 from public.documents d where d.bucket=bucket_id and d.object_path=name and ((d.status='pending' and d.uploaded_by=auth.uid()) or (d.status='available' and private.can_read_pqrs(private.pqrs_document_parent(d.id)))))
);

create or replace function public.claim_email_jobs(worker_name text,batch_size integer default 10)
returns setof public.email_jobs language plpgsql security definer set search_path='' as $$
begin
  return query with candidates as (
    select id from public.email_jobs where (status='queued' or (status='processing' and locked_until<now())) and next_attempt_at<=now()
    order by next_attempt_at for update skip locked limit greatest(1,least(batch_size,50))
  ) update public.email_jobs j set status='processing',locked_by=left(worker_name,80),locked_until=now()+interval '5 minutes',attempt_count=j.attempt_count+1
  from candidates c where j.id=c.id returning j.*;
end;
$$;
create or replace function public.complete_email_job(target_job_id uuid,provider_id text,target_subject text,target_body text)
returns void language plpgsql security definer set search_path='' as $$
declare j public.email_jobs%rowtype;
begin
  select * into j from public.email_jobs where id=target_job_id for update;
  if not found or j.status<>'processing' then raise exception 'invalid_job'; end if;
  insert into public.email_logs(property_id,email_job_id,attempt_number,recipient_email,subject,body_snapshot,provider_message_id,status)
  values(j.property_id,j.id,j.attempt_count,j.recipient_email,left(target_subject,200),left(target_body,2000),provider_id,'accepted');
  update public.email_jobs set status='accepted',locked_until=null,locked_by=null,last_error_code=null where id=j.id;
end;
$$;
create or replace function public.fail_email_job(target_job_id uuid,error_code text,error_message text,target_subject text,target_body text)
returns void language plpgsql security definer set search_path='' as $$
declare j public.email_jobs%rowtype; terminal boolean;
begin
  select * into j from public.email_jobs where id=target_job_id for update;
  if not found or j.status<>'processing' then raise exception 'invalid_job'; end if;
  terminal:=j.attempt_count>=5;
  insert into public.email_logs(property_id,email_job_id,attempt_number,recipient_email,subject,body_snapshot,status,error_code,error_message)
  values(j.property_id,j.id,j.attempt_count,j.recipient_email,left(target_subject,200),left(target_body,2000),'failed',left(error_code,80),left(error_message,500));
  update public.email_jobs set status=case when terminal then 'failed' else 'queued' end,next_attempt_at=now()+make_interval(mins=>least(60,5*j.attempt_count)),locked_until=null,locked_by=null,last_error_code=left(error_code,80) where id=j.id;
end;
$$;
revoke all on function public.claim_email_jobs(text,integer),public.complete_email_job(uuid,text,text,text),public.fail_email_job(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_email_jobs(text,integer),public.complete_email_job(uuid,text,text,text),public.fail_email_job(uuid,text,text,text,text) to service_role;
