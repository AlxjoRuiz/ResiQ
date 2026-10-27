-- Auxiliar suspendido (27/10/2026): al iniciar sesión ve su propio mensaje en vez de «No has sido
-- invitado». La política de conjunto activo oculta su membresía suspendida, así que se consulta aquí.
begin;

create or replace function public.has_suspended_assistant_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.property_members pm
    where pm.user_id = auth.uid() and pm.status = 'suspended' and pm.is_admin_assistant);
$$;
revoke all on function public.has_suspended_assistant_access() from public, anon;
grant execute on function public.has_suspended_assistant_access() to authenticated;

commit;

select has_function_privilege('authenticated', 'public.has_suspended_assistant_access()', 'execute')
  and not has_function_privilege('anon', 'public.has_suspended_assistant_access()', 'execute') as aviso_auxiliar_disponible;
