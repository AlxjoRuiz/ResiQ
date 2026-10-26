-- Comprobantes con deuda y valor elegidos por el residente (decisión de Alejandro, 26/10/2026).
-- El residente elige la obligación a la que aplica su pago o abono y el valor pagado; puede subir
-- varios comprobantes a la misma obligación (abonos). La administración pulsa «Aceptar y registrar
-- pago» y el pago queda registrado y aplicado a esa obligación en una sola operación.
begin;

alter table public.finance_payment_evidence drop constraint finance_payment_evidence_receivable_id_uploaded_by_key;
alter table public.finance_payment_evidence add column declared_amount numeric(14,2) check (declared_amount is null or declared_amount > 0);
alter table public.finance_payment_evidence add column payment_id uuid;
alter table public.finance_payment_evidence add constraint finance_payment_evidence_payment_fkey
  foreign key (property_id,payment_id) references public.payments(property_id,id) on delete restrict;
create unique index finance_payment_evidence_payment_idx on public.finance_payment_evidence(payment_id) where payment_id is not null;

create or replace function public.accept_payment_evidence(target_evidence_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare item public.finance_payment_evidence%rowtype; zone text; amount_value numeric; outstanding numeric;
  allocations jsonb:='[]'::jsonb; created_payment uuid;
begin
  select * into item from public.finance_payment_evidence where id=target_evidence_id for update;
  if not found or auth.uid() is null or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.payment_id is not null then return item.payment_id; end if;
  select timezone into zone from public.properties where id=item.property_id;
  outstanding:=case when exists(select 1 from public.accounts_receivable where id=item.receivable_id and status='active')
    then private.receivable_outstanding(item.receivable_id) else 0 end;
  -- Valor declarado por el residente; en comprobantes antiguos sin valor, el saldo de la obligación.
  amount_value:=coalesce(item.declared_amount,outstanding);
  if amount_value is null or amount_value<=0 then raise exception 'nothing_to_apply'; end if;
  if least(amount_value,outstanding)>0 then
    allocations:=jsonb_build_array(jsonb_build_object('receivable_id',item.receivable_id,'amount',least(amount_value,outstanding)));
  end if;
  created_payment:=public.record_payment(item.property_id,item.unit_id,amount_value,(item.created_at at time zone zone)::date,
    left('Comprobante: '||item.original_name,120),allocations,item.id);
  update public.finance_payment_evidence set payment_id=created_payment,
    received_at=coalesce(received_at,now()),received_by=coalesce(received_by,auth.uid()) where id=item.id;
  perform private.write_property_audit(item.property_id,'payment_evidence.accepted','finance_payment_evidence',item.id,
    jsonb_build_object('payment_id',created_payment,'amount',amount_value));
  return created_payment;
end;
$$;
revoke all on function public.accept_payment_evidence(uuid) from public,anon;
grant execute on function public.accept_payment_evidence(uuid) to authenticated;

notify pgrst,'reload schema';
commit;

select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='finance_payment_evidence' and column_name='declared_amount') as valor_en_comprobantes,
  not exists(select 1 from pg_constraint where conname='finance_payment_evidence_receivable_id_uploaded_by_key') as varios_abonos_por_deuda,
  has_function_privilege('authenticated','public.accept_payment_evidence(uuid)','execute') as aceptar_disponible;
