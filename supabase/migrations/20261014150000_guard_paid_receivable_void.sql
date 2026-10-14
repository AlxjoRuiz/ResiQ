-- A paid obligation must not be voided while a posted payment is allocated to it.
begin;

create or replace function public.void_receivable(target_receivable_id uuid,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.accounts_receivable%rowtype; clean_reason text:=trim(target_reason);
begin
  select * into item from public.accounts_receivable where id=target_receivable_id;
  if not found or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status<>'active' or char_length(clean_reason) not between 3 and 500 then raise exception 'invalid_transition'; end if;
  perform private.lock_unit_finance(item.property_id,item.unit_id);
  select * into item from public.accounts_receivable where id=target_receivable_id for update;
  if not found or item.status<>'active' then raise exception 'invalid_transition'; end if;
  if exists (
    select 1 from public.payment_allocations pa
    join public.payments p on p.property_id=pa.property_id and p.id=pa.payment_id
    where pa.property_id=item.property_id and pa.receivable_id=item.id and p.status='posted'
  ) then raise exception 'receivable_has_active_payment'; end if;
  update public.accounts_receivable set status='void',void_reason=clean_reason,voided_by=auth.uid(),voided_at=now() where id=item.id;
  insert into public.activity_events(property_id,receivable_id,actor_id,event_type,previous_state,new_state,description) values(item.property_id,item.id,auth.uid(),'receivable_voided','active','void','Obligación anulada: '||clean_reason);
  perform private.write_property_audit(item.property_id,'receivable.voided','accounts_receivable',item.id,jsonb_build_object('reason',clean_reason));
  perform private.enqueue_finance_notification(item.property_id,item.unit_id,'receivable',item.id,'receivable_voided','Obligación anulada','La administración anuló una obligación de tu cuenta.','receivable:'||item.id||':void',jsonb_build_object('receivable_id',item.id,'concept',item.concept,'amount',item.amount,'currency',item.currency));
end;
$$;

revoke all on function public.void_receivable(uuid,text) from public,anon;
grant execute on function public.void_receivable(uuid,text) to authenticated;

commit;
