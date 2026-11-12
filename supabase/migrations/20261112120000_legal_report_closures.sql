-- Informe jurídico, fase 2 (12/11/2026, pedido de Alejandro): cierres mensuales, historial y tendencia.
-- * Cierre = «foto» del informe del mes guardada tal cual (snapshot). Un informe cerrado no cambia aunque después
--   se anule o corrija algo de ese mes. Nunca se modifica ni se borra: una corrección es una versión nueva con motivo.
-- * Cierre automático: todos los días a las 12:05 a. m. de Bogotá se cierra el mes anterior de cada conjunto asignado
--   a jurídica que todavía no tenga cierre (si un día falla, el siguiente lo pone al día).
-- * Cierre manual: la abogada cierra un mes ya terminado; si ya tiene cierre, exige un motivo y crea otra versión.
-- * El informe muestra el cierre si existe (la última versión, o la que se elija); si no, el cálculo con fechas.
-- * Tendencia: cartera vencida, morosos y recaudo de los 6 meses hasta el elegido (del cierre si existe).
begin;

create table public.legal_report_closures (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  month date not null check (extract(day from month) = 1),
  version integer not null check (version >= 1),
  snapshot jsonb not null,
  automatic boolean not null default false,
  reason text check (reason is null or char_length(trim(reason)) between 3 and 500),
  closed_by uuid references public.profiles(id) on delete restrict,
  closed_at timestamptz not null default now(),
  unique (property_id, month, version),
  check (version = 1 or reason is not null)
);
create index legal_report_closures_property_idx on public.legal_report_closures(property_id, month desc, version desc);
alter table public.legal_report_closures enable row level security;
revoke all on public.legal_report_closures from public, anon, authenticated;

-- El informe de un mes armado, sin revisar permisos (lo usan las funciones de abajo, que sí los revisan).
create or replace function private.legal_report_build(target_property_id uuid, target_month date, preparer text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare zone text; today date; month_start date := date_trunc('month', target_month)::date; month_end date; as_of date; previous_start date;
begin
  select p.timezone into zone from public.properties p where p.id = target_property_id;
  today := (now() at time zone zone)::date;
  month_end := (month_start + interval '1 month' - interval '1 day')::date;
  as_of := least(month_end, today);
  previous_start := (month_start - interval '1 month')::date;
  return jsonb_build_object(
    'property', (select jsonb_build_object('name', p.name, 'city', p.city, 'address', p.address) from public.properties p where p.id = target_property_id),
    'month', month_start, 'month_end', month_end, 'as_of', as_of, 'today', today, 'partial', as_of < month_end,
    'generated_at', now(), 'timezone', zone,
    'started_on', (select (a.created_at at time zone zone)::date from public.legal_assignments a where a.property_id = target_property_id),
    'first_month', (select date_trunc('month', min(ar.issued_on))::date from public.accounts_receivable ar where ar.property_id = target_property_id),
    'prepared_by', preparer,
    'note', (select jsonb_build_object('body', n.body, 'updated_at', n.updated_at) from public.legal_report_notes n where n.property_id = target_property_id and n.month = month_start),
    'current', private.legal_report_state(target_property_id, as_of, month_start, month_end),
    'previous', private.legal_report_state(target_property_id, (month_start - 1), previous_start, (month_start - 1))
  );
end;
$$;
revoke all on function private.legal_report_build(uuid, date, text) from public, anon, authenticated;

-- Totales de un estado (cartera vencida, morosos y recaudo), para la tendencia.
create or replace function private.legal_report_totals(state jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'arrears', coalesce((select sum((u ->> 'overdue')::numeric) from jsonb_array_elements(state -> 'units') u where (u ->> 'overdue')::numeric > 0), 0),
    'debtors', (select count(*) from jsonb_array_elements(state -> 'units') u where (u ->> 'overdue')::numeric > 0),
    'collected', coalesce((state ->> 'collected_month')::numeric, 0));
$$;
revoke all on function private.legal_report_totals(jsonb) from public, anon, authenticated;

-- Abogada: el informe que se muestra y se descarga. Si el mes tiene cierre, la foto guardada (la última versión o
-- la pedida); si no (o si pide los datos actuales), el cálculo con fechas. Incluye el historial y la tendencia.
create or replace function public.legal_report_view(target_property_id uuid, target_month date, target_version integer default null, live boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare zone text; today date; month_start date := date_trunc('month', target_month)::date; chosen public.legal_report_closures%rowtype; report jsonb; trend jsonb := '[]'::jsonb;
  m date; month_end date; closure jsonb; point jsonb;
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  select p.timezone into zone from public.properties p where p.id = target_property_id;
  today := (now() at time zone zone)::date;
  if target_month is null or month_start > today then raise exception 'invalid_month'; end if;

  if not live then
    select * into chosen from public.legal_report_closures c where c.property_id = target_property_id and c.month = month_start
      and (target_version is null or c.version = target_version) order by c.version desc limit 1;
  end if;
  if chosen.id is not null then
    report := chosen.snapshot || jsonb_build_object('closure', jsonb_build_object('version', chosen.version, 'closed_at', chosen.closed_at, 'automatic', chosen.automatic,
      'reason', chosen.reason, 'closed_by', (select p.display_name from public.profiles p where p.id = chosen.closed_by)));
  else
    report := private.legal_report_build(target_property_id, month_start, (select p.display_name from public.profiles p where p.id = auth.uid())) || jsonb_build_object('closure', null);
  end if;

  -- Tendencia: los 6 meses hasta el elegido; cada mes sale de su último cierre o, si no tiene, del cálculo con fechas.
  for i in reverse 5..0 loop
    m := (month_start - make_interval(months => i))::date;
    month_end := (m + interval '1 month' - interval '1 day')::date;
    select c.snapshot -> 'current' into closure from public.legal_report_closures c where c.property_id = target_property_id and c.month = m order by c.version desc limit 1;
    point := private.legal_report_totals(coalesce(closure, private.legal_report_state(target_property_id, least(month_end, today), m, month_end)))
      || jsonb_build_object('month', m, 'closed', closure is not null);
    trend := trend || jsonb_build_array(point);
  end loop;

  return report || jsonb_build_object(
    'trend', trend,
    'month_closed', exists(select 1 from public.legal_report_closures c where c.property_id = target_property_id and c.month = month_start),
    'can_close', month_start < date_trunc('month', today)::date,
    'history', coalesce((select jsonb_agg(jsonb_build_object('month', c.month, 'version', c.version, 'closed_at', c.closed_at, 'automatic', c.automatic, 'reason', c.reason,
        'closed_by', (select p.display_name from public.profiles p where p.id = c.closed_by)) order by c.month desc, c.version desc)
      from public.legal_report_closures c where c.property_id = target_property_id), '[]'::jsonb));
end;
$$;
revoke all on function public.legal_report_view(uuid, date, integer, boolean) from public, anon;
grant execute on function public.legal_report_view(uuid, date, integer, boolean) to authenticated;

-- Abogada: cierra un mes ya terminado. Si ya tenía cierre, pide motivo y guarda una versión nueva.
create or replace function public.legal_close_report_month(target_property_id uuid, target_month date, close_reason text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare zone text; today date; month_start date := date_trunc('month', target_month)::date; next_version integer; clean text := nullif(trim(coalesce(close_reason, '')), '');
begin
  if auth.uid() is null or private.legal_staff_id() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  select p.timezone into zone from public.properties p where p.id = target_property_id;
  today := (now() at time zone zone)::date;
  if target_month is null or month_start >= date_trunc('month', today)::date then raise exception 'month_not_finished'; end if;
  perform pg_advisory_xact_lock(hashtext('legal_close:' || target_property_id::text || month_start::text));
  select coalesce(max(c.version), 0) + 1 into next_version from public.legal_report_closures c where c.property_id = target_property_id and c.month = month_start;
  if next_version > 1 and (clean is null or char_length(clean) not between 3 and 500) then raise exception 'reason_required'; end if;
  insert into public.legal_report_closures(property_id, month, version, snapshot, automatic, reason, closed_by)
  values (target_property_id, month_start, next_version,
    private.legal_report_build(target_property_id, month_start, (select p.display_name from public.profiles p where p.id = auth.uid())), false, clean, auth.uid());
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (target_property_id, auth.uid(), 'property', 'legal.report_closed', 'property', target_property_id, jsonb_build_object('month', month_start, 'version', next_version, 'reason', clean));
  return next_version;
end;
$$;
revoke all on function public.legal_close_report_month(uuid, date, text) from public, anon;
grant execute on function public.legal_close_report_month(uuid, date, text) to authenticated;

-- Cierre automático: el mes anterior de cada conjunto asignado a jurídica que aún no tenga cierre.
create or replace function private.legal_close_due_months()
returns integer language plpgsql security definer set search_path = '' as $$
declare item record; previous_month date; closed integer := 0;
begin
  for item in select p.id, p.timezone from public.legal_assignments a join public.properties p on p.id = a.property_id and p.status = 'active' loop
    previous_month := (date_trunc('month', (now() at time zone item.timezone)::date) - interval '1 month')::date;
    if not exists(select 1 from public.legal_report_closures c where c.property_id = item.id and c.month = previous_month) then
      insert into public.legal_report_closures(property_id, month, version, snapshot, automatic)
      values (item.id, previous_month, 1, private.legal_report_build(item.id, previous_month, 'Cierre automático de ResiQ'), true)
      on conflict (property_id, month, version) do nothing;
      closed := closed + 1;
    end if;
  end loop;
  return closed;
end;
$$;
revoke all on function private.legal_close_due_months() from public, anon, authenticated;

commit;

-- Todos los días a las 05:05 UTC (12:05 a. m. en Bogotá).
select cron.schedule('legal-report-monthly-closures', '5 5 * * *', $job$ select private.legal_close_due_months(); $job$);

-- Debe dar true, true y true.
select exists(select 1 from pg_proc where proname = 'legal_report_view') as informe_con_cierres,
  not has_table_privilege('authenticated', 'public.legal_report_closures', 'select') as cierres_protegidos,
  exists(select 1 from cron.job where jobname = 'legal-report-monthly-closures') as cierre_automatico_programado;
