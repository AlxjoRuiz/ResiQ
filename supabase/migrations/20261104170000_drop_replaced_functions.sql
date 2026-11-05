-- Auditoría de código (04/11/2026, aprobada por Alejandro tras revisarlas una por una): se quitan 13 funciones
-- viejas de la base que ya tienen reemplazo o cuya pantalla ya no existe. La app no llama ninguna.
-- * create_reservation → create_reservation_with_purpose.
-- * get_amenity_availability → get_amenity_availability_with_reason.
-- * list_operational_reservations, list_operational_reservations_with_context → list_operational_reservations_recent.
-- * create_assembly → create_published_assembly.
-- * complete_pqrs_document → complete_verified_document.
-- * create_resident_invitation → queue_resident_invitation (censo).
-- * create_building, create_unit, update_unit → torres y apartamentos solo por el Excel del censo.
-- * create_unit_membership → el vínculo se crea al aceptar la invitación del censo.
-- * update_apartment_relationship → se cambia en la ficha del censo.
-- * register_utility_bill → portería ya no registra recibos (los existentes siguen visibles en Paquetes).
-- Se borran todas sus versiones. Si otra función todavía dependiera de alguna, el script se detiene sin quitar nada.
begin;

do $limpieza$
declare item record; removed integer := 0;
begin
  for item in
    select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array['create_reservation', 'get_amenity_availability', 'list_operational_reservations',
      'list_operational_reservations_with_context', 'create_assembly', 'complete_pqrs_document', 'create_resident_invitation', 'create_building',
      'create_unit', 'update_unit', 'create_unit_membership', 'update_apartment_relationship', 'register_utility_bill'])
  loop
    execute format('drop function %s', item.signature);
    removed := removed + 1;
  end loop;
  raise notice 'funciones quitadas: %', removed;
end;
$limpieza$;

notify pgrst, 'reload schema';
commit;

-- Debe dar true.
select not exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = any(array['create_reservation', 'get_amenity_availability', 'list_operational_reservations',
    'list_operational_reservations_with_context', 'create_assembly', 'complete_pqrs_document', 'create_resident_invitation', 'create_building',
    'create_unit', 'update_unit', 'create_unit_membership', 'update_apartment_relationship', 'register_utility_bill'])) as funciones_viejas_quitadas;
