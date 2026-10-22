-- Crea una propiedad vacía para probar la importación del censo de 2.000 filas.
-- pruebaadmin@resiq.invalid queda como su administrador. No crea torres ni apartamentos:
-- la importación del censo exige la estructura vacía.
-- Ejecutar completo en SQL Editor. Es idempotente: repetirlo no duplica nada.
do $load$
declare
  superadmin_id uuid;
  test_admin_id uuid;
  load_property_id uuid;
begin
  select user_id into superadmin_id from public.platform_admins where status = 'active' order by created_at limit 1;
  if superadmin_id is null then raise exception 'sin_superadmin_activo'; end if;
  select id into test_admin_id from auth.users where lower(email) = 'pruebaadmin@resiq.invalid';
  if test_admin_id is null then raise exception 'falta_pruebaadmin'; end if;

  insert into public.properties (name, slug, address, city, created_by)
  values ('Conjunto Carga de Prueba', 'carga-prueba-resiq', 'Dirección ficticia', 'Bogotá', superadmin_id)
  on conflict (slug) do update set status = 'active', updated_at = now()
  returning id into load_property_id;

  insert into public.property_members (property_id, user_id, roles, created_by)
  values (load_property_id, test_admin_id, array['administrator']::text[], superadmin_id)
  on conflict (property_id, user_id) do update set status = 'active', revoked_at = null;
end;
$load$;

select p.id, p.name, p.status,
  (select count(*) from public.buildings b where b.property_id = p.id) as torres,
  (select count(*) from public.units u where u.property_id = p.id) as apartamentos
from public.properties p where p.slug = 'carga-prueba-resiq';
