-- Comunicados para toda la comunidad (decisión de Alejandro, 25/10/2026): ya no se eligen
-- destinatarios; el comunicado llega a todas las cuentas activas de la propiedad (residentes,
-- portería y administración). Reemplaza create_published_announcement de
-- 20261025200000_announcement_attachments.sql sin el parámetro de destinatarios.
begin;

drop function public.create_published_announcement(uuid,text,text,uuid[],uuid[],uuid);

create function public.create_published_announcement(
  target_property_id uuid,target_subject text,target_body text,target_upload_ids uuid[],target_request_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); actor_member_id uuid; created_id uuid; staged public.announcement_upload_staging%rowtype;
  upload_count integer:=0; recipient_count integer;
begin
  select pm.id into actor_member_id from public.property_members pm
  join public.properties p on p.id=pm.property_id and p.status='active'
  where pm.property_id=target_property_id and pm.user_id=actor_id and pm.status='active' and 'administrator'=any(pm.roles);
  if actor_id is null or actor_member_id is null then raise exception 'not_authorized'; end if;
  if target_request_id is null or char_length(trim(coalesce(target_subject,''))) not between 5 and 160 or
     char_length(trim(coalesce(target_body,''))) not between 10 and 4000 then raise exception 'invalid_input'; end if;
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

  insert into public.announcements(property_id,author_member_id,subject,body,creation_request_id)
  values(target_property_id,actor_member_id,trim(target_subject),trim(target_body),target_request_id) returning id into created_id;
  insert into public.announcement_recipients(property_id,announcement_id,member_id)
  select target_property_id,created_id,pm.id from public.property_members pm where pm.property_id=target_property_id and pm.status='active';
  get diagnostics recipient_count=row_count;
  insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,status,announcement_id)
  select s.id,target_property_id,s.object_path,s.original_name,s.mime_type,s.size_bytes,actor_id,'available',created_id
  from public.announcement_upload_staging s where s.id=any(target_upload_ids);
  update public.announcement_upload_staging set status='consumed',announcement_id=created_id where id=any(target_upload_ids);
  perform private.write_property_audit(target_property_id,'announcement.created','announcement',created_id,jsonb_build_object('recipient_count',recipient_count,'audience','all_active_members'));
  perform public.publish_announcement(created_id);
  return created_id;
end;
$$;
revoke all on function public.create_published_announcement(uuid,text,text,uuid[],uuid) from public,anon;
grant execute on function public.create_published_announcement(uuid,text,text,uuid[],uuid) to authenticated;

notify pgrst,'reload schema';
commit;

select
  has_function_privilege('authenticated','public.create_published_announcement(uuid,text,text,uuid[],uuid)','execute') as publicar_para_todos,
  to_regprocedure('public.create_published_announcement(uuid,text,text,uuid[],uuid[],uuid)') is null as version_con_destinatarios_retirada;
