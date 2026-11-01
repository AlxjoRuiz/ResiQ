-- Comprobantes de las cuotas del acuerdo de pago (01/11/2026, pedido de Alejandro).
-- * El residente puede enviar el comprobante de una cuota del acuerdo, no solo de una deuda.
-- * Las cuotas no son deudas: el comprobante queda ligado a la cuota (agreement_installment_id) y, para no
--   romper lo existente, también a la deuda más antigua del apartamento.
-- * Al aceptarlo, el pago se aplica a las deudas con saldo de la más antigua a la más nueva hasta cubrir el
--   valor (lo que el acuerdo va pagando). Las cuotas se siguen marcando pagadas con los pagos registrados
--   desde la creación del acuerdo, como antes.
begin;

alter table public.finance_payment_evidence add column agreement_installment_id uuid references public.payment_agreement_installments(id) on delete restrict;
create index finance_payment_evidence_installment_idx on public.finance_payment_evidence(agreement_installment_id) where agreement_installment_id is not null;

create or replace function public.accept_payment_evidence(target_evidence_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare item public.finance_payment_evidence%rowtype; zone text; amount_value numeric; outstanding numeric; remaining numeric; debt record;
  allocations jsonb:='[]'::jsonb; created_payment uuid;
begin
  select * into item from public.finance_payment_evidence where id=target_evidence_id for update;
  if not found or auth.uid() is null or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.payment_id is not null then return item.payment_id; end if;
  select timezone into zone from public.properties where id=item.property_id;
  if item.agreement_installment_id is not null then
    -- Cuota del acuerdo: valor declarado, aplicado a las deudas con saldo de la más antigua a la más nueva.
    amount_value:=item.declared_amount;
    if amount_value is null or amount_value<=0 then raise exception 'nothing_to_apply'; end if;
    remaining:=amount_value;
    for debt in
      select ar.id, private.receivable_outstanding(ar.id) as owed from public.accounts_receivable ar
      where ar.property_id=item.property_id and ar.unit_id=item.unit_id and ar.status='active'
      order by ar.due_on, ar.created_at
    loop
      exit when remaining<=0;
      if debt.owed>0 then
        allocations:=allocations||jsonb_build_array(jsonb_build_object('receivable_id',debt.id,'amount',least(remaining,debt.owed)));
        remaining:=remaining-least(remaining,debt.owed);
      end if;
    end loop;
  else
    outstanding:=case when exists(select 1 from public.accounts_receivable where id=item.receivable_id and status='active')
      then private.receivable_outstanding(item.receivable_id) else 0 end;
    -- Valor declarado por el residente; en comprobantes antiguos sin valor, el saldo de la obligación.
    amount_value:=coalesce(item.declared_amount,outstanding);
    if amount_value is null or amount_value<=0 then raise exception 'nothing_to_apply'; end if;
    if least(amount_value,outstanding)>0 then
      allocations:=jsonb_build_array(jsonb_build_object('receivable_id',item.receivable_id,'amount',least(amount_value,outstanding)));
    end if;
  end if;
  created_payment:=public.record_payment(item.property_id,item.unit_id,amount_value,(item.created_at at time zone zone)::date,
    left('Comprobante: '||item.original_name,120),allocations,item.id);
  update public.finance_payment_evidence set payment_id=created_payment,
    received_at=coalesce(received_at,now()),received_by=coalesce(received_by,auth.uid()) where id=item.id;
  perform private.write_property_audit(item.property_id,'payment_evidence.accepted','finance_payment_evidence',item.id,
    jsonb_build_object('payment_id',created_payment,'amount',amount_value,'agreement_installment_id',item.agreement_installment_id));
  return created_payment;
end;
$$;
revoke all on function public.accept_payment_evidence(uuid) from public,anon;
grant execute on function public.accept_payment_evidence(uuid) to authenticated;

notify pgrst,'reload schema';
commit;

-- Debe dar true.
select exists(select 1 from information_schema.columns where table_schema='public' and table_name='finance_payment_evidence' and column_name='agreement_installment_id') as comprobantes_de_cuotas;
