-- Cartera (28/10/2026): al anular un pago, el residente lo ve como si tuviera que pagar otra vez.
-- * La deuda vuelve a quedar pendiente (ya pasaba al anular el pago).
-- * El comprobante de ese pago queda «Pago anulado»: se desamarra del pago (puede subirse uno nuevo)
--   y no vuelve a quedar pendiente para la administración (sin punto rojo ni «Aceptar pago»).
-- * El aviso al residente dice el valor y el motivo.
-- Igual a void_payment de 20261001230000_finance.sql, más el comprobante y el texto del aviso.
begin;

alter table public.finance_payment_evidence add column payment_voided_at timestamptz;
alter table public.finance_payment_evidence add column voided_payment_id uuid;
alter table public.finance_payment_evidence add column payment_void_reason text;

create or replace function public.void_payment(target_payment_id uuid,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.payments%rowtype; clean_reason text:=trim(target_reason); amount_label text;
begin
  select * into item from public.payments where id=target_payment_id for update;
  if not found or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status<>'posted' or char_length(clean_reason) not between 3 and 500 then raise exception 'invalid_transition'; end if;
  perform private.lock_unit_finance(item.property_id,item.unit_id);
  update public.payments set status='void',void_reason=clean_reason,voided_by=auth.uid(),voided_at=now() where id=item.id;
  -- El comprobante de ese pago queda anulado y libre: el residente vuelve a pagar con uno nuevo.
  update public.finance_payment_evidence set payment_id=null,voided_payment_id=item.id,payment_voided_at=now(),payment_void_reason=clean_reason
  where property_id=item.property_id and payment_id=item.id;
  insert into public.activity_events(property_id,payment_id,actor_id,event_type,previous_state,new_state,description) values(item.property_id,item.id,auth.uid(),'payment_voided','posted','void','Pago anulado: '||clean_reason);
  perform private.write_property_audit(item.property_id,'payment.voided','payment',item.id,jsonb_build_object('reason',clean_reason));
  -- Valor con puntos de miles, como se escribe en Colombia ($70.000).
  amount_label:='$'||replace(to_char(item.amount,'FM999,999,999,990'),',','.');
  perform private.enqueue_finance_notification(item.property_id,item.unit_id,'payment',item.id,'payment_voided','Pago anulado',
    'La administración anuló tu pago de '||amount_label||'. Motivo: '||clean_reason||'. La deuda vuelve a quedar pendiente: realiza el pago y sube un comprobante nuevo.',
    'payment:'||item.id||':void',jsonb_build_object('payment_id',item.id,'amount',item.amount,'reason',clean_reason));
end;
$$;

-- Un comprobante cuyo pago se anuló ya no queda pendiente para la administración.
create or replace function private.evidence_is_pending(target_evidence_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.finance_payment_evidence e
    join public.accounts_receivable ar on ar.id = e.receivable_id and ar.property_id = e.property_id
    where e.id = target_evidence_id and e.payment_id is null and e.payment_voided_at is null
      and ar.status = 'active' and private.receivable_outstanding(ar.id) > 0);
$$;

-- Comprobantes ya anulados antes de este cambio: quedan marcados igual.
update public.finance_payment_evidence e set payment_voided_at=p.voided_at,voided_payment_id=p.id,payment_void_reason=p.void_reason,payment_id=null
from public.payments p where p.id=e.payment_id and p.property_id=e.property_id and p.status='void';

commit;

select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='finance_payment_evidence' and column_name='payment_voided_at') as comprobante_anulado,
  pg_get_functiondef('public.void_payment(uuid,text)'::regprocedure) like '%payment_voided_at=now()%' as anular_libera_comprobante,
  not exists(select 1 from public.finance_payment_evidence e join public.payments p on p.id=e.payment_id where p.status='void') as sin_comprobantes_en_pagos_anulados;
