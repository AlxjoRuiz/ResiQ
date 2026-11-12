-- Inicio más rápido (13/11/2026, pedido de Alejandro). El resumen de cartera del Inicio pedía la cartera de todos los
-- apartamentos (1.860 en Bonavento, en dos partes de 1.000, así que el cálculo completo se hacía dos veces) solo para
-- sumar dos totales y mostrar tres cuentas. Esta función hace el cálculo una vez y devuelve solo eso.
-- * Usa la misma función de siempre (list_finance_account_summaries), así que respeta los mismos permisos: la
--   administración ve todo el conjunto y cada residente solo los apartamentos con acceso financiero.
-- * Las tres cuentas son las primeras en el mismo orden de antes (por torre y apartamento).
-- Solo lectura; no cambia datos.
begin;

create or replace function public.finance_dashboard_summary(target_property_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  with s as (
    select * from public.list_finance_account_summaries(target_property_id) with ordinality
  )
  select jsonb_build_object(
    'accounts', count(*),
    'outstanding', coalesce(sum(s.outstanding_balance), 0),
    'overdue', coalesce(sum(s.overdue_balance), 0),
    'top', coalesce((select jsonb_agg(jsonb_build_object('unit_id', t.unit_id, 'building_name', t.building_name, 'unit_code', t.unit_code,
                       'outstanding_balance', t.outstanding_balance, 'account_status', t.account_status) order by t.ordinality)
                     from s t where t.ordinality <= 3), '[]'::jsonb)
  ) from s;
$$;
revoke all on function public.finance_dashboard_summary(uuid) from public, anon;
grant execute on function public.finance_dashboard_summary(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Debe dar true.
select exists(select 1 from pg_proc where proname = 'finance_dashboard_summary') as resumen_de_cartera_rapido;
