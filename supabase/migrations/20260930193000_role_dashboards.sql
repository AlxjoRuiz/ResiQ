-- Etapa 7: identidad de plataforma y métricas agregadas para dashboards.
create table public.platform_admins (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active','revoked')), created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create or replace function private.is_active_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins pa where pa.user_id = auth.uid() and pa.status = 'active');
$$;
create policy platform_admins_read_own on public.platform_admins for select to authenticated using (user_id = auth.uid());
create or replace function public.get_platform_dashboard_metrics()
returns table(property_count bigint, user_count bigint, administrator_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query select (select count(*) from public.properties), (select count(*) from public.profiles), (select count(*) from public.property_members pm where pm.status = 'active' and 'administrator' = any(pm.roles));
end;
$$;
revoke all on table public.platform_admins from public, anon;
grant select on table public.platform_admins to authenticated;
revoke all on function private.is_active_platform_admin() from public;
grant execute on function private.is_active_platform_admin() to authenticated;
revoke all on function public.get_platform_dashboard_metrics() from public, anon;
grant execute on function public.get_platform_dashboard_metrics() to authenticated;
