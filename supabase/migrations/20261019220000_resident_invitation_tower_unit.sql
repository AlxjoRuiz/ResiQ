-- Solo las invitaciones vinculan nuevos residentes a apartamentos existentes.
drop function if exists public.assign_apartment_resident(uuid,uuid,text,text);
revoke execute on function public.create_unit_membership(uuid,uuid,uuid,text) from authenticated;

create or replace function public.create_resident_invitation(
  target_property_id uuid,
  target_building_id uuid,
  target_unit_id uuid,
  target_email text,
  target_relationship text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(trim(target_email));
  existing_member_id uuid;
  existing_roles text[];
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  if target_relationship is null or target_relationship not in ('owner','resident') then raise exception 'invalid_relationship'; end if;
  if not exists (
    select 1 from public.buildings b join public.units u on u.building_id=b.id and u.property_id=b.property_id
    where b.property_id=target_property_id and b.id=target_building_id and b.active
      and u.id=target_unit_id and u.status='active'
  ) then raise exception 'unit_not_in_building'; end if;

  select pm.id,pm.roles into existing_member_id,existing_roles
  from public.property_members pm join auth.users au on au.id=pm.user_id
  where pm.property_id=target_property_id and lower(au.email)=normalized_email;
  if existing_member_id is not null then
    if not ('member'=any(existing_roles)) or 'administrator'=any(existing_roles) or 'concierge'=any(existing_roles) then
      raise exception 'not_a_resident';
    end if;
    if exists (
      select 1 from public.unit_memberships um
      where um.property_id=target_property_id and um.unit_id=target_unit_id
        and um.member_id=existing_member_id and um.valid_to is null
    ) then raise exception 'already_assigned'; end if;
  end if;

  return public.create_invitation(target_property_id,normalized_email,array['member']::text[],target_unit_id,target_relationship,72);
end;
$$;

-- Un usuario que ya pertenece al conjunto puede aceptar una invitación a otro apartamento,
-- o reactivar su membresía suspendida, sin duplicar vínculos ni perder el historial.
create or replace function public.accept_invitation(invitation_token text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations%rowtype;
  target_member public.property_members%rowtype;
  current_link public.unit_memberships%rowtype;
  actor_email text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  actor_email := lower(coalesce(auth.jwt() ->> 'email',''));
  select * into inv from public.invitations
  where token_hash=encode(extensions.digest(invitation_token,'sha256'),'hex') and status='pending'
  for update;
  if not found or inv.expires_at<=now() then raise exception 'invalid_invitation'; end if;
  if actor_email='' or actor_email<>inv.email_normalized then raise exception 'email_mismatch'; end if;
  if inv.unit_id is not null and not exists (
    select 1 from public.units where id=inv.unit_id and property_id=inv.property_id and status='active'
  ) then raise exception 'invalid_unit'; end if;

  select * into target_member from public.property_members
  where property_id=inv.property_id and user_id=auth.uid() for update;
  if target_member.id is null then
    insert into public.property_members(property_id,user_id,roles,status,created_by)
    values(inv.property_id,auth.uid(),inv.roles,'active',inv.invited_by)
    returning * into target_member;
  elsif inv.roles=array['member']::text[] and target_member.roles=array['member']::text[] then
    update public.property_members set status='active',revoked_at=null
    where id=target_member.id and status<>'active';
  else
    raise exception 'membership_exists';
  end if;

  if inv.unit_id is not null then
    select * into current_link from public.unit_memberships
    where property_id=inv.property_id and unit_id=inv.unit_id and member_id=target_member.id and valid_to is null
    order by created_at desc limit 1 for update;
    if current_link.id is null then
      insert into public.unit_memberships(property_id,unit_id,member_id,relationship,created_by)
      values(inv.property_id,inv.unit_id,target_member.id,inv.relationship,inv.invited_by);
    else
      raise exception 'already_assigned';
    end if;
  end if;

  update public.invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now(),updated_at=now()
  where id=inv.id;
  return target_member.id;
end;
$$;

revoke all on function public.create_resident_invitation(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.create_resident_invitation(uuid,uuid,uuid,text,text) to authenticated;
revoke all on function public.accept_invitation(text) from public,anon;
grant execute on function public.accept_invitation(text) to authenticated;
