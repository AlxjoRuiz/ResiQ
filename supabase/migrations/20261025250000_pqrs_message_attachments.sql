-- PQRS: adjuntos dentro de la conversación (decisión de Alejandro, 25/10/2026). Administración y
-- residente pueden adjuntar archivos a su propio mensaje. El cupo pasa a ser de cinco archivos
-- por mensaje (y cinco en la solicitud inicial), en lugar de cinco para toda la PQRS.
begin;

-- Igual a 20261007173000_attachment_quota_cleanup.sql, con cupo por mensaje, solo el autor del
-- mensaje adjunta a él y no se adjunta en una PQRS cerrada.
create or replace function public.prepare_pqrs_document(
  target_pqrs_id uuid,target_message_id uuid,target_original_name text,target_mime_type text,target_size_bytes bigint
) returns table(document_id uuid,object_path text) language plpgsql security definer set search_path='' as $$
declare q public.pqrs%rowtype; generated_id uuid:=gen_random_uuid(); extension text;
begin
  select * into q from public.pqrs where id=target_pqrs_id for update;
  if not found or not private.can_read_pqrs(q.id) then raise exception 'not_authorized'; end if;
  if target_message_id is not null and (q.status='closed' or not exists(
    select 1 from public.pqrs_messages m join public.property_members pm on pm.id=m.author_member_id and pm.property_id=m.property_id
    where m.id=target_message_id and m.pqrs_id=q.id and pm.user_id=auth.uid() and pm.status='active'
  )) then raise exception 'invalid_parent'; end if;
  if target_mime_type not in ('application/pdf','image/jpeg','image/png') or target_size_bytes not between 1 and 10485760 or char_length(trim(target_original_name)) not between 1 and 180 then raise exception 'invalid_file'; end if;
  if (select count(*) from public.documents d where d.property_id=q.property_id and d.status in ('pending','available','rejected') and (
    (target_message_id is null and d.pqrs_id=q.id) or (target_message_id is not null and d.pqrs_message_id=target_message_id)
  ))>=5 then raise exception 'file_limit'; end if;
  extension:=case target_mime_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' else 'png' end;
  document_id:=generated_id; object_path:=q.property_id||'/pqrs/'||q.id||'/'||generated_id||'.'||extension;
  insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,pqrs_id,pqrs_message_id)
  values(generated_id,q.property_id,object_path,trim(target_original_name),target_mime_type,target_size_bytes,auth.uid(),case when target_message_id is null then q.id else null end,target_message_id);
  return next;
end;
$$;

-- Igual a 20261007210000_pqrs_attachment_slots.sql, contando solo los adjuntos de la solicitud
-- inicial; los de la conversación tienen su propio cupo por mensaje.
create or replace function public.pqrs_attachment_slots_used(target_pqrs_id uuid)
returns integer language plpgsql stable security definer set search_path='' as $$
declare target_property uuid; occupied integer;
begin
  select property_id into target_property from public.pqrs where id=target_pqrs_id;
  if target_property is null or not private.is_active_member(target_property) or not private.can_read_pqrs(target_pqrs_id) then
    raise exception 'not_authorized';
  end if;
  select count(*)::integer into occupied from public.documents d
  where d.property_id=target_property and d.status in ('pending','available','rejected') and d.pqrs_id=target_pqrs_id;
  return occupied;
end;
$$;

notify pgrst,'reload schema';
commit;

select
  pg_get_functiondef('public.prepare_pqrs_document(uuid,uuid,text,text,bigint)'::regprocedure) like '%d.pqrs_message_id=target_message_id%' as cupo_por_mensaje,
  pg_get_functiondef('public.prepare_pqrs_document(uuid,uuid,text,text,bigint)'::regprocedure) like '%pm.user_id=auth.uid()%' as solo_autor_adjunta,
  has_function_privilege('authenticated','public.prepare_pqrs_document(uuid,uuid,text,text,bigint)','execute') as adjuntar_disponible;
