-- Panel de plataforma (superadmin, 26/10/2026): administradores por conjunto, cifras de usuarios,
-- planes, métricas y configuración (decoración de Navidad). Todo exige una cuenta activa en
-- platform_admins. Los usuarios y métricas son solo cantidades: sin nombres ni correos de residentes.
begin;

-- Configuración global de una sola fila.
create table public.platform_settings (
  singleton boolean primary key default true check (singleton),
  seasonal_decor boolean not null default true,
  updated_by uuid references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings default values;
alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from public, anon, authenticated;

-- Plan de cada conjunto: mensual o anual (mismo precio base; los valores están en la app).
-- «Pagado hasta» lo actualiza el superadmin al recibir el pago; no hay cobro automático.
create table public.property_plans (
  property_id uuid primary key references public.properties(id) on delete restrict,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','annual')),
  paid_until date,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);
alter table public.property_plans enable row level security;
revoke all on public.property_plans from public, anon, authenticated;

-- Cualquier sesión del panel lee si la decoración está activa.
create or replace function public.get_seasonal_decor()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select seasonal_decor from public.platform_settings where singleton), false);
$$;

create or replace function public.platform_set_seasonal_decor(target_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  update public.platform_settings set seasonal_decor = coalesce(target_enabled, false), updated_by = auth.uid(), updated_at = now() where singleton;
end;
$$;

-- Conjuntos con cifras de usuarios (solo cantidades) y su plan.
create or replace function public.platform_list_properties()
returns table(property_id uuid, property_name text, city text, property_status text, created_at timestamptz,
  unit_count integer, resident_count integer, concierge_count integer, administrator_count integer,
  billing_cycle text, paid_until date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query
  select p.id, p.name, p.city, p.status, p.created_at,
    (select count(*)::integer from public.units u where u.property_id = p.id and u.status = 'active'),
    (select count(*)::integer from public.property_members pm where pm.property_id = p.id and pm.status = 'active' and 'member' = any(pm.roles)),
    (select count(*)::integer from public.property_members pm where pm.property_id = p.id and pm.status = 'active' and 'concierge' = any(pm.roles)),
    (select count(*)::integer from public.property_members pm where pm.property_id = p.id and pm.status = 'active' and 'administrator' = any(pm.roles)),
    pl.billing_cycle, pl.paid_until
  from public.properties p
  left join public.property_plans pl on pl.property_id = p.id
  order by p.name;
end;
$$;

-- Administradores de cada conjunto (nombre, correo y estado). Incluye invitaciones pendientes.
create or replace function public.platform_list_administrators()
returns table(property_id uuid, property_name text, display_name text, email text, member_status text, since timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query
  select p.id, p.name, pr.display_name, au.email::text, pm.status, pm.joined_at
  from public.property_members pm
  join public.properties p on p.id = pm.property_id
  join public.profiles pr on pr.id = pm.user_id
  join auth.users au on au.id = pm.user_id
  where 'administrator' = any(pm.roles)
  union all
  select p.id, p.name, null::text, i.email_normalized, 'invited'::text, i.created_at
  from public.invitations i
  join public.properties p on p.id = i.property_id
  where i.status = 'pending' and 'administrator' = any(i.roles) and i.expires_at > now()
  order by 2, 6;
end;
$$;

create or replace function public.platform_set_property_plan(target_property_id uuid, target_cycle text, target_paid_until date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  if target_cycle not in ('monthly','annual') then raise exception 'invalid_cycle'; end if;
  if not exists(select 1 from public.properties where id = target_property_id) then raise exception 'invalid_property'; end if;
  insert into public.property_plans(property_id, billing_cycle, paid_until, updated_by)
  values (target_property_id, target_cycle, target_paid_until, auth.uid())
  on conflict (property_id) do update set billing_cycle = excluded.billing_cycle, paid_until = excluded.paid_until,
    updated_by = excluded.updated_by, updated_at = now();
  perform private.write_property_audit(target_property_id, 'platform.plan_updated', 'property', target_property_id,
    jsonb_build_object('billing_cycle', target_cycle, 'paid_until', target_paid_until));
end;
$$;

-- Uso de los últimos 30 días por conjunto (solo cantidades).
create or replace function public.platform_usage_by_property()
returns table(property_id uuid, property_name text, pqrs_count integer, package_count integer, visitor_count integer, reservation_count integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query
  select p.id, p.name,
    (select count(*)::integer from public.pqrs x where x.property_id = p.id and x.created_at >= now() - interval '30 days'),
    (select count(*)::integer from public.packages x where x.property_id = p.id and x.created_at >= now() - interval '30 days'),
    (select count(*)::integer from public.visitors x where x.property_id = p.id and x.created_at >= now() - interval '30 days'),
    (select count(*)::integer from public.reservations x where x.property_id = p.id and x.created_at >= now() - interval '30 days')
  from public.properties p order by p.name;
end;
$$;

-- Cuentas que entraron en los últimos 7 y 30 días y correos de los últimos 30 días por estado.
create or replace function public.platform_activity_metrics()
returns table(active_7_days integer, active_30_days integer, emails_sent integer, emails_held integer, emails_failed integer, emails_pending integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query
  select
    (select count(*)::integer from auth.users where last_sign_in_at >= now() - interval '7 days'),
    (select count(*)::integer from auth.users where last_sign_in_at >= now() - interval '30 days'),
    (select count(*)::integer from public.email_jobs where created_at >= now() - interval '30 days' and status = 'accepted'),
    (select count(*)::integer from public.email_jobs where created_at >= now() - interval '30 days' and status = 'held'),
    (select count(*)::integer from public.email_jobs where created_at >= now() - interval '30 days' and status = 'failed'),
    (select count(*)::integer from public.email_jobs where created_at >= now() - interval '30 days' and status in ('queued','processing'));
end;
$$;

revoke all on function public.get_seasonal_decor(), public.platform_set_seasonal_decor(boolean), public.platform_list_properties(),
  public.platform_list_administrators(), public.platform_set_property_plan(uuid,text,date), public.platform_usage_by_property(),
  public.platform_activity_metrics() from public, anon;
grant execute on function public.get_seasonal_decor(), public.platform_set_seasonal_decor(boolean), public.platform_list_properties(),
  public.platform_list_administrators(), public.platform_set_property_plan(uuid,text,date), public.platform_usage_by_property(),
  public.platform_activity_metrics() to authenticated;

commit;

select
  (select seasonal_decor from public.platform_settings) as navidad_activa,
  not has_table_privilege('authenticated', 'public.property_plans', 'select') as planes_protegidos,
  has_function_privilege('authenticated', 'public.platform_list_administrators()', 'execute')
    and not has_function_privilege('anon', 'public.platform_list_administrators()', 'execute') as administradores_disponible,
  has_function_privilege('authenticated', 'public.platform_activity_metrics()', 'execute') as metricas_disponibles;
