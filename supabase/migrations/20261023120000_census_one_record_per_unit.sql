-- Una sola respuesta del censo por apartamento: la de quien vive ahí.
-- La vista previa y el servidor ya bloquean apartamentos repetidos; este índice es la
-- última barrera en la base de datos. Ejecutar después de limpiar el censo de prueba de
-- Mirador: si alguna propiedad tiene dos respuestas en un apartamento, la migración falla
-- y no cambia nada.
begin;

create unique index census_one_record_per_unit
  on public.census_records(property_id, unit_id);

commit;

select exists (
  select 1 from pg_indexes
  where schemaname = 'public' and indexname = 'census_one_record_per_unit'
) as una_respuesta_por_apartamento;
