-- Portería: el admin suspende o reactiva el acceso de un portero (27/10/2026). El portero
-- suspendido ve su propio aviso al iniciar sesión (la política de conjunto activo oculta su
-- membresía suspendida, así que se consulta aquí).
begin;

create or replace function public.has_suspended_concierge_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.property_members pm
    where pm.user_id = auth.uid() and pm.status = 'suspended' and 'concierge' = any(pm.roles));
$$;
revoke all on function public.has_suspended_concierge_access() from public, anon;
grant execute on function public.has_suspended_concierge_access() to authenticated;

commit;

select has_function_privilege('authenticated', 'public.has_suspended_concierge_access()', 'execute')
  and not has_function_privilege('anon', 'public.has_suspended_concierge_access()', 'execute') as aviso_portero_disponible;
