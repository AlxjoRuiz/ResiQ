-- Inactivar un residente libera sus apartamentos sin borrar el historial.
-- Solo una nueva invitación puede reactivar a un residente sin vínculo vigente.
create or replace function public.manage_property_member(
  target_property_id uuid,
  target_member_id uuid,
  target_roles text[],
  target_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_roles text[];
  existing_status text;
  ended_links integer := 0;
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if cardinality(target_roles) = 0
    or not (target_roles <@ array['member', 'concierge']::text[])
    or not private.text_array_is_unique(target_roles)
  then raise exception 'invalid_roles'; end if;
  if target_status not in ('active', 'suspended', 'revoked') then raise exception 'invalid_status'; end if;

  select roles, status into existing_roles, existing_status
  from public.property_members
  where property_id = target_property_id and id = target_member_id
  for update;
  if not found then raise exception 'member_not_found'; end if;
  if 'administrator' = any(existing_roles) then raise exception 'administrator_protected'; end if;

  if target_status = 'active' and existing_status <> 'active'
    and target_roles = array['member']::text[]
    and not exists (
      select 1 from public.unit_memberships
      where property_id = target_property_id and member_id = target_member_id
        and valid_from <= now() and (valid_to is null or valid_to > now())
    )
  then raise exception 'resident_requires_invitation'; end if;

  update public.property_members
  set roles = target_roles,
      status = target_status,
      revoked_at = case when target_status = 'revoked' then now() else null end
  where property_id = target_property_id and id = target_member_id;

  if target_status <> 'active' or not ('member' = any(target_roles)) then
    update public.unit_memberships
    set valid_to = greatest(now(), valid_from + interval '1 microsecond')
    where property_id = target_property_id and member_id = target_member_id and valid_to is null;
    get diagnostics ended_links = row_count;
  end if;

  perform private.write_property_audit(target_property_id, 'member.updated', 'property_member', target_member_id,
    pg_catalog.jsonb_build_object('roles', target_roles, 'status', target_status, 'ended_unit_links', ended_links));
end;
$$;
