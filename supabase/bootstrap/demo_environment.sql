-- Bootstrap manual para el entorno de demostración de ResiQ.
-- Sustituir __ADMIN_USER_ID__ por un usuario ya autenticado en Supabase.
-- No ejecutar automáticamente como migración de producción.

begin;

do $$
declare
  admin_user_id uuid := '__ADMIN_USER_ID__';
  property_one_id uuid;
  property_two_id uuid;
  building_one_id uuid;
  building_two_id uuid;
begin
  if not exists (select 1 from public.profiles where id = admin_user_id) then
    raise exception 'admin_profile_not_found';
  end if;

  insert into public.properties (name, slug, address, city, created_by)
  values ('Conjunto Bosques de ResiQ', 'bosques-resiq-demo', 'Calle 100 # 20-30', 'Bogotá', admin_user_id)
  on conflict (slug) do update
    set name = excluded.name, address = excluded.address, city = excluded.city,
        status = 'active', updated_at = now()
  returning id into property_one_id;

  insert into public.properties (name, slug, address, city, created_by)
  values ('Edificio Mirador ResiQ', 'mirador-resiq-demo', 'Carrera 40 # 10-25', 'Medellín', admin_user_id)
  on conflict (slug) do update
    set name = excluded.name, address = excluded.address, city = excluded.city,
        status = 'active', updated_at = now()
  returning id into property_two_id;

  insert into public.property_members (property_id, user_id, roles, status, created_by)
  values
    (property_one_id, admin_user_id, array['administrator']::text[], 'active', admin_user_id),
    (property_two_id, admin_user_id, array['administrator']::text[], 'active', admin_user_id)
  on conflict (property_id, user_id) do update
    set roles = excluded.roles, status = 'active', revoked_at = null, updated_at = now();

  insert into public.buildings (property_id, name, code)
  values (property_one_id, 'Torre 1', 'T1')
  on conflict (property_id, code) do update
    set name = excluded.name, active = true, updated_at = now()
  returning id into building_one_id;

  insert into public.buildings (property_id, name, code)
  values (property_two_id, 'Torre 1', 'T1')
  on conflict (property_id, code) do update
    set name = excluded.name, active = true, updated_at = now()
  returning id into building_two_id;

  insert into public.units (property_id, building_id, code, floor)
  select property_one_id, building_one_id,
    case when number <= 10 then (100 + number)::text else (190 + number)::text end,
    case when number <= 10 then '1' else '2' end
  from generate_series(1, 20) as number
  on conflict (property_id, building_id, code) do update
    set floor = excluded.floor, status = 'active', updated_at = now();

  insert into public.units (property_id, building_id, code, floor)
  select property_two_id, building_two_id,
    case when number <= 10 then (100 + number)::text else (190 + number)::text end,
    case when number <= 10 then '1' else '2' end
  from generate_series(1, 20) as number
  on conflict (property_id, building_id, code) do update
    set floor = excluded.floor, status = 'active', updated_at = now();
end;
$$;

commit;

select p.name, count(distinct u.id) as active_units,
  pm.roles as administrator_roles
from public.properties p
join public.property_members pm on pm.property_id = p.id
join public.units u on u.property_id = p.id and u.status = 'active'
where p.slug in ('bosques-resiq-demo', 'mirador-resiq-demo')
group by p.name, pm.roles
order by p.name;
