-- Punto rojo de Cartera con comprobantes de cuotas del acuerdo (01/11/2026, corrección de Alejandro).
-- Un comprobante seguía «pendiente» solo si su deuda tenía saldo; el de una cuota del acuerdo queda ligado
-- por dentro a la deuda más antigua, que puede estar pagada, y entonces no encendía el punto rojo de la
-- barra ni el del apartamento. Ahora el de una cuota sigue pendiente hasta que el admin registre su pago
-- (o lo anule), mientras el acuerdo esté vigente. Ver el comprobante sin registrarlo no quita el punto.
begin;

create or replace function private.evidence_is_pending(target_evidence_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.finance_payment_evidence e
    where e.id = target_evidence_id and e.payment_id is null and e.payment_voided_at is null
      and case
        when e.agreement_installment_id is not null then exists(
          select 1 from public.payment_agreement_installments i
          join public.payment_agreements g on g.property_id = i.property_id and g.id = i.agreement_id
          where i.id = e.agreement_installment_id and g.status = 'active')
        else exists(
          select 1 from public.accounts_receivable ar
          where ar.id = e.receivable_id and ar.property_id = e.property_id and ar.status = 'active' and private.receivable_outstanding(ar.id) > 0)
      end);
$$;

commit;

-- Debe dar true.
select pg_get_functiondef('private.evidence_is_pending(uuid)'::regprocedure) like '%agreement_installment_id%' as punto_con_cuotas;
