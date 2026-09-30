-- Etapa 6: gestión multi-tenant de propiedades, estructura, miembros y vínculos.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  scope text not null check (scope in ('platform', 'property')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  occurred_at timestamptz not null default now(),
  request_id uuid not null default gen_random_uuid(),
  ip inet,
  metadata jsonb not null default '{}'::jsonb,
  check ((scope = 'property' and property_id is not null) or (scope = 'platform' and property_id is null))
);
create index audit_logs_property_occurred_idx on public.audit_logs(property_id, occurred_at desc);
create index audit_logs_actor_occurred_idx on public.audit_logs(actor_id, occurred_at desc);
create index audit_logs_request_idx on public.audit_logs(request_id);

alter table public.audit_logs enable row level security;
create policy audit_logs_read_property_admin on public.audit_logs
for select to authenticated
using (scope = 'property' and private.is_active_member(property_id, 'administrator'));
grant select on public.audit_logs to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger properties_set_updated_at before update on public.properties
for each row execute function private.set_updated_at();
create trigger property_members_set_updated_at before update on public.property_members
for each row execute function private.set_updated_at();
create trigger buildings_set_updated_at before update on public.buildings
for each row execute function private.set_updated_at();
create trigger units_set_updated_at before update on public.units
for each row execute function private.set_updated_at();
create trigger unit_memberships_set_updated_at before update on public.unit_memberships
for each row execute function private.set_updated_at();
create trigger invitations_set_updated_at before update on public.invitations
for each row execute function private.set_updated_at();

create unique index unit_memberships_current_unique_idx
on public.unit_memberships(property_id, unit_id, member_id, relationship)
where valid_to is null;

create policy profiles_read_property_admin on public.profiles
for select to authenticated
using (
  exists (
    select 1
    from public.property_members target_member
    where target_member.user_id = profiles.id
      and private.is_active_member(target_member.property_id, 'administrator')
  )
);

drop policy unit_memberships_read_self_or_admin on public.unit_memberships;
create policy unit_memberships_read_self_or_admin on public.unit_memberships
for select to authenticated
using (
  private.is_active_member(property_id, 'administrator')
  or exists (
    select 1
    from public.property_members pm
    where pm.id = unit_memberships.member_id
      and pm.property_id = unit_memberships.property_id
      and pm.user_id = auth.uid()
      and pm.status = 'active'
      and unit_memberships.valid_from <= now()
      and (unit_memberships.valid_to is null or unit_memberships.valid_to > now())
  )
);

create or replace function private.write_property_audit(
  target_property_id uuid,
  target_action text,
  target_entity_type text,
  target_entity_id uuid,
  target_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values(target_property_id, auth.uid(), 'property', target_action, target_entity_type, target_entity_id, coalesce(target_metadata, '{}'::jsonb));
$$;
revoke all on function private.write_property_audit(uuid, text, text, uuid, jsonb) from public, anon, authenticated;

create or replace function public.update_property_details(
  target_property_id uuid,
  target_name text,
  target_address text,
  target_city text,
  target_timezone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := trim(target_name);
  clean_address text := nullif(trim(target_address), '');
  clean_city text := nullif(trim(target_city), '');
begin
  if not private.is_active_member(target_property_id, 'administrator') then
    raise exception 'not_authorized';
  end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 120 then
    raise exception 'invalid_name';
  end if;
  if clean_address is not null and char_length(clean_address) > 180 then
    raise exception 'invalid_address';
  end if;
  if clean_city is not null and char_length(clean_city) > 80 then
    raise exception 'invalid_city';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = target_timezone) then
    raise exception 'invalid_timezone';
  end if;

  update public.properties
  set name = clean_name, address = clean_address, city = clean_city, timezone = target_timezone
  where id = target_property_id;

  perform private.write_property_audit(target_property_id, 'property.updated', 'property', target_property_id);
end;
$$;

create or replace function public.create_building(
  target_property_id uuid,
  target_name text,
  target_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
  clean_name text := trim(target_name);
  clean_code text := upper(trim(target_code));
begin
  if not private.is_active_member(target_property_id, 'administrator') then
    raise exception 'not_authorized';
  end if;
  if char_length(clean_name) < 1 or char_length(clean_name) > 80 then raise exception 'invalid_name'; end if;
  if clean_code !~ '^[A-Z0-9][A-Z0-9 -]{0,19}$' then raise exception 'invalid_code'; end if;

  insert into public.buildings(property_id, name, code)
  values(target_property_id, clean_name, clean_code)
  returning id into created_id;

  perform private.write_property_audit(target_property_id, 'building.created', 'building', created_id);
  return created_id;
end;
$$;

create or replace function public.update_building(
  target_property_id uuid,
  target_building_id uuid,
  target_name text,
  target_code text,
  target_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := trim(target_name);
  clean_code text := upper(trim(target_code));
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if char_length(clean_name) < 1 or char_length(clean_name) > 80 then raise exception 'invalid_name'; end if;
  if clean_code !~ '^[A-Z0-9][A-Z0-9 -]{0,19}$' then raise exception 'invalid_code'; end if;
  if not target_active and exists (
    select 1 from public.units where property_id = target_property_id and building_id = target_building_id and status = 'active'
  ) then raise exception 'building_has_active_units'; end if;

  update public.buildings
  set name = clean_name, code = clean_code, active = target_active
  where property_id = target_property_id and id = target_building_id;
  if not found then raise exception 'building_not_found'; end if;

  perform private.write_property_audit(target_property_id, 'building.updated', 'building', target_building_id,
    pg_catalog.jsonb_build_object('active', target_active));
end;
$$;

create or replace function public.create_unit(
  target_property_id uuid,
  target_building_id uuid,
  target_code text,
  target_floor text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_id uuid;
  clean_code text := trim(target_code);
  clean_floor text := nullif(trim(target_floor), '');
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if char_length(clean_code) < 1 or char_length(clean_code) > 30 then raise exception 'invalid_code'; end if;
  if clean_floor is not null and char_length(clean_floor) > 20 then raise exception 'invalid_floor'; end if;
  if not exists (
    select 1 from public.buildings where property_id = target_property_id and id = target_building_id and active
  ) then raise exception 'invalid_building'; end if;

  insert into public.units(property_id, building_id, code, floor)
  values(target_property_id, target_building_id, clean_code, clean_floor)
  returning id into created_id;

  perform private.write_property_audit(target_property_id, 'unit.created', 'unit', created_id,
    pg_catalog.jsonb_build_object('building_id', target_building_id));
  return created_id;
end;
$$;

create or replace function public.update_unit(
  target_property_id uuid,
  target_unit_id uuid,
  target_building_id uuid,
  target_code text,
  target_floor text,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_code text := trim(target_code);
  clean_floor text := nullif(trim(target_floor), '');
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if char_length(clean_code) < 1 or char_length(clean_code) > 30 then raise exception 'invalid_code'; end if;
  if clean_floor is not null and char_length(clean_floor) > 20 then raise exception 'invalid_floor'; end if;
  if target_status not in ('active', 'inactive') then raise exception 'invalid_status'; end if;
  if not exists (
    select 1 from public.buildings
    where property_id = target_property_id and id = target_building_id and (active or target_status = 'inactive')
  ) then raise exception 'invalid_building'; end if;

  update public.units
  set building_id = target_building_id, code = clean_code, floor = clean_floor, status = target_status
  where property_id = target_property_id and id = target_unit_id;
  if not found then raise exception 'unit_not_found'; end if;

  perform private.write_property_audit(target_property_id, 'unit.updated', 'unit', target_unit_id,
    pg_catalog.jsonb_build_object('building_id', target_building_id, 'status', target_status));
end;
$$;

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
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if cardinality(target_roles) = 0
    or not (target_roles <@ array['member', 'concierge']::text[])
    or not private.text_array_is_unique(target_roles)
  then raise exception 'invalid_roles'; end if;
  if target_status not in ('active', 'suspended', 'revoked') then raise exception 'invalid_status'; end if;

  select roles into existing_roles
  from public.property_members
  where property_id = target_property_id and id = target_member_id
  for update;
  if not found then raise exception 'member_not_found'; end if;
  if 'administrator' = any(existing_roles) then raise exception 'administrator_protected'; end if;

  update public.property_members
  set roles = target_roles,
      status = target_status,
      revoked_at = case when target_status = 'revoked' then now() else null end
  where property_id = target_property_id and id = target_member_id;

  if target_status = 'revoked' or not ('member' = any(target_roles)) then
    update public.unit_memberships
    set valid_to = greatest(now(), valid_from + interval '1 microsecond')
    where property_id = target_property_id and member_id = target_member_id and valid_to is null;
  end if;

  perform private.write_property_audit(target_property_id, 'member.updated', 'property_member', target_member_id,
    pg_catalog.jsonb_build_object('roles', target_roles, 'status', target_status));
end;
$$;

create or replace function public.create_unit_membership(
  target_property_id uuid,
  target_member_id uuid,
  target_unit_id uuid,
  target_relationship text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare created_id uuid;
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if target_relationship not in ('owner', 'resident') then raise exception 'invalid_relationship'; end if;
  if not exists (
    select 1 from public.property_members
    where property_id = target_property_id and id = target_member_id and status = 'active' and 'member' = any(roles)
  ) then raise exception 'invalid_member'; end if;
  if not exists (
    select 1 from public.units where property_id = target_property_id and id = target_unit_id and status = 'active'
  ) then raise exception 'invalid_unit'; end if;

  insert into public.unit_memberships(property_id, unit_id, member_id, relationship, created_by)
  values(target_property_id, target_unit_id, target_member_id, target_relationship, auth.uid())
  returning id into created_id;

  perform private.write_property_audit(target_property_id, 'unit_membership.created', 'unit_membership', created_id,
    pg_catalog.jsonb_build_object('member_id', target_member_id, 'unit_id', target_unit_id, 'relationship', target_relationship));
  return created_id;
end;
$$;

create or replace function public.end_unit_membership(
  target_property_id uuid,
  target_unit_membership_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;

  update public.unit_memberships
  set valid_to = greatest(now(), valid_from + interval '1 microsecond')
  where property_id = target_property_id and id = target_unit_membership_id and valid_to is null;
  if not found then raise exception 'unit_membership_not_found'; end if;

  perform private.write_property_audit(target_property_id, 'unit_membership.ended', 'unit_membership', target_unit_membership_id);
end;
$$;

revoke all on function public.update_property_details(uuid, text, text, text, text) from public, anon;
revoke all on function public.create_building(uuid, text, text) from public, anon;
revoke all on function public.update_building(uuid, uuid, text, text, boolean) from public, anon;
revoke all on function public.create_unit(uuid, uuid, text, text) from public, anon;
revoke all on function public.update_unit(uuid, uuid, uuid, text, text, text) from public, anon;
revoke all on function public.manage_property_member(uuid, uuid, text[], text) from public, anon;
revoke all on function public.create_unit_membership(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.end_unit_membership(uuid, uuid) from public, anon;

grant execute on function public.update_property_details(uuid, text, text, text, text) to authenticated;
grant execute on function public.create_building(uuid, text, text) to authenticated;
grant execute on function public.update_building(uuid, uuid, text, text, boolean) to authenticated;
grant execute on function public.create_unit(uuid, uuid, text, text) to authenticated;
grant execute on function public.update_unit(uuid, uuid, uuid, text, text, text) to authenticated;
grant execute on function public.manage_property_member(uuid, uuid, text[], text) to authenticated;
grant execute on function public.create_unit_membership(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.end_unit_membership(uuid, uuid) to authenticated;
