-- Cartera más rápida (13/11/2026, pedido de Alejandro). La página de Cartera pedía la cartera de todos los
-- apartamentos en partes de 1.000 (el límite de filas de Supabase), y cada parte repetía el cálculo completo: en
-- Bonavento (1.860 aptos) se hacía dos veces. Esta función devuelve la misma lista en un solo valor (sin límite de
-- filas), así el cálculo se hace una vez.
-- * Usa la misma función de siempre (list_finance_account_summaries): mismos permisos y mismo orden (torre y apartamento).
-- Solo lectura; no cambia datos.
begin;

create or replace function public.finance_account_summaries_json(target_property_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(s) - 'ordinality' order by s.ordinality), '[]'::jsonb)
  from public.list_finance_account_summaries(target_property_id) with ordinality s;
$$;
revoke all on function public.finance_account_summaries_json(uuid) from public, anon;
grant execute on function public.finance_account_summaries_json(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Debe dar true.
select exists(select 1 from pg_proc where proname = 'finance_account_summaries_json') as cartera_en_una_consulta;
