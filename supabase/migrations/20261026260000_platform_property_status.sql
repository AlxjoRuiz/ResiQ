-- Superadmin: suspender o reactivar un conjunto (26/10/2026). Suspender solo cambia el estado:
-- no borra datos. Mientras está suspendido, private.is_active_member devuelve false para todos sus
-- miembros, así que nadie (admin, portería ni residentes) puede ver ni operar sus datos.
begin;

create or replace function public.platform_set_property_status(target_property_id uuid, target_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare previous_status text;
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  if target_status not in ('active','suspended') then raise exception 'invalid_status'; end if;
  select status into previous_status from public.properties where id = target_property_id for update;
  if not found or previous_status = 'archived' then raise exception 'invalid_property'; end if;
  if previous_status = target_status then return; end if;
  update public.properties set status = target_status where id = target_property_id;
  perform private.write_property_audit(target_property_id, 'platform.property_status_changed', 'property', target_property_id,
    jsonb_build_object('previous_status', previous_status, 'status', target_status));
end;
$$;

-- «Mis comunidades»: nombre y estado de los conjuntos de la cuenta, aunque estén suspendidos.
create or replace function public.get_my_property_statuses()
returns table(property_id uuid, property_name text, property_status text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.status from public.properties p
  join public.property_members pm on pm.property_id = p.id
  where pm.user_id = auth.uid() and pm.status = 'active';
$$;

revoke all on function public.platform_set_property_status(uuid,text), public.get_my_property_statuses() from public, anon;
grant execute on function public.platform_set_property_status(uuid,text), public.get_my_property_statuses() to authenticated;

commit;

select
  has_function_privilege('authenticated', 'public.platform_set_property_status(uuid,text)', 'execute')
    and not has_function_privilege('anon', 'public.platform_set_property_status(uuid,text)', 'execute') as suspender_disponible,
  has_function_privilege('authenticated', 'public.get_my_property_statuses()', 'execute') as estado_en_comunidades;
