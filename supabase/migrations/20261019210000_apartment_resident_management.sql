-- Gestión de ocupantes desde el apartamento, sin borrar vínculos históricos.
create or replace function public.assign_apartment_resident(
  target_property_id uuid,
  target_unit_id uuid,
  target_email text,
  target_relationship text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(trim(target_email));
  target_user_id uuid;
  target_member public.property_members%rowtype;
  current_link public.unit_memberships%rowtype;
  invitation_token text;
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if normalized_email is null or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  if target_relationship is null or target_relationship not in ('owner', 'resident') then raise exception 'invalid_relationship'; end if;
  if not exists (select 1 from public.units where id=target_unit_id and property_id=target_property_id and status='active') then raise exception 'invalid_unit'; end if;

  select id into target_user_id from auth.users where lower(email)=normalized_email limit 1;
  if target_user_id is not null then
    select * into target_member from public.property_members
    where property_id=target_property_id and user_id=target_user_id for update;
  end if;

  if target_member.id is null then
    invitation_token := public.create_invitation(target_property_id, normalized_email, array['member']::text[], target_unit_id, target_relationship, 72);
    return invitation_token;
  end if;

  if not ('member'=any(target_member.roles)) or 'administrator'=any(target_member.roles) or 'concierge'=any(target_member.roles) then
    raise exception 'not_a_resident';
  end if;

  select * into current_link from public.unit_memberships
  where property_id=target_property_id and unit_id=target_unit_id and member_id=target_member.id and valid_to is null
  order by created_at desc limit 1 for update;

  if current_link.id is null then
    insert into public.unit_memberships(property_id,unit_id,member_id,relationship,created_by)
    values(target_property_id,target_unit_id,target_member.id,target_relationship,auth.uid());
  elsif current_link.relationship <> target_relationship then
    update public.unit_memberships set relationship=target_relationship where id=current_link.id;
  end if;

  update public.property_members set status='active',revoked_at=null
  where id=target_member.id and status<>'active';
  perform private.write_property_audit(target_property_id,'apartment_resident.assigned','unit',target_unit_id,
    pg_catalog.jsonb_build_object('member_id',target_member.id,'relationship',target_relationship));
  return null;
end;
$$;

create or replace function public.update_apartment_relationship(
  target_property_id uuid,
  target_unit_membership_id uuid,
  target_relationship text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if target_relationship is null or target_relationship not in ('owner','resident') then raise exception 'invalid_relationship'; end if;
  update public.unit_memberships set relationship=target_relationship
  where property_id=target_property_id and id=target_unit_membership_id and valid_to is null;
  if not found then raise exception 'unit_membership_not_found'; end if;
  perform private.write_property_audit(target_property_id,'unit_membership.relationship_updated','unit_membership',target_unit_membership_id,
    pg_catalog.jsonb_build_object('relationship',target_relationship));
end;
$$;

create or replace function public.end_unit_membership(
  target_property_id uuid,
  target_unit_membership_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare target_member_id uuid; member_roles text[];
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  update public.unit_memberships
  set valid_to=greatest(now(),valid_from + interval '1 microsecond')
  where property_id=target_property_id and id=target_unit_membership_id and valid_to is null
  returning member_id into target_member_id;
  if target_member_id is null then raise exception 'unit_membership_not_found'; end if;

  select roles into member_roles from public.property_members
  where property_id=target_property_id and id=target_member_id for update;
  if 'member'=any(member_roles) and not ('administrator'=any(member_roles)) and not ('concierge'=any(member_roles))
    and not exists(select 1 from public.unit_memberships where property_id=target_property_id and member_id=target_member_id and valid_to is null)
  then
    update public.property_members set status='suspended'
    where id=target_member_id and status='active';
  end if;

  perform private.write_property_audit(target_property_id,'unit_membership.ended','unit_membership',target_unit_membership_id,
    pg_catalog.jsonb_build_object('member_id',target_member_id));
end;
$$;

revoke all on function public.assign_apartment_resident(uuid,uuid,text,text) from public,anon;
revoke all on function public.update_apartment_relationship(uuid,uuid,text) from public,anon;
revoke all on function public.end_unit_membership(uuid,uuid) from public,anon;
grant execute on function public.assign_apartment_resident(uuid,uuid,text,text) to authenticated;
grant execute on function public.update_apartment_relationship(uuid,uuid,text) to authenticated;
grant execute on function public.end_unit_membership(uuid,uuid) to authenticated;
