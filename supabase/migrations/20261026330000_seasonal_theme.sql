-- Decoración de temporada con tema (26/10/2026): Navidad o Halloween. El superadmin elige el tema
-- y la prende o apaga para todos desde Plataforma › Configuración.
begin;

alter table public.platform_settings add column seasonal_theme text not null default 'christmas'
  check (seasonal_theme in ('christmas','halloween'));

-- Tema activo, o null si la decoración está apagada. Cualquier sesión del panel lo lee.
create or replace function public.get_seasonal_theme()
returns text language sql stable security definer set search_path = '' as $$
  select case when seasonal_decor then seasonal_theme end from public.platform_settings where singleton;
$$;

create or replace function public.platform_set_seasonal_theme(target_theme text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  if target_theme not in ('christmas','halloween') then raise exception 'invalid_theme'; end if;
  update public.platform_settings set seasonal_theme = target_theme, updated_by = auth.uid(), updated_at = now() where singleton;
end;
$$;

-- Tema elegido aunque la decoración esté apagada (para Plataforma › Configuración).
create or replace function public.platform_get_seasonal_settings()
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return (select seasonal_theme from public.platform_settings where singleton);
end;
$$;

revoke all on function public.get_seasonal_theme(), public.platform_set_seasonal_theme(text), public.platform_get_seasonal_settings() from public, anon;
grant execute on function public.get_seasonal_theme(), public.platform_set_seasonal_theme(text), public.platform_get_seasonal_settings() to authenticated;

commit;

select
  (select seasonal_theme from public.platform_settings) = 'christmas' as tema_navidad_por_defecto,
  has_function_privilege('authenticated', 'public.platform_set_seasonal_theme(text)', 'execute')
    and not has_function_privilege('anon', 'public.platform_set_seasonal_theme(text)', 'execute') as cambiar_tema_disponible;
