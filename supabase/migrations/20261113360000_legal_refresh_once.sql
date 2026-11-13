-- Cierres del informe: rehacerlos una sola vez por operación (13/11/2026). Desde 20261113200000, un pago con fecha de
-- un mes ya cerrado rehace el cierre de ese mes y de los siguientes. Con «Importar pagos» (cientos de pagos en una sola
-- operación) eso se repetía por cada pago y podía hacer fallar la importación por tiempo. Ahora, dentro de una misma
-- operación, cada mes se rehace una sola vez: el disparador corre al final (cuando ya están todos los pagos), así que
-- esa versión ya los incluye a todos.
begin;

create or replace function private.legal_refresh_closures_from(target_property_id uuid, from_date date)
returns integer language plpgsql security definer set search_path = '' as $$
declare m date; refreshed integer := 0;
begin
  for m in select distinct c.month from public.legal_report_closures c
           where c.property_id = target_property_id and c.month >= date_trunc('month', from_date)::date order by 1 loop
    -- Ya se rehízo en esta misma operación (now() es la hora de inicio de la operación): no repetir.
    continue when exists (select 1 from public.legal_report_closures c where c.property_id = target_property_id and c.month = m
                          and c.automatic and c.closed_at = now());
    insert into public.legal_report_closures(property_id, month, version, snapshot, automatic, reason)
    values (target_property_id, m,
      (select max(c.version) + 1 from public.legal_report_closures c where c.property_id = target_property_id and c.month = m),
      private.legal_report_build(target_property_id, m, 'Actualización automática de ResiQ'), true,
      'Actualizado solo: pago con fecha de este mes registrado después del cierre');
    refreshed := refreshed + 1;
  end loop;
  return refreshed;
end;
$$;
revoke all on function private.legal_refresh_closures_from(uuid, date) from public, anon, authenticated;

commit;

-- Debe dar true.
select pg_get_functiondef('private.legal_refresh_closures_from(uuid,date)'::regprocedure) like '%closed_at = now()%' as cierre_una_vez;
