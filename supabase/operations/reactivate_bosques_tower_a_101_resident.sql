-- Reparación puntual de una cuenta suspendida: reactiva la membresía y restaura
-- Torre A · 101, conservando el vínculo anterior y su acceso financiero.
begin;

do $restore$
declare
  target_property_id constant uuid := '1bde3475-3ed2-4f57-bd13-39784b12d2a6';
  target_email constant text := 'alejoruizm11@gmail.com';
  target_member public.property_members%rowtype;
  target_unit_id uuid;
  historical_link public.unit_memberships%rowtype;
  restored_link_id uuid;
  property_creator_id uuid;
begin
  select pm.* into strict target_member
  from public.property_members pm
  join auth.users au on au.id = pm.user_id
  where pm.property_id = target_property_id and lower(au.email) = target_email
  for update of pm;

  if target_member.roles <> array['member']::text[]
    or target_member.status not in ('active', 'suspended') then
    raise exception 'unexpected_resident_account_state';
  end if;

  select u.id into strict target_unit_id
  from public.units u
  join public.buildings b on b.id = u.building_id and b.property_id = u.property_id
  where u.property_id = target_property_id
    and b.name = 'Torre A' and b.active
    and u.code = '101' and u.status = 'active';

  if exists (
    select 1 from public.unit_memberships um
    where um.property_id = target_property_id
      and um.member_id = target_member.id
      and um.valid_to is null
  ) then
    raise exception 'resident_already_has_an_active_apartment';
  end if;

  select um.* into strict historical_link
  from public.unit_memberships um
  where um.property_id = target_property_id
    and um.unit_id = target_unit_id
    and um.member_id = target_member.id
    and um.valid_to is not null
  order by um.valid_to desc
  limit 1;

  select p.created_by into strict property_creator_id
  from public.properties p where p.id = target_property_id;

  update public.property_members
  set status = 'active', revoked_at = null
  where id = target_member.id and status = 'suspended';
  if found then
    perform private.write_property_audit(
      target_property_id, 'member.reactivated', 'property_member', target_member.id,
      pg_catalog.jsonb_build_object('reason', 'Resident requested restoration of Torre A 101')
    );
  end if;

  insert into public.unit_memberships
    (property_id, unit_id, member_id, relationship, finance_access, created_by)
  values
    (target_property_id, target_unit_id, target_member.id,
     historical_link.relationship, historical_link.finance_access, property_creator_id)
  returning id into restored_link_id;

  perform private.write_property_audit(
    target_property_id, 'unit_membership.restored', 'unit_membership', restored_link_id,
    pg_catalog.jsonb_build_object(
      'previous_link_id', historical_link.id,
      'reason', 'Resident requested restoration of Torre A 101'
    )
  );
end;
$restore$;

commit;

select
  'bosques_torre_a_101_resident_reactivated_and_restored' as result,
  (select pm.status from public.property_members pm
   join auth.users au on au.id = pm.user_id
   where pm.property_id = '1bde3475-3ed2-4f57-bd13-39784b12d2a6'
     and lower(au.email) = 'alejoruizm11@gmail.com') as account_status,
  count(*) as active_links,
  bool_or(um.finance_access) as finance_access
from public.unit_memberships um
join public.property_members pm on pm.id = um.member_id
join auth.users au on au.id = pm.user_id
join public.units u on u.id = um.unit_id
join public.buildings b on b.id = u.building_id
where um.property_id = '1bde3475-3ed2-4f57-bd13-39784b12d2a6'
  and lower(au.email) = 'alejoruizm11@gmail.com'
  and b.name = 'Torre A' and u.code = '101'
  and um.valid_to is null;
