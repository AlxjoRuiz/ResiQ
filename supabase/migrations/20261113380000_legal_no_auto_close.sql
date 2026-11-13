-- Sin cierre automático del informe jurídico (13/11/2026, pedido de Alejandro). Los meses quedan abiertos y se van
-- actualizando con lo que pase (pagos, cartera nueva, anulaciones). Solo la abogada cierra un mes, con el botón
-- «Cerrar mes», cuando ella lo decida (por ejemplo, cuando ya está todo pago).
-- * Se quita el trabajo diario que cerraba solo el mes anterior.
-- * Los meses que se cerraron solos (todas sus versiones automáticas) se reabren: se borran esos cierres. Los meses que
--   la abogada cerró a mano se conservan.
-- * Si después de cerrarlo a mano entra un pago con fecha de ese mes, el cierre se actualiza solo (como antes).
begin;

select cron.unschedule(jobid) from cron.job where jobname = 'legal-report-monthly-closures';

delete from public.legal_report_closures c
where not exists (select 1 from public.legal_report_closures m where m.property_id = c.property_id and m.month = c.month and not m.automatic);

commit;

-- Debe dar true en las dos columnas.
select not exists(select 1 from cron.job where jobname = 'legal-report-monthly-closures') as sin_cierre_automatico,
  not exists(select 1 from public.legal_report_closures c group by c.property_id, c.month having bool_and(c.automatic)) as meses_automaticos_reabiertos;
