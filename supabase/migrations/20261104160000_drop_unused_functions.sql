-- Auditoría de código (04/11/2026, aprobada por Alejandro, grupo B): se quitan funciones de la base que la app,
-- la función de correos y las demás funciones ya no usan. Menos puertas abiertas en la base.
-- * maintenance_monthly_report: la reemplazó maintenance_report (por rango de fechas).
-- * get_platform_dashboard_metrics: el Inicio del superadmin calcula las cifras de otra forma.
-- * platform_set_property_plan, platform_usage_by_property: Planes se quitó; el uso se ve por mes.
-- * set_unit_finance_access: el acceso a la cartera es para todos desde el 26/10 (ya estaba bloqueada).
-- * mark_payment_evidence_received, accept_payment_evidence: el admin registra el pago desde el formulario.
-- Se borran todas sus versiones. Si otra función todavía dependiera de alguna, el script se detiene sin quitar nada.
begin;

do $limpieza$
declare item record; removed integer := 0;
begin
  for item in
    select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array['maintenance_monthly_report', 'get_platform_dashboard_metrics',
      'platform_set_property_plan', 'platform_usage_by_property', 'set_unit_finance_access', 'mark_payment_evidence_received', 'accept_payment_evidence'])
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
  where n.nspname = 'public' and p.proname = any(array['maintenance_monthly_report', 'get_platform_dashboard_metrics',
    'platform_set_property_plan', 'platform_usage_by_property', 'set_unit_finance_access', 'mark_payment_evidence_received', 'accept_payment_evidence'])) as funciones_sin_uso_quitadas;
