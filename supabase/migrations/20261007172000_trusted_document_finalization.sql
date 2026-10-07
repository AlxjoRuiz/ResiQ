-- Browser JWTs may prepare/upload, but cannot publish files without server validation.
revoke all on function public.complete_pqrs_document(uuid),public.complete_attention_call_document(uuid),public.complete_assembly_document(uuid) from public,anon,authenticated,service_role;

create or replace function public.complete_verified_document(target_document_id uuid,target_actor_id uuid,target_size_bytes bigint,target_mime_type text)
returns void language plpgsql security definer set search_path='' as $$
declare d public.documents%rowtype;
  previous_claims text:=current_setting('request.jwt.claims',true);
  previous_sub text:=current_setting('request.jwt.claim.sub',true);
  previous_role text:=current_setting('request.jwt.claim.role',true);
begin
  select * into d from public.documents where id=target_document_id for update;
  if not found or target_actor_id is null or d.uploaded_by<>target_actor_id or d.status<>'pending'
    or target_size_bytes is distinct from d.size_bytes or target_mime_type is distinct from d.mime_type
    then raise exception 'invalid_validated_document'; end if;
  if not exists(select 1 from storage.objects where bucket_id=d.bucket and name=d.object_path) then raise exception 'file_missing'; end if;
  -- Only the service-role caller can supply a verified actor. Restore context on both paths.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',target_actor_id,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',target_actor_id::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  if not private.is_active_member(d.property_id) then raise exception 'not_authorized'; end if;
  if d.pqrs_id is not null or d.pqrs_message_id is not null then
    perform public.complete_pqrs_document(d.id);
  elsif d.attention_call_id is not null then
    perform public.complete_attention_call_document(d.id);
  else
    if d.assembly_representation_id is not null and not private.is_active_member(d.property_id,'administrator') and not exists(
      select 1 from public.assembly_representations ar join public.unit_memberships um on um.member_id=ar.grantor_member_id and um.property_id=ar.property_id and um.unit_id=ar.unit_id
      join public.property_members pm on pm.id=ar.grantor_member_id and pm.property_id=ar.property_id
      where ar.id=d.assembly_representation_id and pm.user_id=target_actor_id and pm.status='active' and 'member'=any(pm.roles)
        and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
    ) then raise exception 'not_authorized'; end if;
    perform public.complete_assembly_document(d.id);
  end if;
  perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(previous_role,''),true);
exception when others then
  perform set_config('request.jwt.claims',coalesce(previous_claims,''),true);
  perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
  perform set_config('request.jwt.claim.role',coalesce(previous_role,''),true);
  raise;
end;
$$;
revoke all on function public.complete_verified_document(uuid,uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.complete_verified_document(uuid,uuid,bigint,text) to service_role;
notify pgrst,'reload schema';
