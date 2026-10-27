-- Plataforma › Usuarios (decisión de Alejandro, 27/10/2026): cada persona de cada conjunto con
-- nombre, correo, rol, apartamento y estado (activo, suspendido, invitación enviada o vencida).
-- Solo el superadmin. Incluye residentes, portería, administradores y auxiliares. Expone datos
-- personales de residentes al superadmin (Ley 1581 de 2012: validar con asesor legal).
begin;

create or replace function public.platform_list_users()
returns table(property_id uuid, property_name text, property_status text, user_name text, email text, user_role text,
  unit_label text, user_status text, since timestamptz, invitation_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query
  -- Cuentas vinculadas (activas o suspendidas).
  select p.id, p.name, p.status, pr.display_name, au.email::text,
    case when 'administrator' = any(pm.roles) and pm.is_admin_assistant then 'assistant'
         when 'administrator' = any(pm.roles) then 'administrator'
         when 'concierge' = any(pm.roles) then 'concierge' else 'resident' end,
    (select string_agg(b.name || ' · ' || u.code, ', ' order by b.name, u.code)
       from public.unit_memberships um join public.units u on u.id = um.unit_id and u.property_id = um.property_id
       join public.buildings b on b.id = u.building_id and b.property_id = u.property_id
      where um.property_id = pm.property_id and um.member_id = pm.id and um.valid_from <= now() and (um.valid_to is null or um.valid_to > now())),
    pm.status, pm.joined_at, null::uuid
  from public.property_members pm
  join public.properties p on p.id = pm.property_id
  join public.profiles pr on pr.id = pm.user_id
  join auth.users au on au.id = pm.user_id
  where pm.status in ('active','suspended')
  union all
  -- Invitaciones pendientes: enviadas o vencidas.
  select p.id, p.name, p.status,
    coalesce((select cr.full_name from public.census_records cr where cr.property_id = i.property_id and cr.unit_id = i.unit_id
               and cr.email_normalized = i.email_normalized limit 1),
             (select r.first_name || ' ' || r.first_surname from public.admin_assistant_records r where r.invitation_id = i.id)),
    i.email_normalized,
    case when 'administrator' = any(i.roles) and i.is_admin_assistant then 'assistant'
         when 'administrator' = any(i.roles) then 'administrator'
         when 'concierge' = any(i.roles) then 'concierge' else 'resident' end,
    (select b.name || ' · ' || u.code from public.units u join public.buildings b on b.id = u.building_id and b.property_id = u.property_id
      where u.id = i.unit_id and u.property_id = i.property_id),
    case when i.expires_at <= now() then 'expired' else 'invited' end,
    i.created_at, i.id
  from public.invitations i
  join public.properties p on p.id = i.property_id
  where i.status = 'pending'
  order by 2, 6, 9;
end;
$$;
revoke all on function public.platform_list_users() from public, anon;
grant execute on function public.platform_list_users() to authenticated;

commit;

select has_function_privilege('authenticated', 'public.platform_list_users()', 'execute')
  and not has_function_privilege('anon', 'public.platform_list_users()', 'execute') as lista_usuarios_disponible;
