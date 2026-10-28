-- Cartera (28/10/2026): «Aceptar pago» en un comprobante llena el formulario «Registrar pago» y la
-- administración lo registra desde ahí, pudiendo ajustar valor, fecha y distribución. El pago queda
-- amarrado al comprobante: un comprobante solo se registra una vez (clave de idempotencia = id del
-- comprobante y payment_id único), así no se repite el pago.
begin;

create or replace function public.record_evidence_payment(
  target_evidence_id uuid, target_amount numeric, target_paid_on date, target_reference text, target_allocations jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare item public.finance_payment_evidence%rowtype; created_payment uuid;
begin
  select * into item from public.finance_payment_evidence where id=target_evidence_id for update;
  if not found or auth.uid() is null or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.payment_id is not null then raise exception 'evidence_already_registered'; end if;
  created_payment:=public.record_payment(item.property_id,item.unit_id,target_amount,target_paid_on,target_reference,coalesce(target_allocations,'[]'::jsonb),item.id);
  update public.finance_payment_evidence set payment_id=created_payment,
    received_at=coalesce(received_at,now()),received_by=coalesce(received_by,auth.uid()) where id=item.id;
  perform private.write_property_audit(item.property_id,'payment_evidence.accepted','finance_payment_evidence',item.id,
    jsonb_build_object('payment_id',created_payment,'amount',target_amount,'from_form',true));
  return created_payment;
end;
$$;
revoke all on function public.record_evidence_payment(uuid,numeric,date,text,jsonb) from public,anon;
grant execute on function public.record_evidence_payment(uuid,numeric,date,text,jsonb) to authenticated;

commit;

select has_function_privilege('authenticated','public.record_evidence_payment(uuid,numeric,date,text,jsonb)','execute')
  and not has_function_privilege('anon','public.record_evidence_payment(uuid,numeric,date,text,jsonb)','execute') as registrar_desde_comprobante;
