-- Módulo de mantenimiento, entrega 1: acceso (28/10/2026, decisión de Alejandro).
-- Un solo equipo de mantenimiento de ResiQ, a nivel plataforma: no pertenece a ningún conjunto.
-- * maintenance_staff: cuentas del equipo con rol «admin» (admin de mantenimiento) o «worker»
--   (trabajador; se crean en la entrega 2).
-- * maintenance_invitations: el superadmin invita al admin de mantenimiento con un enlace a su correo
--   (mismo flujo /invitacion que el admin del conjunto). Solo se guarda el hash del código.
-- Los admins de los conjuntos no ven nada de este módulo.
begin;

create table public.maintenance_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  role text not null check (role in ('admin','worker')),
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger maintenance_staff_set_updated_at before update on public.maintenance_staff for each row execute function private.set_updated_at();
alter table public.maintenance_staff enable row level security;
-- Cada cuenta lee solo su propia fila (para saber su rol); el resto pasa por funciones.
create policy maintenance_staff_read_own on public.maintenance_staff for select to authenticated using (user_id = auth.uid());
grant select on public.maintenance_staff to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.maintenance_staff from authenticated;
revoke all on public.maintenance_staff from anon;

-- ¿La sesión es del equipo de mantenimiento (y, si se indica, con ese rol)?
create or replace function private.is_maintenance_staff(required_role text default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.maintenance_staff s
    where s.user_id = auth.uid() and s.status = 'active' and (required_role is null or s.role = required_role));
$$;
revoke all on function private.is_maintenance_staff(text) from public, anon;
grant execute on function private.is_maintenance_staff(text) to authenticated;

create table public.maintenance_invitations (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null check (email_normalized = lower(trim(email_normalized))),
  token_hash text not null unique,
  role text not null default 'admin' check (role = 'admin'),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  expires_at timestamptz not null,
  link_issued_at timestamptz,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  accepted_by uuid references public.profiles(id) on delete restrict,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'accepted') = (accepted_by is not null and accepted_at is not null))
);
alter table public.maintenance_invitations enable row level security;
revoke all on public.maintenance_invitations from public, anon, authenticated;

-- Superadmin: invita al admin de mantenimiento y obtiene el enlace (7 días).
create or replace function public.platform_invite_maintenance_admin(target_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare normalized_email text := lower(trim(coalesce(target_email, ''))); raw_token text;
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  if char_length(normalized_email) > 254 or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  if exists(select 1 from public.maintenance_staff s join auth.users u on u.id = s.user_id
            where lower(u.email) = normalized_email and s.status <> 'revoked') then raise exception 'already_member'; end if;
  update public.maintenance_invitations set status = 'revoked', updated_at = now() where email_normalized = normalized_email and status = 'pending';
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.maintenance_invitations(email_normalized, token_hash, expires_at, link_issued_at, invited_by)
  values (normalized_email, encode(extensions.digest(raw_token, 'sha256'), 'hex'), now() + interval '7 days', now(), auth.uid());
  return raw_token;
end;
$$;

-- Superadmin: enlace nuevo de 7 días para una invitación pendiente o vencida (el anterior deja de servir).
create or replace function public.platform_reissue_maintenance_invitation(target_invitation_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text;
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.maintenance_invitations set token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    expires_at = now() + interval '7 days', link_issued_at = now(), updated_at = now()
  where id = target_invitation_id and status = 'pending';
  if not found then raise exception 'invitation_not_found'; end if;
  return raw_token;
end;
$$;

-- Superadmin: admins de mantenimiento y sus invitaciones pendientes.
create or replace function public.platform_list_maintenance_admins()
returns table(staff_id uuid, invitation_id uuid, display_name text, email text, member_status text, since timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query
  select s.id, null::uuid, p.display_name, u.email::text, s.status, s.created_at
  from public.maintenance_staff s join public.profiles p on p.id = s.user_id join auth.users u on u.id = s.user_id
  where s.role = 'admin' and s.status <> 'revoked'
  union all
  select null::uuid, i.id, null::text, i.email_normalized, case when i.expires_at > now() then 'invited' else 'expired' end, i.created_at
  from public.maintenance_invitations i where i.status = 'pending'
  order by 6 desc;
end;
$$;

-- Aceptar la invitación con la cuenta del correo invitado: queda como admin de mantenimiento.
create or replace function public.accept_maintenance_invitation(invitation_token text)
returns text language plpgsql security definer set search_path = '' as $$
declare inv public.maintenance_invitations%rowtype; actor_email text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  actor_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select * into inv from public.maintenance_invitations
  where token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex') and status = 'pending' for update;
  if not found or inv.expires_at <= now() then raise exception 'invalid_invitation'; end if;
  if actor_email = '' or actor_email <> inv.email_normalized then raise exception 'email_mismatch'; end if;
  if exists(select 1 from public.maintenance_staff where user_id = auth.uid() and status = 'active') then raise exception 'membership_exists'; end if;
  insert into public.maintenance_staff(user_id, role, status, created_by) values (auth.uid(), inv.role, 'active', inv.invited_by)
  on conflict (user_id) do update set role = excluded.role, status = 'active', updated_at = now();
  update public.maintenance_invitations set status = 'accepted', accepted_by = auth.uid(), accepted_at = now(), updated_at = now() where id = inv.id;
  return inv.role;
end;
$$;

revoke all on function public.platform_invite_maintenance_admin(text), public.platform_reissue_maintenance_invitation(uuid),
  public.platform_list_maintenance_admins(), public.accept_maintenance_invitation(text) from public, anon;
grant execute on function public.platform_invite_maintenance_admin(text), public.platform_reissue_maintenance_invitation(uuid),
  public.platform_list_maintenance_admins(), public.accept_maintenance_invitation(text) to authenticated;

commit;

select
  exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'maintenance_staff') as equipo_mantenimiento,
  not has_table_privilege('authenticated', 'public.maintenance_invitations', 'select') as invitaciones_protegidas,
  has_function_privilege('authenticated', 'public.platform_invite_maintenance_admin(text)', 'execute')
    and not has_function_privilege('anon', 'public.platform_invite_maintenance_admin(text)', 'execute') as invitar_admin_mantenimiento,
  has_function_privilege('authenticated', 'public.accept_maintenance_invitation(text)', 'execute') as aceptar_invitacion_mantenimiento;
