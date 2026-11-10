-- Pagos sin sobrante (10/11/2026, pedido de Alejandro): un pago nunca queda «sin aplicar».
-- * Lo que la administración no reparta a mano baja solo las deudas con saldo del apartamento, de la que vence
--   primero a la última.
-- * Si después de eso todavía sobra dinero (el pago es mayor que lo que debe el residente), el pago no se registra:
--   error payment_exceeds_debt y no se guarda nada.
-- Aplica a todo lo que registra pagos: el formulario del admin, «Aceptar pago» de un comprobante y las cuotas del
-- acuerdo, porque todos pasan por public.record_payment.
-- Los pagos que ya quedaron con sobrante NO se tocan: la consulta del final los lista para revisarlos (anularlos y
-- registrarlos de nuevo bien repartidos).
begin;

create or replace function public.record_payment(target_property_id uuid,target_unit_id uuid,target_amount numeric,target_paid_on date,target_reference text,target_allocations jsonb,target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare created_id uuid; item jsonb; receivable public.accounts_receivable%rowtype; allocation_amount numeric; allocation_total numeric:=0; outstanding numeric;
  leftover numeric; take numeric;
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if target_amount<=0 or target_paid_on is null or target_idempotency_key is null or target_allocations is null or jsonb_typeof(target_allocations)<>'array' or jsonb_array_length(target_allocations)>100 then raise exception 'invalid_input'; end if;
  if not exists(select 1 from public.units where id=target_unit_id and property_id=target_property_id and status='active') then raise exception 'unit_not_found'; end if;
  perform private.lock_unit_finance(target_property_id,target_unit_id);
  for item in select value from jsonb_array_elements(target_allocations) order by value->>'receivable_id' loop
    allocation_amount:=(item->>'amount')::numeric;
    if allocation_amount<=0 then raise exception 'invalid_allocation'; end if;
    allocation_total:=allocation_total+allocation_amount;
  end loop;
  if allocation_total>target_amount then raise exception 'payment_overallocated'; end if;
  insert into public.payments(property_id,unit_id,amount,currency,paid_on,reference,recorded_by,idempotency_key)
  values(target_property_id,target_unit_id,target_amount,'COP',target_paid_on,nullif(trim(target_reference),''),auth.uid(),target_idempotency_key) returning id into created_id;
  -- 1. Lo que la administración repartió a mano.
  for item in select value from jsonb_array_elements(target_allocations) order by value->>'receivable_id' loop
    select * into receivable from public.accounts_receivable where id=(item->>'receivable_id')::uuid and property_id=target_property_id and unit_id=target_unit_id for update;
    if not found or receivable.status<>'active' or receivable.currency<>'COP' then raise exception 'invalid_receivable'; end if;
    allocation_amount:=(item->>'amount')::numeric; outstanding:=private.receivable_outstanding(receivable.id);
    if allocation_amount>outstanding then raise exception 'receivable_overallocated'; end if;
    insert into public.payment_allocations(property_id,unit_id,payment_id,receivable_id,amount,recorded_by) values(target_property_id,target_unit_id,created_id,receivable.id,allocation_amount,auth.uid());
  end loop;
  -- 2. Lo que no se repartió baja las deudas con saldo, de la que vence primero a la última.
  leftover:=target_amount-allocation_total;
  if leftover>0 then
    for receivable in select * from public.accounts_receivable ar
        where ar.property_id=target_property_id and ar.unit_id=target_unit_id and ar.status='active' and ar.currency='COP'
        order by ar.due_on, ar.issued_on, ar.created_at, ar.id for update loop
      exit when leftover<=0;
      outstanding:=private.receivable_outstanding(receivable.id);
      continue when outstanding<=0;
      take:=least(leftover,outstanding);
      if exists(select 1 from public.payment_allocations where property_id=target_property_id and payment_id=created_id and receivable_id=receivable.id) then
        update public.payment_allocations set amount=amount+take where property_id=target_property_id and payment_id=created_id and receivable_id=receivable.id;
      else
        insert into public.payment_allocations(property_id,unit_id,payment_id,receivable_id,amount,recorded_by) values(target_property_id,target_unit_id,created_id,receivable.id,take,auth.uid());
      end if;
      allocation_total:=allocation_total+take; leftover:=leftover-take;
    end loop;
  end if;
  -- 3. No puede sobrar nada: un pago mayor que lo que debe el apartamento no se registra.
  if leftover>0 then raise exception 'payment_exceeds_debt'; end if;
  perform private.sync_unit_agreements(target_property_id,target_unit_id);
  insert into public.activity_events(property_id,payment_id,actor_id,event_type,new_state,description) values(target_property_id,created_id,auth.uid(),'payment_recorded','posted','Pago registrado');
  perform private.write_property_audit(target_property_id,'payment.recorded','payment',created_id,jsonb_build_object('unit_id',target_unit_id,'amount',target_amount,'allocated',allocation_total));
  perform private.enqueue_finance_notification(target_property_id,target_unit_id,'payment',created_id,'payment_recorded','Pago registrado','La administración registró un pago en tu cuenta.','payment:'||created_id||':recorded',jsonb_build_object('payment_id',created_id,'amount',target_amount,'currency','COP','paid_on',target_paid_on));
  return created_id;
exception when unique_violation then raise exception 'duplicate_payment';
end;
$$;

revoke all on function public.record_payment(uuid,uuid,numeric,date,text,jsonb,uuid) from public,anon;
grant execute on function public.record_payment(uuid,uuid,numeric,date,text,jsonb,uuid) to authenticated;

commit;

-- Debe dar true.
select pg_get_functiondef('public.record_payment(uuid,uuid,numeric,date,text,jsonb,uuid)'::regprocedure) like '%payment_exceeds_debt%' as pagos_sin_sobrante;

-- Pagos vigentes que ya quedaron con sobrante (para revisarlos uno por uno).
select pr.name as conjunto, b.name || ' · ' || u.code as apartamento, p.paid_on, p.amount,
  p.amount - coalesce((select sum(pa.amount) from public.payment_allocations pa where pa.property_id = p.property_id and pa.payment_id = p.id), 0) as sin_aplicar
from public.payments p
join public.units u on u.property_id = p.property_id and u.id = p.unit_id
join public.buildings b on b.property_id = u.property_id and b.id = u.building_id
join public.properties pr on pr.id = p.property_id
where p.status = 'posted'
  and p.amount > coalesce((select sum(pa.amount) from public.payment_allocations pa where pa.property_id = p.property_id and pa.payment_id = p.id), 0)
order by pr.name, apartamento, p.paid_on;
