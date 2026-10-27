-- El aviso de conjunto suspendido salía como «No has sido invitado» (26/10/2026): la política
-- restrictiva active_property_access oculta las filas de property_members de un conjunto suspendido,
-- incluida la del propio usuario. get_my_property_statuses ahora también devuelve los roles, y la
-- app decide el acceso con esta función.
begin;

drop function public.get_my_property_statuses();
create function public.get_my_property_statuses()
returns table(property_id uuid, property_name text, property_status text, roles text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.status, pm.roles from public.properties p
  join public.property_members pm on pm.property_id = p.id
  where pm.user_id = auth.uid() and pm.status = 'active';
$$;
revoke all on function public.get_my_property_statuses() from public, anon;
grant execute on function public.get_my_property_statuses() to authenticated;

commit;

select exists(select 1 from information_schema.parameters where specific_schema = 'public'
  and specific_name like 'get_my_property_statuses%' and parameter_name = 'roles') as roles_disponibles,
  has_function_privilege('authenticated', 'public.get_my_property_statuses()', 'execute') as consulta_disponible;
