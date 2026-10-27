-- Reservas: el bloqueo por mora es automático (decisión de Alejandro, 26/10/2026). Ya no hay
-- interruptor; el admin solo define los días de mora. Se activa en todas las propiedades.
begin;

alter table public.property_policies alter column restrict_reservations_for_debt set default true;
update public.property_policies set restrict_reservations_for_debt=true where not restrict_reservations_for_debt;

commit;

select
  not exists(select 1 from public.property_policies where not restrict_reservations_for_debt) as todas_con_bloqueo,
  (select column_default from information_schema.columns where table_schema='public' and table_name='property_policies' and column_name='restrict_reservations_for_debt')='true' as nuevas_con_bloqueo;
