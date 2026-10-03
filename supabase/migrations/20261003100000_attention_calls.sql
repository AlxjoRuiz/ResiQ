-- Etapa 13: llamados de atención privados, destinatarios, evidencias y correo.

create table public.attention_calls (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid not null,
  category text not null check (category in ('coexistence','noise','pets','waste','common_areas','security','parking','administrative','other')),
  reason text not null check (char_length(trim(reason)) between 4 and 180),
  description text not null check (char_length(trim(description)) between 10 and 5000),
  issued_at timestamptz not null,
  responsible_member_id uuid not null,
  status text not null default 'created' check (status in ('created','notified','in_review','closed')),
  close_note text check (close_note is null or char_length(trim(close_note)) between 4 and 1000),
  closed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,id),
  foreign key(property_id,unit_id) references public.units(property_id,id) on delete restrict,
  foreign key(property_id,responsible_member_id) references public.property_members(property_id,id) on delete restrict,
  check ((status='closed')=(closed_at is not null and close_note is not null))
);
create index attention_calls_property_status_issued_idx on public.attention_calls(property_id,status,issued_at desc);
create index attention_calls_unit_issued_idx on public.attention_calls(property_id,unit_id,issued_at desc);
create trigger attention_calls_set_updated_at before update on public.attention_calls for each row execute function private.set_updated_at();

create table public.attention_call_recipients (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  attention_call_id uuid not null,
  member_id uuid not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(property_id,attention_call_id,member_id),
  foreign key(property_id,attention_call_id) references public.attention_calls(property_id,id) on delete restrict,
  foreign key(property_id,member_id) references public.property_members(property_id,id) on delete restrict
);
create index attention_call_recipients_member_idx on public.attention_call_recipients(property_id,member_id,read_at);

create or replace function private.can_read_attention_call(target_attention_call_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.attention_calls ac
    where ac.id=target_attention_call_id and (
      private.is_active_member(ac.property_id,'administrator') or exists(
        select 1 from public.attention_call_recipients acr
        join public.property_members pm on pm.id=acr.member_id and pm.property_id=acr.property_id
        join public.unit_memberships um on um.member_id=pm.id and um.property_id=pm.property_id and um.unit_id=ac.unit_id
        where acr.property_id=ac.property_id and acr.attention_call_id=ac.id
          and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
          and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
      )
    )
  );
$$;

alter table public.attention_calls enable row level security;
alter table public.attention_call_recipients enable row level security;
create policy attention_calls_read on public.attention_calls for select to authenticated using (private.can_read_attention_call(id));
create policy attention_call_recipients_read on public.attention_call_recipients for select to authenticated using (
  private.is_active_member(property_id,'administrator') or (
    private.can_read_attention_call(attention_call_id) and exists(
      select 1 from public.property_members pm where pm.id=member_id and pm.property_id=property_id and pm.user_id=auth.uid() and pm.status='active'
    )
  )
);
grant select on public.attention_calls,public.attention_call_recipients to authenticated;
revoke all on public.attention_calls,public.attention_call_recipients from anon;
revoke insert,update,delete,truncate,references,trigger on public.attention_calls,public.attention_call_recipients from authenticated;

alter table public.documents add column attention_call_id uuid;
alter table public.documents add foreign key(property_id,attention_call_id) references public.attention_calls(property_id,id) on delete restrict;
alter table public.documents drop constraint documents_check;
alter table public.documents add constraint documents_one_parent_check check (num_nonnulls(pqrs_id,pqrs_message_id,attention_call_id)=1);
create index documents_attention_call_idx on public.documents(property_id,attention_call_id) where attention_call_id is not null;

alter table public.activity_events add column attention_call_id uuid;
alter table public.activity_events add foreign key(property_id,attention_call_id) references public.attention_calls(property_id,id) on delete restrict;
alter table public.activity_events drop constraint activity_events_one_parent_check;
alter table public.activity_events add constraint activity_events_one_parent_check check (num_nonnulls(pqrs_id,package_id,visitor_id,reservation_id,receivable_id,payment_id,attention_call_id)=1);
alter table public.activity_events drop constraint activity_events_event_type_check;
alter table public.activity_events add constraint activity_events_event_type_check check (event_type in ('created','message_added','status_changed','attachment_added','package_received','package_recipient_assigned','package_notified','package_delivered','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','reservation_completed','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice','attention_call_created','attention_call_notified','attention_call_review_started','attention_call_read','attention_call_closed','attention_call_attachment_added'));
create index activity_events_attention_call_idx on public.activity_events(property_id,attention_call_id,occurred_at,id) where attention_call_id is not null;
create policy activity_events_read_attention_call on public.activity_events for select to authenticated using (
  attention_call_id is not null and private.can_read_attention_call(attention_call_id)
);

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice','attention_call_created'));
alter table public.notifications drop constraint notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check check (target_type in ('pqrs','package','visitor','reservation','receivable','payment','attention_call'));
alter table public.email_jobs drop constraint email_jobs_template_key_check;
alter table public.email_jobs add constraint email_jobs_template_key_check check (template_key in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice','attention_call_created'));

drop policy documents_read_parent on public.documents;
create policy documents_read_parent on public.documents for select to authenticated using (
  (status='pending' and uploaded_by=auth.uid()) or (status='available' and (
    (attention_call_id is null and private.can_read_pqrs(private.pqrs_document_parent(id))) or
    (attention_call_id is not null and private.can_read_attention_call(attention_call_id))
  ))
);

drop policy private_documents_read on storage.objects;
create policy private_documents_read on storage.objects for select to authenticated using (
  bucket_id='private-documents' and exists(
    select 1 from public.documents d where d.bucket=bucket_id and d.object_path=name and (
      (d.status='pending' and d.uploaded_by=auth.uid()) or (d.status='available' and (
        (d.attention_call_id is null and private.can_read_pqrs(private.pqrs_document_parent(d.id))) or
        (d.attention_call_id is not null and private.can_read_attention_call(d.attention_call_id))
      ))
    )
  )
);

create or replace function public.create_attention_call(
  target_property_id uuid,target_unit_id uuid,target_category text,target_reason text,target_description text,
  target_issued_on date,target_recipient_member_ids uuid[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare created_id uuid; responsible_id uuid; property_timezone text; recipient_id uuid; recipient_email text; notification_id uuid;
begin
  select pm.id into responsible_id from public.property_members pm
  where pm.property_id=target_property_id and pm.user_id=auth.uid() and pm.status='active' and 'administrator'=any(pm.roles);
  if responsible_id is null then raise exception 'not_authorized'; end if;
  if target_category not in ('coexistence','noise','pets','waste','common_areas','security','parking','administrative','other')
    or char_length(trim(target_reason)) not between 4 and 180 or char_length(trim(target_description)) not between 10 and 5000
    or target_issued_on is null or target_issued_on>current_date or target_recipient_member_ids is null
    or cardinality(target_recipient_member_ids) not between 1 and 20
    or (select count(distinct value) from unnest(target_recipient_member_ids) value)<>cardinality(target_recipient_member_ids)
  then raise exception 'invalid_input'; end if;
  if not exists(select 1 from public.units where id=target_unit_id and property_id=target_property_id and status='active') then raise exception 'unit_not_found'; end if;
  if exists(
    select 1 from unnest(target_recipient_member_ids) selected(member_id)
    where not exists(
      select 1 from public.property_members pm join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id
      where pm.id=selected.member_id and pm.property_id=target_property_id and pm.status='active' and 'member'=any(pm.roles)
        and um.unit_id=target_unit_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
    )
  ) then raise exception 'invalid_recipient'; end if;
  select timezone into property_timezone from public.properties where id=target_property_id and status='active';
  if property_timezone is null then raise exception 'property_not_found'; end if;
  insert into public.attention_calls(property_id,unit_id,category,reason,description,issued_at,responsible_member_id,created_by)
  values(target_property_id,target_unit_id,target_category,trim(target_reason),trim(target_description),target_issued_on::timestamp at time zone property_timezone,responsible_id,auth.uid()) returning id into created_id;
  foreach recipient_id in array target_recipient_member_ids loop
    insert into public.attention_call_recipients(property_id,attention_call_id,member_id) values(target_property_id,created_id,recipient_id);
    insert into public.notifications(property_id,recipient_member_id,type,subject,body,target_type,target_id,payload,dedupe_key)
    values(target_property_id,recipient_id,'attention_call_created','Nuevo llamado de atención','La administración registró un llamado de atención dirigido a ti.','attention_call',created_id,
      jsonb_build_object('attention_call_id',created_id,'property_id',target_property_id,'unit_id',target_unit_id,'category',target_category,'reason',trim(target_reason),'issued_on',target_issued_on),
      'attention-call:'||created_id||':created:'||recipient_id) returning id into notification_id;
    select lower(u.email) into recipient_email from public.property_members pm join auth.users u on u.id=pm.user_id where pm.id=recipient_id and pm.property_id=target_property_id;
    if recipient_email is not null then
      insert into public.email_jobs(property_id,notification_id,recipient_email,template_key,template_data,dedupe_key)
      values(target_property_id,notification_id,recipient_email,'attention_call_created',jsonb_build_object('attention_call_id',created_id,'property_id',target_property_id,'unit_id',target_unit_id,'category',target_category,'reason',trim(target_reason),'issued_on',target_issued_on),'attention-call:'||created_id||':created:'||recipient_id);
    end if;
  end loop;
  insert into public.activity_events(property_id,attention_call_id,actor_id,event_type,new_state,description)
  values(target_property_id,created_id,auth.uid(),'attention_call_created','created','Llamado de atención creado');
  perform private.write_property_audit(target_property_id,'attention_call.created','attention_call',created_id,jsonb_build_object('unit_id',target_unit_id,'recipient_count',cardinality(target_recipient_member_ids),'category',target_category));
  return created_id;
end;
$$;

create or replace function public.change_attention_call_status(target_attention_call_id uuid,target_status text,target_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare item public.attention_calls%rowtype; clean_note text:=nullif(trim(target_note),''); event_name text;
begin
  select * into item from public.attention_calls where id=target_attention_call_id for update;
  if not found or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status='notified' and target_status='in_review' then event_name:='attention_call_review_started';
  elsif item.status='in_review' and target_status='closed' and char_length(clean_note) between 4 and 1000 then event_name:='attention_call_closed';
  else raise exception 'invalid_transition'; end if;
  update public.attention_calls set status=target_status,close_note=case when target_status='closed' then clean_note else null end,closed_at=case when target_status='closed' then now() else null end where id=item.id;
  insert into public.activity_events(property_id,attention_call_id,actor_id,event_type,previous_state,new_state,description)
  values(item.property_id,item.id,auth.uid(),event_name,item.status,target_status,case when target_status='closed' then clean_note else 'Caso en revisión' end);
  perform private.write_property_audit(item.property_id,'attention_call.status_changed','attention_call',item.id,jsonb_build_object('previous_status',item.status,'status',target_status));
end;
$$;

create or replace function public.mark_attention_call_read(target_attention_call_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare target_member_id uuid; target_property_id uuid;
begin
  select acr.member_id,acr.property_id into target_member_id,target_property_id
  from public.attention_call_recipients acr join public.attention_calls ac on ac.id=acr.attention_call_id and ac.property_id=acr.property_id
  join public.property_members pm on pm.id=acr.member_id and pm.property_id=acr.property_id
  where acr.attention_call_id=target_attention_call_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
    and exists(select 1 from public.unit_memberships um where um.property_id=pm.property_id and um.member_id=pm.id and um.unit_id=ac.unit_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now()));
  if target_member_id is null then raise exception 'not_authorized'; end if;
  update public.attention_call_recipients set read_at=now() where property_id=target_property_id and attention_call_id=target_attention_call_id and member_id=target_member_id and read_at is null;
  if found then
    insert into public.activity_events(property_id,attention_call_id,actor_id,event_type,description) values(target_property_id,target_attention_call_id,auth.uid(),'attention_call_read','Destinatario consultó el llamado');
  end if;
end;
$$;

create or replace function public.prepare_attention_call_document(target_attention_call_id uuid,target_original_name text,target_mime_type text,target_size_bytes bigint)
returns table(document_id uuid,object_path text) language plpgsql security definer set search_path='' as $$
declare item public.attention_calls%rowtype; generated_id uuid:=gen_random_uuid(); extension text;
begin
  select * into item from public.attention_calls where id=target_attention_call_id;
  if not found or not private.is_active_member(item.property_id,'administrator') or item.status='closed' then raise exception 'not_authorized'; end if;
  if char_length(trim(target_original_name)) not between 1 and 180 or target_mime_type not in ('application/pdf','image/jpeg','image/png') or target_size_bytes not between 1 and 10485760 then raise exception 'invalid_file'; end if;
  if (select count(*) from public.documents d where d.property_id=item.property_id and d.attention_call_id=item.id and d.status in ('pending','available'))>=5 then raise exception 'file_limit'; end if;
  extension:=case target_mime_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' else 'png' end;
  document_id:=generated_id; object_path:=item.property_id||'/attention-calls/'||item.id||'/'||generated_id||'.'||extension;
  insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,attention_call_id)
  values(generated_id,item.property_id,object_path,trim(target_original_name),target_mime_type,target_size_bytes,auth.uid(),item.id);
  return next;
end;
$$;

create or replace function public.complete_attention_call_document(target_document_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare d public.documents%rowtype;
begin
  select * into d from public.documents where id=target_document_id for update;
  if not found or d.attention_call_id is null or d.status<>'pending' or d.uploaded_by<>auth.uid() or not private.is_active_member(d.property_id,'administrator') then raise exception 'not_authorized'; end if;
  update public.documents set status='available' where id=d.id;
  insert into public.activity_events(property_id,attention_call_id,actor_id,event_type,description) values(d.property_id,d.attention_call_id,auth.uid(),'attention_call_attachment_added','Evidencia añadida');
  perform private.write_property_audit(d.property_id,'attention_call.attachment_added','document',d.id,jsonb_build_object('attention_call_id',d.attention_call_id,'mime_type',d.mime_type,'size_bytes',d.size_bytes));
end;
$$;

create or replace function public.reject_attention_call_document(target_document_id uuid,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.documents set status='rejected',rejection_reason=left(coalesce(target_reason,'validation_failed'),80)
  where id=target_document_id and attention_call_id is not null and uploaded_by=auth.uid() and status='pending';
  if not found then raise exception 'not_authorized'; end if;
end;
$$;

create or replace function public.complete_email_job(target_job_id uuid,provider_id text,target_subject text,target_body text)
returns void language plpgsql security definer set search_path='' as $$
declare j public.email_jobs%rowtype; package_target_id uuid; package_property_id uuid; attention_target_id uuid; attention_property_id uuid;
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
  elsif j.template_key='attention_call_created' then
    select n.target_id,n.property_id into attention_target_id,attention_property_id from public.notifications n where n.id=j.notification_id and n.target_type='attention_call';
    if attention_target_id is not null and not exists(
      select 1 from public.attention_call_recipients acr where acr.property_id=attention_property_id and acr.attention_call_id=attention_target_id and not exists(
        select 1 from public.notifications n join public.email_jobs ej on ej.notification_id=n.id
        where n.property_id=acr.property_id and n.target_type='attention_call' and n.target_id=acr.attention_call_id and n.recipient_member_id=acr.member_id and ej.status='accepted'
      )
    ) then
      update public.attention_calls set status='notified' where id=attention_target_id and property_id=attention_property_id and status='created';
      if found then insert into public.activity_events(property_id,attention_call_id,actor_id,event_type,previous_state,new_state,description) values(attention_property_id,attention_target_id,null,'attention_call_notified','created','notified','Correos aceptados por el proveedor'); end if;
    end if;
  end if;
end;
$$;

revoke all on function private.can_read_attention_call(uuid) from public,anon,authenticated;
grant execute on function private.can_read_attention_call(uuid) to authenticated;
revoke all on function public.create_attention_call(uuid,uuid,text,text,text,date,uuid[]),public.change_attention_call_status(uuid,text,text),public.mark_attention_call_read(uuid),public.prepare_attention_call_document(uuid,text,text,bigint),public.complete_attention_call_document(uuid),public.reject_attention_call_document(uuid,text) from public,anon;
grant execute on function public.create_attention_call(uuid,uuid,text,text,text,date,uuid[]),public.change_attention_call_status(uuid,text,text),public.mark_attention_call_read(uuid),public.prepare_attention_call_document(uuid,text,text,bigint),public.complete_attention_call_document(uuid),public.reject_attention_call_document(uuid,text) to authenticated;
revoke all on function public.complete_email_job(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_email_job(uuid,text,text,text) to service_role;

notify pgrst, 'reload schema';
