-- Comunicados: se publican al crearlos (sin borrador) y aceptan hasta cinco adjuntos privados,
-- con el mismo flujo de Asambleas (decisión de Alejandro, 25/10/2026). Los archivos se cargan y
-- validan antes; create_published_announcement confirma comunicado, destinatarios, adjuntos y
-- avisos en una transacción. Los borradores existentes se conservan y se pueden publicar.
begin;

alter table public.documents add column announcement_id uuid;
alter table public.documents add foreign key(property_id,announcement_id) references public.announcements(property_id,id) on delete restrict;
alter table public.documents drop constraint documents_one_parent_check;
alter table public.documents add constraint documents_one_parent_check check (num_nonnulls(pqrs_id,pqrs_message_id,attention_call_id,assembly_id,assembly_representation_id,announcement_id)=1);
create index documents_announcement_idx on public.documents(property_id,announcement_id) where announcement_id is not null;

alter table public.announcements add column creation_request_id uuid;
create unique index announcements_creation_request_idx on public.announcements(creation_request_id) where creation_request_id is not null;

create table public.announcement_upload_staging (
  id uuid primary key,
  property_id uuid not null references public.properties(id) on delete restrict,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  object_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  status text not null default 'pending' check (status in ('pending','validated','consumed')),
  announcement_id uuid references public.announcements(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check ((status='consumed')=(announcement_id is not null))
);
create index announcement_upload_staging_actor_idx on public.announcement_upload_staging(uploaded_by,property_id,status,created_at);
alter table public.announcement_upload_staging enable row level security;
revoke all on public.announcement_upload_staging from public,anon,authenticated;
grant select,insert,update,delete on public.announcement_upload_staging to service_role;

-- Lectura de adjuntos: mismas políticas que 20261005190000_assemblies.sql y
-- 20261007170000_access_revocation.sql, más los comunicados (private.can_read_announcement).
drop policy documents_read_parent on public.documents;
create policy documents_read_parent on public.documents for select to authenticated using (
  (status='pending' and uploaded_by=auth.uid()) or (status='available' and (
    (attention_call_id is null and assembly_id is null and assembly_representation_id is null and announcement_id is null and private.can_read_pqrs(private.pqrs_document_parent(id))) or
    (attention_call_id is not null and private.can_read_attention_call(attention_call_id)) or
    (assembly_id is not null and private.can_read_assembly(assembly_id)) or
    (assembly_representation_id is not null and private.can_read_assembly_representation(assembly_representation_id)) or
    (announcement_id is not null and private.can_read_announcement(announcement_id))
  ))
);

drop policy private_documents_read on storage.objects;
create policy private_documents_read on storage.objects for select to authenticated using (
  bucket_id='private-documents' and exists(
    select 1 from public.documents d where d.bucket=bucket_id and d.object_path=name and (
      (d.status='pending' and d.uploaded_by=auth.uid()) or (d.status='available' and (
        (d.attention_call_id is null and d.assembly_id is null and d.assembly_representation_id is null and d.announcement_id is null and private.can_read_pqrs(private.pqrs_document_parent(d.id))) or
        (d.attention_call_id is not null and private.can_read_attention_call(d.attention_call_id)) or
        (d.assembly_id is not null and private.can_read_assembly(d.assembly_id)) or
        (d.assembly_representation_id is not null and private.can_read_assembly_representation(d.assembly_representation_id)) or
        (d.announcement_id is not null and private.can_read_announcement(d.announcement_id))
      ))
    )
  )
);

create or replace function private.can_read_document_parent(target_document_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.documents d where d.id=target_document_id and private.is_active_member(d.property_id) and (
    (d.pqrs_id is not null or d.pqrs_message_id is not null) and private.can_read_pqrs(private.pqrs_document_parent(d.id)) or
    d.attention_call_id is not null and private.can_read_attention_call(d.attention_call_id) or
    d.assembly_id is not null and private.can_read_assembly(d.assembly_id) or
    d.assembly_representation_id is not null and private.can_read_assembly_representation(d.assembly_representation_id) or
    d.announcement_id is not null and private.can_read_announcement(d.announcement_id)
  ));
$$;

create or replace function public.create_published_announcement(
  target_property_id uuid,target_subject text,target_body text,target_recipient_ids uuid[],target_upload_ids uuid[],target_request_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); created_id uuid; staged public.announcement_upload_staging%rowtype; upload_count integer:=0;
begin
  if actor_id is null or not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if target_request_id is null then raise exception 'invalid_input'; end if;
  select id into created_id from public.announcements where creation_request_id=target_request_id and property_id=target_property_id and status='published';
  if created_id is not null then return created_id; end if;
  target_upload_ids:=coalesce(target_upload_ids,'{}'::uuid[]);
  if cardinality(target_upload_ids)>5
    or (select count(distinct upload_id) from unnest(target_upload_ids) as uploads(upload_id))<>cardinality(target_upload_ids)
  then raise exception 'invalid_uploads'; end if;
  for staged in select * from public.announcement_upload_staging where id=any(target_upload_ids) order by id for update loop
    if staged.property_id<>target_property_id or staged.uploaded_by<>actor_id or staged.status<>'validated'
      or staged.expires_at<=now() or not exists(
        select 1 from storage.objects o where o.bucket_id='private-documents' and o.name=staged.object_path
      ) then raise exception 'invalid_uploads'; end if;
    upload_count:=upload_count+1;
  end loop;
  if upload_count<>cardinality(target_upload_ids) then raise exception 'invalid_uploads'; end if;

  created_id:=public.save_announcement_draft(target_property_id,null,target_subject,target_body,target_recipient_ids);
  update public.announcements set creation_request_id=target_request_id where id=created_id;
  insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,status,announcement_id)
  select s.id,target_property_id,s.object_path,s.original_name,s.mime_type,s.size_bytes,actor_id,'available',created_id
  from public.announcement_upload_staging s where s.id=any(target_upload_ids);
  update public.announcement_upload_staging set status='consumed',announcement_id=created_id where id=any(target_upload_ids);
  perform public.publish_announcement(created_id);
  return created_id;
end;
$$;
revoke all on function public.create_published_announcement(uuid,text,text,uuid[],uuid[],uuid) from public,anon;
grant execute on function public.create_published_announcement(uuid,text,text,uuid[],uuid[],uuid) to authenticated;

notify pgrst,'reload schema';
commit;

select
  has_function_privilege('authenticated','public.create_published_announcement(uuid,text,text,uuid[],uuid[],uuid)','execute') as publicar_con_adjuntos,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='documents' and column_name='announcement_id') as adjuntos_en_documentos,
  pg_get_functiondef('private.can_read_document_parent(uuid)'::regprocedure) like '%can_read_announcement%' as lectura_de_adjuntos,
  not has_table_privilege('authenticated','public.announcement_upload_staging','select') as preparacion_privada;
