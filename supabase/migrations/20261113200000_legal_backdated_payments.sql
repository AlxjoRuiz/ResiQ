-- La fecha del pago manda (13/11/2026, pedido de Alejandro). Si la administración registra hoy un pago con fecha
-- del 30 de agosto, la abogada debe verlo como pagado el 30 de agosto y el informe de agosto debe incluirlo.
-- * El informe ya cuenta los pagos por su fecha de pago (paid_on). Lo que faltaba: los meses que ya tienen cierre
--   muestran la foto guardada al cerrar, así que un pago registrado después no aparecía. Ahora, cuando se registra o
--   se anula un pago con fecha de un mes ya cerrado, ResiQ actualiza solo el cierre de ese mes y de los meses
--   cerrados siguientes (la mora de los meses siguientes también cambia): queda una versión nueva automática con el
--   motivo «Actualizado solo: pago con fecha de este mes registrado después del cierre». El informe muestra siempre
--   la última versión.
-- * Novedades de la abogada: los pagos y las anulaciones de pagos dicen «Pagado el DD/MM/AAAA».
begin;

-- Vuelve a cerrar los meses ya cerrados desde el mes de la fecha dada (versión nueva, automática).
create or replace function private.legal_refresh_closures_from(target_property_id uuid, from_date date)
returns integer language plpgsql security definer set search_path = '' as $$
declare m date; refreshed integer := 0;
begin
  for m in select distinct c.month from public.legal_report_closures c
           where c.property_id = target_property_id and c.month >= date_trunc('month', from_date)::date order by 1 loop
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

-- Se revisa al final de la transacción (cuando el pago ya quedó repartido en sus deudas).
create or replace function private.legal_refresh_after_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.legal_report_closures c where c.property_id = new.property_id and c.month >= date_trunc('month', new.paid_on)::date) then
    perform private.legal_refresh_closures_from(new.property_id, new.paid_on);
  end if;
  return null;
end;
$$;
revoke all on function private.legal_refresh_after_payment() from public, anon, authenticated;

drop trigger if exists payments_refresh_legal_closures on public.payments;
create constraint trigger payments_refresh_legal_closures after insert or update of status on public.payments
  deferrable initially deferred for each row execute function private.legal_refresh_after_payment();

-- Novedades: igual que 20261101100000, con «Pagado el DD/MM/AAAA» en pagos y anulaciones de pagos.
create or replace function public.legal_property_news(target_property_id uuid)
returns table(occurred_at timestamptz, kind text, unit_id uuid, unit_label text, description text, amount numeric, is_new boolean)
language plpgsql stable security definer set search_path = '' as $$
declare seen timestamptz; since timestamptz := now() - interval '60 days';
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  select v.seen_at into seen from public.legal_property_views v where v.property_id = target_property_id and v.staff_id = private.legal_staff_id();
  return query
  with events as (
    select ar.created_at as at, case ar.source when 'manual' then 'charge_manual' when 'opening_balance' then 'charge_opening' else 'charge_import' end as k, ar.unit_id as unit, ar.concept as text_value, ar.amount as value
    from public.accounts_receivable ar where ar.property_id = target_property_id and ar.created_at >= since
    union all
    select ar.voided_at, 'charge_voided', ar.unit_id, ar.concept, ar.amount
    from public.accounts_receivable ar where ar.property_id = target_property_id and ar.status = 'void' and ar.voided_at >= since
    union all
    select p.created_at, 'payment', p.unit_id,
      'Pagado el ' || to_char(p.paid_on, 'DD/MM/YYYY') || coalesce(' · ' || nullif(coalesce(private.legal_payment_concepts(p.property_id, p.id), p.reference, ''), ''), ''), p.amount
    from public.payments p where p.property_id = target_property_id and p.created_at >= since
    union all
    select p.voided_at, 'payment_voided', p.unit_id,
      'Pagado el ' || to_char(p.paid_on, 'DD/MM/YYYY') || coalesce(' · ' || nullif(coalesce(private.legal_payment_concepts(p.property_id, p.id), p.reference, ''), ''), '')
        || coalesce(' · Motivo: ' || nullif(p.void_reason, ''), ''), p.amount
    from public.payments p where p.property_id = target_property_id and p.status = 'void' and p.voided_at >= since
    union all
    select g.created_at, 'agreement', g.unit_id, coalesce(g.notes, ''), g.total_amount
    from public.payment_agreements g where g.property_id = target_property_id and g.created_at >= since
    union all
    select g.cancelled_at, 'agreement_cancelled', g.unit_id, coalesce(g.cancel_reason, ''), g.total_amount
    from public.payment_agreements g where g.property_id = target_property_id and g.status = 'cancelled' and g.cancelled_at >= since
  )
  select e.at, e.k, e.unit, b.name || ' · ' || u.code, e.text_value, e.value::numeric, seen is null or e.at > seen
  from events e join public.units u on u.property_id = target_property_id and u.id = e.unit
  join public.buildings b on b.property_id = u.property_id and b.id = u.building_id
  order by e.at desc limit 300;
end;
$$;

commit;

-- Debe dar true en las dos columnas.
select exists(select 1 from pg_trigger where tgname = 'payments_refresh_legal_closures') as cierres_se_actualizan,
  pg_get_functiondef('public.legal_property_news(uuid)'::regprocedure) like '%Pagado el%' as novedades_con_fecha_de_pago;
