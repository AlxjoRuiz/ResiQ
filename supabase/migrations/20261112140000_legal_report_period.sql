-- Informe jurídico por rango de fechas (12/11/2026, pedido de Alejandro): además de un mes, la abogada puede pedir
-- el informe de un día a otro o de un mes a otro. Solo lectura.
-- * La cartera (morosos, antigüedad, torres) se calcula al final del rango (o a hoy si el rango llega hasta hoy).
-- * Recaudo, lo esperado, requerimientos, pagos y acuerdos se cuentan dentro del rango.
-- * Se compara con el periodo anterior del mismo largo (por ejemplo, 15 días antes).
-- * Los rangos no tienen cierre: el cierre sigue siendo por mes (legal_report_view).
begin;

create or replace function public.legal_report_period(target_property_id uuid, period_from date, period_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare zone text; today date; as_of date; span integer; previous_from date; previous_to date; trend jsonb := '[]'::jsonb; m date; month_end date; closure jsonb; last_month date;
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  select p.timezone into zone from public.properties p where p.id = target_property_id;
  today := (now() at time zone zone)::date;
  if period_from is null or period_to is null or period_from > period_to or period_from > today or period_to - period_from > 731 then raise exception 'invalid_period'; end if;
  as_of := least(period_to, today);
  span := period_to - period_from + 1;
  previous_to := period_from - 1;
  previous_from := period_from - span;

  -- Tendencia: los 6 meses hasta el mes en que termina el rango (del cierre si existe, si no calculado).
  last_month := date_trunc('month', least(period_to, today))::date;
  for i in reverse 5..0 loop
    m := (last_month - make_interval(months => i))::date;
    month_end := (m + interval '1 month' - interval '1 day')::date;
    select c.snapshot -> 'current' into closure from public.legal_report_closures c where c.property_id = target_property_id and c.month = m order by c.version desc limit 1;
    trend := trend || jsonb_build_array(private.legal_report_totals(coalesce(closure, private.legal_report_state(target_property_id, least(month_end, today), m, month_end)))
      || jsonb_build_object('month', m, 'closed', closure is not null));
  end loop;

  return jsonb_build_object(
    'property', (select jsonb_build_object('name', p.name, 'city', p.city, 'address', p.address) from public.properties p where p.id = target_property_id),
    'range', jsonb_build_object('from', period_from, 'to', period_to),
    'month', period_from, 'month_end', period_to, 'as_of', as_of, 'today', today, 'partial', as_of < period_to,
    'generated_at', now(), 'timezone', zone,
    'started_on', (select (a.created_at at time zone zone)::date from public.legal_assignments a where a.property_id = target_property_id),
    'first_month', (select date_trunc('month', min(ar.issued_on))::date from public.accounts_receivable ar where ar.property_id = target_property_id),
    'prepared_by', (select p.display_name from public.profiles p where p.id = auth.uid()),
    'note', null, 'closure', null, 'month_closed', false, 'can_close', false, 'history', '[]'::jsonb, 'trend', trend,
    'current', private.legal_report_state(target_property_id, as_of, period_from, period_to),
    'previous', private.legal_report_state(target_property_id, previous_to, previous_from, previous_to)
  );
end;
$$;
revoke all on function public.legal_report_period(uuid, date, date) from public, anon;
grant execute on function public.legal_report_period(uuid, date, date) to authenticated;

commit;

-- Debe dar true.
select exists(select 1 from pg_proc where proname = 'legal_report_period') as informe_por_rango;
