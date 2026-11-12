-- El residente aplica su saldo a favor (13/11/2026, pedido de Alejandro). Además de la administración, quien tiene
-- acceso a la cartera del apartamento (residente con acceso financiero) puede aplicar el saldo a favor de su
-- apartamento a una de sus obligaciones con saldo, desde la tarjeta «Saldo a favor». Se aplica de una vez (no hay
-- dinero nuevo que revisar) y queda como el mismo abono «Saldo a favor · …», con quién lo hizo en la auditoría.
-- Registrar y anular saldos a favor sigue siendo solo de la administración.
begin;

create or replace function public.apply_unit_credit(target_property_id uuid, target_credit_id uuid, target_receivable_id uuid, target_amount numeric, target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare credit public.unit_credits%rowtype; receivable public.accounts_receivable%rowtype; created_id uuid; zone text; by_admin boolean;
begin
  if auth.uid() is null then raise exception 'not_authorized'; end if;
  if target_amount is null or target_amount <= 0 or target_idempotency_key is null then raise exception 'invalid_input'; end if;
  select * into credit from public.unit_credits where id = target_credit_id and property_id = target_property_id for update;
  if not found or not private.can_access_unit_finance(target_property_id, credit.unit_id) then raise exception 'not_authorized'; end if;
  if credit.status <> 'active' then raise exception 'credit_not_found'; end if;
  by_admin := private.is_active_member(target_property_id, 'administrator');
  perform private.lock_unit_finance(target_property_id, credit.unit_id);
  select * into receivable from public.accounts_receivable where id = target_receivable_id and property_id = target_property_id and unit_id = credit.unit_id for update;
  if not found or receivable.status <> 'active' or receivable.currency <> 'COP' then raise exception 'invalid_receivable'; end if;
  if target_amount > private.credit_remaining(credit.id) then raise exception 'credit_insufficient'; end if;
  if target_amount > private.receivable_outstanding(receivable.id) then raise exception 'receivable_overallocated'; end if;
  select timezone into zone from public.properties where id = target_property_id;
  insert into public.payments(property_id, unit_id, amount, currency, paid_on, reference, recorded_by, idempotency_key, credit_id)
  values (target_property_id, credit.unit_id, target_amount, 'COP', (now() at time zone zone)::date, left('Saldo a favor · ' || credit.concept, 120), auth.uid(), target_idempotency_key, credit.id)
  returning id into created_id;
  insert into public.payment_allocations(property_id, unit_id, payment_id, receivable_id, amount, recorded_by)
  values (target_property_id, credit.unit_id, created_id, receivable.id, target_amount, auth.uid());
  perform private.sync_unit_agreements(target_property_id, credit.unit_id);
  insert into public.activity_events(property_id, payment_id, actor_id, event_type, new_state, description)
  values (target_property_id, created_id, auth.uid(), 'payment_recorded', 'posted', case when by_admin then 'Saldo a favor aplicado' else 'Saldo a favor aplicado por el residente' end);
  perform private.write_property_audit(target_property_id, 'credit.applied', 'unit_credit', credit.id,
    jsonb_build_object('unit_id', credit.unit_id, 'receivable_id', receivable.id, 'payment_id', created_id, 'amount', target_amount, 'by', case when by_admin then 'administration' else 'resident' end));
  return created_id;
exception when unique_violation then raise exception 'duplicate_payment';
end;
$$;
revoke all on function public.apply_unit_credit(uuid, uuid, uuid, numeric, uuid) from public, anon;
grant execute on function public.apply_unit_credit(uuid, uuid, uuid, numeric, uuid) to authenticated;

commit;

-- Debe dar true.
select pg_get_functiondef('public.apply_unit_credit(uuid,uuid,uuid,numeric,uuid)'::regprocedure) like '%por el residente%' as residente_aplica_saldo;
