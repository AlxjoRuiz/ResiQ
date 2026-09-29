-- Etapa 5: identidad, membresía mínima e invitaciones seguras.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.text_array_is_unique(values_to_check text[])
returns boolean language sql immutable set search_path = '' as $$
  select cardinality(values_to_check) = (select count(distinct item) from unnest(values_to_check) item);
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(display_name) between 2 and 80),
  avatar_url text null check (avatar_url is null or avatar_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  address text,
  city text,
  timezone text not null default 'America/Bogota',
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_members (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  roles text[] not null check (cardinality(roles) > 0 and roles <@ array['administrator','concierge','member']::text[] and private.text_array_is_unique(roles)),
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, user_id),
  unique (property_id, id),
  check ((status = 'revoked') = (revoked_at is not null))
);
create index property_members_user_status_idx on public.property_members(user_id, status);

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  name text not null,
  code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, code),
  unique (property_id, id)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  building_id uuid not null,
  code text not null,
  floor text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, building_id, code),
  unique (property_id, id),
  foreign key (property_id, building_id) references public.buildings(property_id, id) on delete restrict
);

create table public.unit_memberships (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  unit_id uuid not null,
  member_id uuid not null,
  relationship text not null check (relationship in ('owner','resident')),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  finance_access boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, id),
  foreign key (property_id, unit_id) references public.units(property_id, id) on delete restrict,
  foreign key (property_id, member_id) references public.property_members(property_id, id) on delete restrict,
  check (valid_to is null or valid_to > valid_from)
);
create index unit_memberships_member_idx on public.unit_memberships(property_id, member_id, unit_id);
create index unit_memberships_unit_valid_idx on public.unit_memberships(property_id, unit_id, valid_to);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  email_normalized text not null check (email_normalized = lower(trim(email_normalized))),
  token_hash text not null unique,
  roles text[] not null check (cardinality(roles) > 0 and roles <@ array['concierge','member']::text[] and private.text_array_is_unique(roles)),
  unit_id uuid,
  relationship text check (relationship in ('owner','resident')),
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  accepted_by uuid references public.profiles(id) on delete restrict,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, id),
  foreign key (property_id, unit_id) references public.units(property_id, id) on delete restrict,
  check ((unit_id is null and relationship is null) or (unit_id is not null and relationship is not null)),
  check (expires_at > created_at),
  check ((status = 'accepted') = (accepted_by is not null and accepted_at is not null))
);
create index invitations_property_email_status_idx on public.invitations(property_id, email_normalized, status);

create or replace function private.is_active_member(target_property_id uuid, required_role text default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.property_members pm
    join public.properties p on p.id = pm.property_id
    where pm.property_id = target_property_id and pm.user_id = auth.uid()
      and pm.status = 'active' and p.status = 'active'
      and (required_role is null or required_role = any(pm.roles))
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, avatar_url)
  values (
    new.id,
    case
      when char_length(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))) >= 2
        then left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 80)
      else 'Usuario'
    end,
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.create_invitation(
  target_property_id uuid,
  target_email text,
  target_roles text[],
  target_unit_id uuid default null,
  target_relationship text default null,
  valid_hours integer default 72
) returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text; normalized_email text;
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  normalized_email := lower(trim(target_email));
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  if cardinality(target_roles) = 0 or not (target_roles <@ array['concierge','member']::text[]) then raise exception 'invalid_roles'; end if;
  if valid_hours < 1 or valid_hours > 168 then raise exception 'invalid_expiration'; end if;
  if (target_unit_id is null) <> (target_relationship is null) then raise exception 'invalid_unit_relationship'; end if;
  if target_unit_id is not null and not exists(select 1 from public.units u where u.id=target_unit_id and u.property_id=target_property_id and u.status='active') then raise exception 'invalid_unit'; end if;
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.invitations set status='revoked', updated_at=now()
    where property_id=target_property_id and email_normalized=normalized_email and status='pending';
  insert into public.invitations(property_id,email_normalized,token_hash,roles,unit_id,relationship,expires_at,invited_by)
  values(target_property_id,normalized_email,encode(extensions.digest(raw_token,'sha256'),'hex'),target_roles,target_unit_id,target_relationship,now()+make_interval(hours=>valid_hours),auth.uid());
  return raw_token;
end;
$$;

create or replace function public.accept_invitation(invitation_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare inv public.invitations%rowtype; member_id uuid; actor_email text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  actor_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select * into inv from public.invitations
    where token_hash=encode(extensions.digest(invitation_token,'sha256'),'hex') and status='pending'
    for update;
  if not found or inv.expires_at <= now() then raise exception 'invalid_invitation'; end if;
  if actor_email = '' or actor_email <> inv.email_normalized then raise exception 'email_mismatch'; end if;
  insert into public.property_members(property_id,user_id,roles,status,created_by)
  values(inv.property_id,auth.uid(),inv.roles,'active',inv.invited_by)
  on conflict (property_id,user_id) do nothing returning id into member_id;
  if member_id is null then raise exception 'membership_exists'; end if;
  if inv.unit_id is not null and not exists (
    select 1 from public.unit_memberships um where um.property_id=inv.property_id and um.unit_id=inv.unit_id and um.member_id=member_id and um.relationship=inv.relationship and (um.valid_to is null or um.valid_to>now())
  ) then
    insert into public.unit_memberships(property_id,unit_id,member_id,relationship,created_by)
    values(inv.property_id,inv.unit_id,member_id,inv.relationship,inv.invited_by);
  end if;
  update public.invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now(),updated_at=now() where id=inv.id;
  return member_id;
end;
$$;

revoke all on function private.is_active_member(uuid,text) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_active_member(uuid,text) to authenticated;
revoke all on function public.create_invitation(uuid,text,text[],uuid,text,integer) from public, anon;
grant execute on function public.create_invitation(uuid,text,text[],uuid,text,integer) to authenticated;
revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_members enable row level security;
alter table public.buildings enable row level security;
alter table public.units enable row level security;
alter table public.unit_memberships enable row level security;
alter table public.invitations enable row level security;

create policy profiles_read_own on public.profiles for select to authenticated using (id=auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy properties_read_member on public.properties for select to authenticated using (private.is_active_member(id));
create policy members_read_self_or_admin on public.property_members for select to authenticated using (user_id=auth.uid() or private.is_active_member(property_id,'administrator'));
create policy buildings_read_member on public.buildings for select to authenticated using (private.is_active_member(property_id));
create policy units_read_authorized on public.units for select to authenticated using (
  private.is_active_member(property_id,'administrator') or private.is_active_member(property_id,'concierge') or exists(
    select 1 from public.unit_memberships um join public.property_members pm on pm.id=um.member_id and pm.property_id=um.property_id
    where um.property_id=units.property_id and um.unit_id=units.id and pm.user_id=auth.uid() and pm.status='active' and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
  )
);
create policy unit_memberships_read_self_or_admin on public.unit_memberships for select to authenticated using (
  private.is_active_member(property_id,'administrator') or exists(select 1 from public.property_members pm where pm.id=member_id and pm.property_id=unit_memberships.property_id and pm.user_id=auth.uid() and pm.status='active')
);
grant select on public.profiles,public.properties,public.property_members,public.buildings,public.units,public.unit_memberships to authenticated;
grant update(display_name,avatar_url) on public.profiles to authenticated;
