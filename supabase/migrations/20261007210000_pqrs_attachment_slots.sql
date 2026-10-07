-- Count reserved slots without exposing rejected files or weakening document RLS.
begin;
create or replace function public.pqrs_attachment_slots_used(target_pqrs_id uuid)
returns integer language plpgsql stable security definer set search_path='' as $$
declare target_property uuid; occupied integer;
begin
  select property_id into target_property from public.pqrs where id=target_pqrs_id;
  if target_property is null or not private.is_active_member(target_property) or not private.can_read_pqrs(target_pqrs_id) then
    raise exception 'not_authorized';
  end if;
  select count(*)::integer into occupied from public.documents d
  where d.property_id=target_property and d.status in ('pending','available','rejected') and (
    d.pqrs_id=target_pqrs_id or exists(select 1 from public.pqrs_messages m where m.id=d.pqrs_message_id and m.pqrs_id=target_pqrs_id)
  );
  return occupied;
end;
$$;
revoke all on function public.pqrs_attachment_slots_used(uuid) from public,anon,authenticated;
grant execute on function public.pqrs_attachment_slots_used(uuid) to authenticated;
notify pgrst,'reload schema';
commit;