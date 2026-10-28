-- Cartera (28/10/2026): punto rojo fijo también para el residente. Si la administración anuló un pago
-- suyo y la deuda sigue pendiente, «Cartera» en la barra lateral y «Ver cuenta» del apartamento
-- muestran el punto aunque entre y salga, hasta que suba el comprobante nuevo de esa deuda (o la
-- deuda quede pagada o anulada).
begin;

-- Apartamento con un pago anulado por volver a pagar: deuda activa con saldo, con un comprobante cuyo
-- pago se anuló y sin un comprobante nuevo subido después de la anulación.
create or replace function private.unit_needs_repayment(target_property_id uuid, target_unit_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.finance_payment_evidence voided
    join public.accounts_receivable ar on ar.id = voided.receivable_id and ar.property_id = voided.property_id
    where voided.property_id = target_property_id and voided.unit_id = target_unit_id and voided.payment_voided_at is not null
      and ar.status = 'active' and private.receivable_outstanding(ar.id) > 0
      and not exists(select 1 from public.finance_payment_evidence newer
        where newer.property_id = voided.property_id and newer.receivable_id = voided.receivable_id
          and newer.payment_voided_at is null and newer.created_at > voided.payment_voided_at));
$$;
revoke all on function private.unit_needs_repayment(uuid, uuid) from public, anon, authenticated;

-- Administración: apartamentos con comprobantes sin registrar. Residente: sus apartamentos con un
-- pago anulado por volver a pagar.
create or replace function public.list_units_with_pending_evidence(target_property_id uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct unit_id), '{}') from (
    select e.unit_id from public.finance_payment_evidence e
    where e.property_id = target_property_id and private.is_active_member(target_property_id, 'administrator')
      and private.evidence_is_pending(e.id)
    union all
    select u.id from public.units u
    where u.property_id = target_property_id and not private.is_active_member(target_property_id, 'administrator')
      and private.can_access_unit_finance(target_property_id, u.id) and private.unit_needs_repayment(target_property_id, u.id)
  ) pending;
$$;

-- Igual a 20261028130000; «cartera_pending» también para el residente con un pago por volver a pagar.
create or replace function public.get_unseen_sections(target_property_id uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  with me as (
    select pm.id from public.property_members pm
    where pm.property_id = target_property_id and pm.user_id = auth.uid() and pm.status = 'active'
  ), pending as (
    select private.notification_section(n.target_type) as section, n.created_at from public.notifications n
    where n.property_id = target_property_id and n.recipient_member_id = (select id from me) and n.read_at is null
    union all
    select 'notificaciones', n.created_at from public.notifications n
    where n.property_id = target_property_id and n.recipient_member_id = (select id from me) and n.read_at is null
  ), unseen as (
    select p.section from pending p
    left join public.section_views v on v.member_id = (select id from me) and v.section = p.section
    where p.section is not null and (v.seen_at is null or p.created_at > v.seen_at)
    union all
    select 'cartera_pending' where cardinality(public.list_units_with_pending_evidence(target_property_id)) > 0
  )
  select coalesce(array_agg(distinct section), '{}') from unseen;
$$;

revoke all on function public.list_units_with_pending_evidence(uuid), public.get_unseen_sections(uuid) from public, anon;
grant execute on function public.list_units_with_pending_evidence(uuid), public.get_unseen_sections(uuid) to authenticated;

commit;

select
  pg_get_functiondef('public.list_units_with_pending_evidence(uuid)'::regprocedure) like '%unit_needs_repayment%' as punto_residente_tabla,
  pg_get_functiondef('public.get_unseen_sections(uuid)'::regprocedure) like '%list_units_with_pending_evidence%' as punto_residente_barra;
