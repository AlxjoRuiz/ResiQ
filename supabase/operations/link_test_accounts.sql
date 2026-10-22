-- Vincula las cuentas de prueba @resiq.invalid a una propiedad del piloto.
-- Antes de ejecutar:
--   1. En Supabase > Authentication > Users > Add user, crear con "Auto Confirm User":
--      pruebaadmin@resiq.invalid y pruebaresidente@resiq.invalid.
--      Las contraseñas las elige Alejandro y no se guardan en el repo.
--   2. Confirmar la torre y el apartamento con esta consulta de solo lectura:
--      select b.code as torre, u.code as apartamento, u.status
--      from public.units u join public.buildings b on b.id = u.building_id
--      where u.property_id = '1bde3475-3ed2-4f57-bd13-39784b12d2a6' order by 1, 2;
-- Portería no se vincula aquí: se crea desde el panel de Propiedad con pruebaporteria@resiq.invalid.
-- Ejecutar el archivo completo en SQL Editor. Si una comprobación falla, no se guarda nada.
begin;

do $link$
declare
  target_property_id constant uuid := '1bde3475-3ed2-4f57-bd13-39784b12d2a6';
  target_building_code constant text := 'TA';
  target_unit_code constant text := '101';
  actor_id uuid;
  admin_user_id uuid;
  resident_user_id uuid;
  target_unit_id uuid;
  resident_member_id uuid;
begin
  -- El alta queda registrada a nombre del administrador activo más antiguo de la propiedad.
  select user_id into actor_id from public.property_members
  where property_id = target_property_id and status = 'active' and 'administrator' = any(roles)
  order by joined_at limit 1;
  if actor_id is null then raise exception 'sin_administrador_activo'; end if;

  select id into admin_user_id from auth.users where lower(email) = 'pruebaadmin@resiq.invalid';
  select id into resident_user_id from auth.users where lower(email) = 'pruebaresidente@resiq.invalid';
  if admin_user_id is null or resident_user_id is null then raise exception 'crear_primero_las_cuentas_en_auth'; end if;
  if (select count(*) from public.profiles where id in (admin_user_id, resident_user_id)) <> 2 then
    raise exception 'perfiles_no_creados';
  end if;
  if exists (select 1 from public.property_members where property_id = target_property_id
             and user_id in (admin_user_id, resident_user_id)) then
    raise exception 'cuenta_de_prueba_ya_vinculada';
  end if;

  select u.id into target_unit_id
  from public.units u
  join public.buildings b on b.id = u.building_id and b.property_id = u.property_id
  where u.property_id = target_property_id and b.code = target_building_code
    and u.code = target_unit_code and u.status = 'active';
  if target_unit_id is null then raise exception 'apartamento_no_encontrado'; end if;

  insert into public.property_members (property_id, user_id, roles, created_by)
  values (target_property_id, admin_user_id, array['administrator']::text[], actor_id);

  insert into public.property_members (property_id, user_id, roles, created_by)
  values (target_property_id, resident_user_id, array['member']::text[], actor_id)
  returning id into resident_member_id;

  insert into public.unit_memberships (property_id, unit_id, member_id, relationship, created_by)
  values (target_property_id, target_unit_id, resident_member_id, 'resident', actor_id);
end;
$link$;

commit;

select au.email, pm.roles, pm.status, u.code as apartamento, (um.id is not null and um.valid_to is null) as vinculo_vigente
from public.property_members pm
join auth.users au on au.id = pm.user_id
left join public.unit_memberships um on um.member_id = pm.id and um.property_id = pm.property_id
left join public.units u on u.id = um.unit_id
where pm.property_id = '1bde3475-3ed2-4f57-bd13-39784b12d2a6'
  and lower(au.email) in ('pruebaadmin@resiq.invalid', 'pruebaresidente@resiq.invalid');
