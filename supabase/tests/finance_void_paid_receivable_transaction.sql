-- Synthetic payment and obligation. Run after 20261014150000_guard_paid_receivable_void.sql.
-- The entire test rolls back, including notifications and audit records.
begin;
do $test$
declare
  target_property_id uuid := '1bde3475-3ed2-4f57-bd13-39784b12d2a6';
  target_unit_id uuid := '5a5beea2-9119-46d3-bb1a-4ebb4faf2501';
  admin_id uuid;
  debt_id uuid;
  payment_id uuid;
begin
  select user_id into admin_id from public.property_members
  where property_id=target_property_id and status='active' and 'administrator'=any(roles)
  limit 1;
  if admin_id is null then raise exception 'admin_fixture_missing'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  debt_id := public.create_receivable(target_property_id,target_unit_id,'PRUEBA TÉCNICA — anulación con pago',1,current_date,current_date+1,null);
  payment_id := public.record_payment(target_property_id,target_unit_id,1,current_date,'TEST-VOID-PAID',jsonb_build_array(jsonb_build_object('receivable_id',debt_id,'amount',1)),gen_random_uuid());
  begin
    perform public.void_receivable(debt_id,'Intento con pago activo');
    raise exception 'paid_receivable_void_allowed';
  exception when others then
    if sqlerrm<>'receivable_has_active_payment' then raise; end if;
  end;
  if (select status from public.accounts_receivable where id=debt_id)<>'active' then raise exception 'debt_changed_after_denial'; end if;
  perform public.void_payment(payment_id,'Anulación de pago sintético');
  perform public.void_receivable(debt_id,'Anulación de obligación sintética');
  if (select status from public.payments where id=payment_id)<>'void' or (select status from public.accounts_receivable where id=debt_id)<>'void' then raise exception 'ordered_void_failed'; end if;
end $test$;
select 'finance_void_paid_receivable_passed_rollback' as result;
rollback;
