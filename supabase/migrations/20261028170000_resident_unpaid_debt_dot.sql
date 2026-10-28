-- Cartera (28/10/2026): punto rojo fijo del residente mientras tenga una deuda por pagar. Un
-- apartamento lo muestra si tiene una obligación activa con saldo por la que el residente no ha subido
-- un comprobante pendiente de registrar. Se quita al subir el comprobante; vuelve si el pago se anula
-- o se registra por menos del saldo. Reemplaza la regla anterior (solo pagos anulados).
begin;

create or replace function private.unit_needs_repayment(target_property_id uuid, target_unit_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.accounts_receivable ar
    where ar.property_id = target_property_id and ar.unit_id = target_unit_id and ar.status = 'active'
      and private.receivable_outstanding(ar.id) > 0
      and not exists(select 1 from public.finance_payment_evidence e
        where e.property_id = ar.property_id and e.receivable_id = ar.id
          and e.payment_id is null and e.payment_voided_at is null));
$$;
revoke all on function private.unit_needs_repayment(uuid, uuid) from public, anon, authenticated;

commit;

select pg_get_functiondef('private.unit_needs_repayment(uuid,uuid)'::regprocedure) like '%accounts_receivable ar%' as punto_por_deuda_pendiente;
