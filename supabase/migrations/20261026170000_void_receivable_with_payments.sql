-- Anular cualquier obligación, aunque tenga pagos aplicados (decisión de Alejandro, 26/10/2026).
-- Igual a 20261014150000_guard_paid_receivable_void.sql, pero en lugar de bloquear, libera las
-- aplicaciones de pago de esa obligación: el dinero queda como «pago sin aplicar» del apartamento
-- y las aplicaciones liberadas quedan en la auditoría.
begin;

create or replace function public.void_receivable(target_receivable_id uuid,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.accounts_receivable%rowtype; clean_reason text:=trim(target_reason); released jsonb;
begin
  select * into item from public.accounts_receivable where id=target_receivable_id;
  if not found or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status<>'active' or char_length(clean_reason) not between 3 and 500 then raise exception 'invalid_transition'; end if;
  perform private.lock_unit_finance(item.property_id,item.unit_id);
  select * into item from public.accounts_receivable where id=target_receivable_id for update;
  if not found or item.status<>'active' then raise exception 'invalid_transition'; end if;
  -- Los pagos aplicados a esta obligación se liberan: el dinero queda como pago sin aplicar.
  select coalesce(jsonb_agg(jsonb_build_object('payment_id',pa.payment_id,'amount',pa.amount)),'[]'::jsonb) into released
  from public.payment_allocations pa where pa.property_id=item.property_id and pa.receivable_id=item.id;
  delete from public.payment_allocations pa where pa.property_id=item.property_id and pa.receivable_id=item.id;
  update public.accounts_receivable set status='void',void_reason=clean_reason,voided_by=auth.uid(),voided_at=now() where id=item.id;
  insert into public.activity_events(property_id,receivable_id,actor_id,event_type,previous_state,new_state,description) values(item.property_id,item.id,auth.uid(),'receivable_voided','active','void','Obligación anulada: '||clean_reason);
  perform private.write_property_audit(item.property_id,'receivable.voided','accounts_receivable',item.id,jsonb_build_object('reason',clean_reason,'released_allocations',released));
  perform private.enqueue_finance_notification(item.property_id,item.unit_id,'receivable',item.id,'receivable_voided','Obligación anulada','La administración anuló una obligación de tu cuenta.','receivable:'||item.id||':void',jsonb_build_object('receivable_id',item.id,'concept',item.concept,'amount',item.amount,'currency',item.currency));
end;
$$;

commit;

select pg_get_functiondef('public.void_receivable(uuid,text)'::regprocedure) not like '%receivable_has_active_payment%' as anular_con_pagos;
