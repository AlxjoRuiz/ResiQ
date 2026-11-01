-- Módulo jurídico (01/11/2026, pedido de Alejandro): en Novedades, los pagos registrados y anulados dicen
-- qué pagaron (los conceptos de las deudas a las que se aplicaron, con su valor si fueron varias), en lugar
-- de solo el comprobante. Las aplicaciones se conservan al anular un pago, así que también salen en los
-- anulados. Misma firma que antes.
begin;

create or replace function private.legal_payment_concepts(target_property_id uuid, target_payment_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select string_agg(case when x.total > 1 then x.concept || ' ($ ' || replace(to_char(x.amount, 'FM999,999,999,990'), ',', '.') || ')' else x.concept end, ', ' order by x.due_on, x.concept)
  from (
    select ar.concept, ar.due_on, pa.amount, count(*) over () as total
    from public.payment_allocations pa
    join public.accounts_receivable ar on ar.property_id = pa.property_id and ar.id = pa.receivable_id
    where pa.property_id = target_property_id and pa.payment_id = target_payment_id
  ) x;
$$;
revoke all on function private.legal_payment_concepts(uuid, uuid) from public, anon, authenticated;

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
    select p.created_at, 'payment', p.unit_id, coalesce(private.legal_payment_concepts(p.property_id, p.id), p.reference, ''), p.amount
    from public.payments p where p.property_id = target_property_id and p.created_at >= since
    union all
    select p.voided_at, 'payment_voided', p.unit_id,
      coalesce(private.legal_payment_concepts(p.property_id, p.id), p.reference, '') || coalesce(' · Motivo: ' || nullif(p.void_reason, ''), ''), p.amount
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

-- Debe dar true.
select exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'legal_payment_concepts') as pagos_con_concepto;
