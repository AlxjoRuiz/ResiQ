-- Censo (27/10/2026): la columna «TIPO DE VEHICULO CON EL QUE CUENTA» pasa a llamarse «MARCA DE
-- VEHICULO» en los censos ya cargados. Solo cambia el encabezado; las respuestas no se tocan. La app
-- sigue aceptando Excel con el nombre anterior como la misma columna.
begin;

update public.census_imports ci
set headers = (
  select jsonb_agg(case when private.census_header_key(h.value) = 'tipo de vehiculo con el que cuenta'
                        then to_jsonb('MARCA DE VEHICULO'::text) else to_jsonb(h.value) end order by h.position)
  from jsonb_array_elements_text(ci.headers) with ordinality h(value, position)
)
where exists (select 1 from jsonb_array_elements_text(ci.headers) h(value)
              where private.census_header_key(h.value) = 'tipo de vehiculo con el que cuenta');

commit;

select not exists (
  select 1 from public.census_imports ci, jsonb_array_elements_text(ci.headers) h(value)
  where private.census_header_key(h.value) = 'tipo de vehiculo con el que cuenta'
) as columna_renombrada;
