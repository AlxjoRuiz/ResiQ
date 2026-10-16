-- One-step assembly creation: files are validated privately before the
-- assembly, its agenda, the audience, and notices are committed together.

create table public.assembly_upload_staging (
  id uuid primary key,
  property_id uuid not null references public.properties(id) on delete restrict,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  object_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  document_kind text not null check (document_kind in ('convocation','support')),
  status text not null default 'pending' check (status in ('pending','validated','consumed')),
  assembly_id uuid references public.assemblies(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check ((status='consumed')=(assembly_id is not null))
);
create index assembly_upload_staging_actor_idx on public.assembly_upload_staging(uploaded_by,property_id,status,created_at);
alter table public.assemblies add column creation_request_id uuid;
create unique index assemblies_creation_request_idx on public.assemblies(creation_request_id) where creation_request_id is not null;
alter table public.assembly_upload_staging enable row level security;
revoke all on public.assembly_upload_staging from public,anon,authenticated;
grant select,insert,update,delete on public.assembly_upload_staging to service_role;

create or replace function public.create_published_assembly(
  target_property_id uuid,target_type text,target_title text,target_description text,target_starts_at timestamptz,
  target_location text,target_agenda jsonb,target_audience jsonb,target_upload_ids uuid[],target_request_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor_id uuid:=auth.uid(); created_id uuid; staged public.assembly_upload_staging%rowtype;
  upload_count integer:=0; convocation_count integer:=0; support_version integer:=0;
begin
  if actor_id is null or not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if target_request_id is null then raise exception 'invalid_input'; end if;
  select id into created_id from public.assemblies where creation_request_id=target_request_id
    and property_id=target_property_id and created_by=actor_id and published_at is not null;
  if created_id is not null then return created_id; end if;
  if target_upload_ids is null or array_length(target_upload_ids,1) not between 1 and 5
    or (select count(distinct upload_id) from unnest(target_upload_ids) as uploads(upload_id))<>array_length(target_upload_ids,1)
  then raise exception 'invalid_uploads'; end if;
  for staged in select * from public.assembly_upload_staging where id=any(target_upload_ids) order by id for update loop
    if staged.property_id<>target_property_id or staged.uploaded_by<>actor_id or staged.status<>'validated'
      or staged.expires_at<=now() or not exists(
        select 1 from storage.objects o where o.bucket_id='private-documents' and o.name=staged.object_path
      ) then raise exception 'invalid_uploads'; end if;
    upload_count:=upload_count+1;
    if staged.document_kind='convocation' then convocation_count:=convocation_count+1; end if;
  end loop;
  if upload_count<>array_length(target_upload_ids,1) or convocation_count<>1 then raise exception 'convocation_required'; end if;

  created_id:=public.create_assembly(target_property_id,target_type,target_title,target_description,target_starts_at,
    target_location,target_agenda,target_audience);
  update public.assemblies set creation_request_id=target_request_id where id=created_id;
  for staged in select * from public.assembly_upload_staging where id=any(target_upload_ids) order by id loop
    if staged.document_kind='support' then support_version:=support_version+1; end if;
    insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,status,
      assembly_id,document_kind,version)
    values(staged.id,target_property_id,staged.object_path,staged.original_name,staged.mime_type,staged.size_bytes,
      actor_id,'available',created_id,staged.document_kind,case when staged.document_kind='convocation' then 1 else support_version end);
  end loop;
  update public.assembly_upload_staging set status='consumed',assembly_id=created_id where id=any(target_upload_ids);
  perform public.publish_assembly(created_id);
  update public.activity_events set description='Asamblea creada' where assembly_id=created_id and event_type='assembly_created';
  return created_id;
end;
$$;
revoke all on function public.create_published_assembly(uuid,text,text,text,timestamptz,text,jsonb,jsonb,uuid[],uuid) from public,anon;
grant execute on function public.create_published_assembly(uuid,text,text,text,timestamptz,text,jsonb,jsonb,uuid[],uuid) to authenticated;
revoke execute on function public.create_assembly(uuid,text,text,text,timestamptz,text,jsonb,jsonb) from authenticated;

-- Existing drafts can still be published, but only with a verified invitation.
create or replace function private.require_assembly_convocation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.published_at is null and new.published_at is not null and not exists(
    select 1 from public.documents d where d.assembly_id=new.id and d.document_kind='convocation' and d.status='available'
  ) then raise exception 'convocation_required'; end if;
  return new;
end;
$$;
create trigger assemblies_require_convocation before update of published_at on public.assemblies
for each row execute function private.require_assembly_convocation();
revoke all on function private.require_assembly_convocation() from public,anon,authenticated;
