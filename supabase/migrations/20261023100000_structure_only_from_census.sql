-- Torres y apartamentos solo se crean al importar el censo desde Excel.
-- Administración conserva la edición (update_building, update_unit); las funciones de
-- creación manual dejan de estar disponibles para la aplicación. No borra datos.
begin;

revoke execute on function public.create_building(uuid, text, text) from authenticated;
revoke execute on function public.create_unit(uuid, uuid, text, text) from authenticated;

commit;

select
  not has_function_privilege('authenticated', 'public.create_building(uuid, text, text)', 'execute') as crear_torre_bloqueado,
  not has_function_privilege('authenticated', 'public.create_unit(uuid, uuid, text, text)', 'execute') as crear_apto_bloqueado,
  has_function_privilege('authenticated', 'public.update_building(uuid, uuid, text, text, boolean)', 'execute') as editar_torre_disponible,
  has_function_privilege('authenticated', 'public.import_census_with_primary(uuid, text, jsonb, jsonb, jsonb)', 'execute') as importar_censo_disponible;
