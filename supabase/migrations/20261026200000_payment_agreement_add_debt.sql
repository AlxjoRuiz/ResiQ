-- Sumar una deuda nueva a un acuerdo de pago activo (decisión de Alejandro, 26/10/2026). El admin
-- decide: el saldo de la obligación se suma al total del acuerdo y se reparte por igual entre las
-- cuotas pendientes (mismas fechas). Solo obligaciones creadas después del acuerdo, una sola vez.
begin;

create table public.payment_agreement_additions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  agreement_id uuid not null,
  receivable_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(receivable_id),
  foreign key(property_id,agreement_id) references public.payment_agreements(property_id,id) on delete restrict,
  foreign key(property_id,receivable_id) references public.accounts_receivable(property_id,id) on delete restrict
);
alter table public.payment_agreement_additions enable row level security;
revoke all on public.payment_agreement_additions from public,anon,authenticated;
grant select on public.payment_agreement_additions to authenticated;
create policy payment_agreement_additions_read_finance on public.payment_agreement_additions for select to authenticated
using (exists(select 1 from public.payment_agreements pa where pa.id=agreement_id and pa.property_id=payment_agreement_additions.property_id
  and private.can_access_unit_finance(pa.property_id,pa.unit_id)));

create or replace function public.add_receivable_to_payment_agreement(target_receivable_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare item public.accounts_receivable%rowtype; agreement public.payment_agreements%rowtype; amount_value numeric;
  paid numeric; covered numeric:=0; pending_ids uuid[]:='{}'; installment record; share numeric; remainder numeric;
begin
  select * into item from public.accounts_receivable where id=target_receivable_id;
  if not found or auth.uid() is null or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  perform private.lock_unit_finance(item.property_id,item.unit_id);
  select * into agreement from public.payment_agreements where property_id=item.property_id and unit_id=item.unit_id and status='active' for update;
  if not found then raise exception 'no_active_agreement'; end if;
  if item.status<>'active' or item.created_at<agreement.created_at then raise exception 'invalid_receivable'; end if;
  if exists(select 1 from public.payment_agreement_additions where receivable_id=item.id) then raise exception 'already_added'; end if;
  amount_value:=private.receivable_outstanding(item.id);
  if amount_value<=0 then raise exception 'invalid_receivable'; end if;
  -- Cuotas pendientes: las que los pagos posteriores al acuerdo aún no completan (misma regla de la vista).
  paid:=private.payment_agreement_paid(agreement.id);
  for installment in select id,amount from public.payment_agreement_installments where agreement_id=agreement.id order by number loop
    covered:=covered+installment.amount;
    if covered>paid then pending_ids:=pending_ids||installment.id; end if;
  end loop;
  if cardinality(pending_ids)=0 then raise exception 'no_pending_installments'; end if;
  share:=floor(amount_value/cardinality(pending_ids)*100)/100; remainder:=amount_value-share*cardinality(pending_ids);
  update public.payment_agreement_installments set amount=amount+share+case when id=pending_ids[cardinality(pending_ids)] then remainder else 0 end
  where id=any(pending_ids);
  update public.payment_agreements set total_amount=total_amount+amount_value where id=agreement.id;
  insert into public.payment_agreement_additions(property_id,agreement_id,receivable_id,amount,created_by)
  values(item.property_id,agreement.id,item.id,amount_value,auth.uid());
  perform private.write_property_audit(item.property_id,'payment_agreement.debt_added','payment_agreement',agreement.id,
    jsonb_build_object('receivable_id',item.id,'amount',amount_value,'installments',cardinality(pending_ids)));
end;
$$;
revoke all on function public.add_receivable_to_payment_agreement(uuid) from public,anon;
grant execute on function public.add_receivable_to_payment_agreement(uuid) to authenticated;

notify pgrst,'reload schema';
commit;

select
  has_function_privilege('authenticated','public.add_receivable_to_payment_agreement(uuid)','execute') as sumar_deuda_disponible,
  has_table_privilege('authenticated','public.payment_agreement_additions','select') and not has_table_privilege('authenticated','public.payment_agreement_additions','insert') as sumas_solo_por_funcion;
