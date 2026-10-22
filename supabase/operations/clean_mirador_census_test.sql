-- Borra SOLO el censo ficticio de 2.000 filas de Edificio Mirador ResiQ y las torres y
-- apartamentos que ese censo creó, para reimportar con una persona por apartamento.
-- Irreversible. Comprueba antes que los conteos sean exactamente los de la prueba de carga
-- (10 torres, 1.000 apartamentos, 2.000 respuestas, 1 importación). Si algo más usa esos
-- apartamentos (vínculos, invitaciones, paquetes, PQRS...), las claves foráneas detienen
-- todo el bloque y no se borra nada. Ejecutar completo en SQL Editor.
do $clean$
declare
  mirador constant uuid := 'df64a927-fa78-4dad-86fe-847b7f82307f';
begin
  if not exists (select 1 from public.properties where id = mirador and slug = 'mirador-resiq-demo') then
    raise exception 'mirador_no_encontrado';
  end if;
  if (select count(*) from public.buildings where property_id = mirador) <> 10
     or (select count(*) from public.units where property_id = mirador) <> 1000
     or (select count(*) from public.census_records where property_id = mirador) <> 2000
     or (select count(*) from public.census_imports where property_id = mirador) <> 1 then
    raise exception 'conteos_inesperados: no coincide con la prueba de carga';
  end if;

  delete from public.census_records where property_id = mirador;
  delete from public.census_imports where property_id = mirador;
  delete from public.units where property_id = mirador;
  delete from public.buildings where property_id = mirador;
end;
$clean$;

select
  (select count(*) from public.buildings where property_id = 'df64a927-fa78-4dad-86fe-847b7f82307f') as torres,
  (select count(*) from public.units where property_id = 'df64a927-fa78-4dad-86fe-847b7f82307f') as apartamentos,
  (select count(*) from public.census_records where property_id = 'df64a927-fa78-4dad-86fe-847b7f82307f') as respuestas;
