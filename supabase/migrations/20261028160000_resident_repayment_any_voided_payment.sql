-- Cartera (28/10/2026): el punto rojo fijo del residente sale con cualquier pago anulado, también los
-- registrados sin comprobante. Un apartamento tiene un pago por volver a pagar si un pago anulado
-- estaba aplicado a una deuda que sigue activa con saldo, y después de la anulación no se subió un
-- comprobante nuevo ni se registró otro pago para esa deuda.
begin;

create or replace function private.unit_needs_repayment(target_property_id uuid, target_unit_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.payments p
    join public.payment_allocations pa on pa.payment_id = p.id and pa.property_id = p.property_id
    join public.accounts_receivable ar on ar.id = pa.receivable_id and ar.property_id = p.property_id
    where p.property_id = target_property_id and p.unit_id = target_unit_id and p.status = 'void' and p.voided_at is not null
      and ar.status = 'active' and private.receivable_outstanding(ar.id) > 0
      and not exists(select 1 from public.finance_payment_evidence newer
        where newer.property_id = p.property_id and newer.receivable_id = ar.id
          and newer.payment_voided_at is null and newer.created_at > p.voided_at)
      and not exists(select 1 from public.payment_allocations later
        join public.payments lp on lp.id = later.payment_id and lp.property_id = later.property_id
        where later.property_id = p.property_id and later.receivable_id = ar.id
          and lp.status = 'posted' and lp.created_at > p.voided_at));
$$;
revoke all on function private.unit_needs_repayment(uuid, uuid) from public, anon, authenticated;

commit;

select pg_get_functiondef('private.unit_needs_repayment(uuid,uuid)'::regprocedure) like '%public.payments p%' as cualquier_pago_anulado;
