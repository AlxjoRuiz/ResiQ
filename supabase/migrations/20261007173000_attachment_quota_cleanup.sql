-- Serialize reservations and keep rejected objects charged until safe Storage cleanup.
create or replace function public.prepare_pqrs_document(
  target_pqrs_id uuid,target_message_id uuid,target_original_name text,target_mime_type text,target_size_bytes bigint
) returns table(document_id uuid,object_path text) language plpgsql security definer set search_path='' as $$
declare q public.pqrs%rowtype; generated_id uuid:=gen_random_uuid(); extension text;
begin
  select * into q from public.pqrs where id=target_pqrs_id for update;
  if not found or not private.can_read_pqrs(q.id) then raise exception 'not_authorized'; end if;
  if target_message_id is not null and not exists(select 1 from public.pqrs_messages m where m.id=target_message_id and m.pqrs_id=q.id) then raise exception 'invalid_parent'; end if;
  if target_mime_type not in ('application/pdf','image/jpeg','image/png') or target_size_bytes not between 1 and 10485760 or char_length(trim(target_original_name)) not between 1 and 180 then raise exception 'invalid_file'; end if;
  if (select count(*) from public.documents d where d.property_id=q.property_id and (d.pqrs_id=q.id or exists(select 1 from public.pqrs_messages m where m.id=d.pqrs_message_id and m.pqrs_id=q.id)) and d.status in ('pending','available','rejected'))>=5 then raise exception 'file_limit'; end if;
  extension:=case target_mime_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' else 'png' end;
  document_id:=generated_id; object_path:=q.property_id||'/pqrs/'||q.id||'/'||generated_id||'.'||extension;
  insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,pqrs_id,pqrs_message_id)
  values(generated_id,q.property_id,object_path,trim(target_original_name),target_mime_type,target_size_bytes,auth.uid(),case when target_message_id is null then q.id else null end,target_message_id);
  return next;
end;
$$;

create or replace function public.prepare_attention_call_document(target_attention_call_id uuid,target_original_name text,target_mime_type text,target_size_bytes bigint)
returns table(document_id uuid,object_path text) language plpgsql security definer set search_path='' as $$
declare item public.attention_calls%rowtype; generated_id uuid:=gen_random_uuid(); extension text;
begin
  select * into item from public.attention_calls where id=target_attention_call_id for update;
  if not found or not private.is_active_member(item.property_id,'administrator') or item.status='closed' then raise exception 'not_authorized'; end if;
  if char_length(trim(target_original_name)) not between 1 and 180 or target_mime_type not in ('application/pdf','image/jpeg','image/png') or target_size_bytes not between 1 and 10485760 then raise exception 'invalid_file'; end if;
  if (select count(*) from public.documents d where d.property_id=item.property_id and d.attention_call_id=item.id and d.status in ('pending','available','rejected'))>=5 then raise exception 'file_limit'; end if;
  extension:=case target_mime_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' else 'png' end;
  document_id:=generated_id; object_path:=item.property_id||'/attention-calls/'||item.id||'/'||generated_id||'.'||extension;
  insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,attention_call_id)
  values(generated_id,item.property_id,object_path,trim(target_original_name),target_mime_type,target_size_bytes,auth.uid(),item.id);
  return next;
end;
$$;

create or replace function public.prepare_assembly_document(
  target_assembly_id uuid,target_representation_id uuid,target_document_kind text,target_original_name text,target_mime_type text,target_size_bytes bigint
) returns table(document_id uuid,object_path text) language plpgsql security definer set search_path='' as $$
declare item public.assemblies%rowtype; representation public.assembly_representations%rowtype; generated_id uuid:=gen_random_uuid(); extension text; next_version integer; allowed boolean:=false;
begin
  select * into item from public.assemblies where id=target_assembly_id for update;
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
  if target_representation_id is not null and (select count(*) from public.documents where assembly_representation_id=target_representation_id and status in ('pending','available','rejected'))>=5 then raise exception 'file_limit'; end if;
  select coalesce(max(d.version),0)+1 into next_version from public.documents d where d.assembly_id=target_assembly_id and d.document_kind=target_document_kind;
  extension:=case target_mime_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' else 'png' end;
  document_id:=generated_id;
  object_path:=item.property_id||'/assemblies/'||item.id||'/'||coalesce(target_representation_id::text,target_document_kind)||'/'||generated_id||'.'||extension;
  insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,assembly_id,assembly_representation_id,document_kind,version)
  values(generated_id,item.property_id,object_path,trim(target_original_name),target_mime_type,target_size_bytes,auth.uid(),case when target_representation_id is null then item.id else null end,target_representation_id,target_document_kind,next_version);
  return next;
end;
$$;

alter table public.documents add column upload_rejected_at timestamptz;
update public.documents set upload_rejected_at=now() where status='rejected';
create or replace function private.record_document_rejection()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='rejected' and old.status is distinct from 'rejected' then new.upload_rejected_at:=now(); end if;
  return new;
end;
$$;
revoke all on function private.record_document_rejection() from public,anon,authenticated;
create trigger documents_record_rejection before update on public.documents for each row execute function private.record_document_rejection();

create or replace function public.list_rejected_document_cleanup(batch_size integer default 5)
returns table(document_id uuid,bucket text,object_path text) language sql stable security definer set search_path='' as $$
  select d.id,d.bucket,d.object_path from public.documents d
  where d.status='rejected' and d.upload_rejected_at<now()-interval '2 hours 5 minutes'
  order by d.upload_rejected_at limit greatest(1,least(batch_size,50));
$$;
create or replace function public.complete_rejected_document_cleanup(target_document_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare d public.documents%rowtype;
begin
  select * into d from public.documents where id=target_document_id for update;
  if not found or d.status<>'rejected' or d.upload_rejected_at is null or d.upload_rejected_at>=now()-interval '2 hours 5 minutes' then raise exception 'cleanup_not_ready'; end if;
  if exists(select 1 from storage.objects where bucket_id=d.bucket and name=d.object_path) then raise exception 'storage_object_not_removed'; end if;
  update public.documents set status='deleted' where id=d.id;
end;
$$;
revoke all on function public.list_rejected_document_cleanup(integer),public.complete_rejected_document_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.list_rejected_document_cleanup(integer),public.complete_rejected_document_cleanup(uuid) to service_role;
notify pgrst,'reload schema';
