-- Acuerdo de pago amarrado a sus deudas (05/11/2026, pedido de Alejandro: «no podemos dejar saldo a favor ni en
-- contra, todo debe ser lo mismo»).
-- * El acuerdo guarda las deudas que cubre (payment_agreement_debts). Al crearlo, el total es exactamente la suma
--   del saldo de esas deudas y las cuotas deben sumar ese total.
-- * Lo que falta del acuerdo es siempre lo que falta de esas deudas: si se pagan, se anulan o se anula un pago,
--   el acuerdo cambia igual. Los pagos de otras deudas no cuentan.
-- * Las cuotas: se cubren en orden con lo pagado a las deudas del acuerdo después de crearlo; un abono baja por
--   igual las cuotas que faltan (como antes) y, si lo que falta de las deudas es distinto de lo que suman las
--   cuotas pendientes (por ejemplo, se anuló una deuda), las últimas cuotas se ajustan para que sumen lo mismo.
-- * El acuerdo queda «completed» (Pagado) cuando sus deudas llegan a cero y vuelve a «active» si se anula un pago.
-- * El pago de una cuota se aplica completo a las deudas del acuerdo y no puede pasar de lo que falta.
-- * Los acuerdos vigentes se amarran a sus deudas: las que tenían saldo al crearlos, las que recibieron pagos
--   desde entonces y las que se sumaron después.
begin;

-- 1. Deudas de cada acuerdo.
create table public.payment_agreement_debts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  agreement_id uuid not null,
  receivable_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(agreement_id, receivable_id),
  foreign key(property_id, agreement_id) references public.payment_agreements(property_id, id) on delete restrict,
  foreign key(property_id, receivable_id) references public.accounts_receivable(property_id, id) on delete restrict
);
create index payment_agreement_debts_receivable_idx on public.payment_agreement_debts(property_id, receivable_id);
alter table public.payment_agreement_debts enable row level security;
revoke all on public.payment_agreement_debts from public, anon, authenticated;
grant select on public.payment_agreement_debts to authenticated;
create policy payment_agreement_debts_read_finance on public.payment_agreement_debts for select to authenticated
using (exists(select 1 from public.payment_agreements pa where pa.id = agreement_id and pa.property_id = payment_agreement_debts.property_id
  and private.can_access_unit_finance(pa.property_id, pa.unit_id)));

-- 2. Lo que falta y lo pagado del acuerdo.
create or replace function private.agreement_remaining(target_agreement_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(private.receivable_outstanding(d.receivable_id)), 0) from public.payment_agreement_debts d where d.agreement_id = target_agreement_id;
$$;
revoke all on function private.agreement_remaining(uuid) from public, anon, authenticated;

create or replace function private.agreement_paid(target_agreement_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(pa.amount), 0)
  from public.payment_agreements g
  join public.payment_agreement_debts d on d.agreement_id = g.id
  join public.payment_allocations pa on pa.property_id = d.property_id and pa.receivable_id = d.receivable_id
  join public.payments p on p.property_id = pa.property_id and p.id = pa.payment_id and p.status = 'posted' and p.created_at >= g.created_at
  where g.id = target_agreement_id;
$$;
revoke all on function private.agreement_paid(uuid) from public, anon, authenticated;

-- 3. Calendario del acuerdo: lo que falta de cada cuota. Es el único cálculo; lo usan el admin, el residente y la abogada.
create or replace function private.agreement_schedule(target_agreement_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare g public.payment_agreements%rowtype; today date; remaining numeric; paid numeric;
  ids uuid[]; nums integer[]; plans numeric[]; dates date[]; dues numeric[]; n integer; k integer := 0; i integer;
  covered numeric := 0; leftover numeric; pending integer; share numeric; diff numeric; take numeric; result jsonb := '[]'::jsonb; state text; next_index integer;
begin
  select * into g from public.payment_agreements where id = target_agreement_id;
  if not found then return null; end if;
  select (now() at time zone p.timezone)::date into today from public.properties p where p.id = g.property_id;
  remaining := private.agreement_remaining(g.id);
  paid := private.agreement_paid(g.id);
  select array_agg(x.id order by x.number), array_agg(x.number order by x.number), array_agg(x.amount order by x.number), array_agg(x.due_on order by x.number)
    into ids, nums, plans, dates from public.payment_agreement_installments x where x.agreement_id = g.id;
  n := coalesce(cardinality(ids), 0);
  if n = 0 then return jsonb_build_object('agreement_id', g.id, 'status', g.status, 'total', g.total_amount, 'remaining', remaining, 'paid', paid, 'installments', '[]'::jsonb); end if;
  dues := array_fill(0::numeric, array[n]);
  -- Cuotas cubiertas completas, en orden.
  for i in 1..n loop
    exit when covered + plans[i] > paid;
    covered := covered + plans[i]; k := i;
  end loop;
  -- Abono: lo que sobra baja por igual las cuotas que faltan; la última recibe el resto.
  leftover := paid - covered; pending := n - k;
  if pending > 0 then
    share := floor(leftover / pending);
    for i in k + 1..n loop dues[i] := plans[i] - share; end loop;
    dues[n] := dues[n] - (leftover - share * pending);
  end if;
  -- Ninguna cuota queda negativa: lo que sobra pasa a la diferencia.
  for i in 1..n loop if dues[i] < 0 then dues[i] := 0; end if; end loop;
  -- Las cuotas que faltan suman exactamente lo que falta de las deudas del acuerdo.
  diff := remaining - (select coalesce(sum(v), 0) from unnest(dues) v);
  if diff < 0 then
    for i in reverse n..1 loop
      exit when diff >= 0;
      take := least(dues[i], -diff); dues[i] := dues[i] - take; diff := diff + take;
    end loop;
  elsif diff > 0 then
    -- Falta más (por ejemplo, se anuló un pago): va a la primera cuota pendiente o, si no hay, a la última.
    next_index := null;
    for i in 1..n loop if dues[i] > 0 then next_index := i; exit; end if; end loop;
    if next_index is null then next_index := n; end if;
    dues[next_index] := dues[next_index] + diff;
  end if;
  for i in 1..n loop
    state := case when dues[i] > 0 then case when dates[i] < today then 'late' else 'pending' end
      when i <= k then 'paid' else 'settled' end;
    result := result || jsonb_build_array(jsonb_build_object('id', ids[i], 'number', nums[i], 'due_on', dates[i], 'amount', plans[i], 'due_amount', dues[i], 'state', state));
  end loop;
  return jsonb_build_object('agreement_id', g.id, 'status', g.status, 'total', g.total_amount, 'remaining', remaining, 'paid', paid, 'installments', result);
end;
$$;
revoke all on function private.agreement_schedule(uuid) from public, anon, authenticated;

-- Para las pantallas: quien ve la cartera del apartamento (admin o residente) o la abogada del conjunto.
create or replace function public.payment_agreement_schedule(target_agreement_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare g public.payment_agreements%rowtype;
begin
  select * into g from public.payment_agreements where id = target_agreement_id;
  if not found or auth.uid() is null or not (private.can_access_unit_finance(g.property_id, g.unit_id) or private.legal_can_view(g.property_id)) then raise exception 'not_authorized'; end if;
  return private.agreement_schedule(g.id);
end;
$$;
revoke all on function public.payment_agreement_schedule(uuid) from public, anon;
grant execute on function public.payment_agreement_schedule(uuid) to authenticated;

-- 4. Estado del acuerdo según sus deudas: Pagado cuando llegan a cero; vuelve a vigente si se reabre.
create or replace function private.sync_unit_agreements(target_property_id uuid, target_unit_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.payment_agreements g set status = 'completed', completed_at = now()
  where g.property_id = target_property_id and g.unit_id = target_unit_id and g.status = 'active'
    and exists(select 1 from public.payment_agreement_debts d where d.agreement_id = g.id)
    and private.agreement_remaining(g.id) <= 0;
  update public.payment_agreements g set status = 'active', completed_at = null
  where g.id = (select c.id from public.payment_agreements c where c.property_id = target_property_id and c.unit_id = target_unit_id and c.status = 'completed'
      and private.agreement_remaining(c.id) > 0 order by c.created_at desc limit 1)
    and not exists(select 1 from public.payment_agreements o where o.property_id = target_property_id and o.unit_id = target_unit_id and o.status = 'active');
end;
$$;
revoke all on function private.sync_unit_agreements(uuid, uuid) from public, anon, authenticated;

create or replace function private.sync_agreements_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.sync_unit_agreements(new.property_id, new.unit_id);
  return new;
end;
$$;
revoke all on function private.sync_agreements_trigger() from public, anon, authenticated;

drop trigger if exists payments_complete_agreements on public.payments;
create trigger payment_allocations_sync_agreements after insert on public.payment_allocations
for each row execute function private.sync_agreements_trigger();
create trigger payments_sync_agreements after update of status on public.payments
for each row when (old.status is distinct from new.status) execute function private.sync_agreements_trigger();
create trigger receivables_sync_agreements after update of status on public.accounts_receivable
for each row when (old.status is distinct from new.status) execute function private.sync_agreements_trigger();
drop function if exists private.complete_agreements_after_payment();
drop function if exists private.complete_covered_payment_agreements(uuid, uuid);

-- 5. Crear el acuerdo con sus deudas: total = suma del saldo de las deudas; las cuotas suman exactamente eso.
drop function if exists public.create_payment_agreement(uuid, uuid, text, jsonb);
create or replace function public.create_payment_agreement(target_property_id uuid, target_unit_id uuid, target_notes text, target_installments jsonb, target_receivable_ids uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_id uuid; item jsonb; seq integer := 0; total numeric := 0; plan_total numeric := 0; amount_value numeric; due_value date;
  clean_notes text := nullif(trim(target_notes), ''); debt record; debt_count integer := 0;
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.units where id = target_unit_id and property_id = target_property_id and status = 'active') then raise exception 'unit_not_found'; end if;
  if target_installments is null or jsonb_typeof(target_installments) <> 'array' or jsonb_array_length(target_installments) not between 1 and 120
    or target_receivable_ids is null or cardinality(target_receivable_ids) not between 1 and 200
    or (select count(distinct v) from unnest(target_receivable_ids) v) <> cardinality(target_receivable_ids)
    or (clean_notes is not null and char_length(clean_notes) not between 3 and 1000) then raise exception 'invalid_input'; end if;
  perform private.lock_unit_finance(target_property_id, target_unit_id);
  -- Un acuerdo que ya quedó pagado no bloquea uno nuevo.
  perform private.sync_unit_agreements(target_property_id, target_unit_id);
  if exists(select 1 from public.payment_agreements where property_id = target_property_id and unit_id = target_unit_id and status = 'active') then raise exception 'agreement_exists'; end if;
  for debt in select ar.id, private.receivable_outstanding(ar.id) as owed from public.accounts_receivable ar
    where ar.id = any(target_receivable_ids) and ar.property_id = target_property_id and ar.unit_id = target_unit_id and ar.status = 'active' loop
    if debt.owed <= 0 then raise exception 'invalid_receivable'; end if;
    total := total + debt.owed; debt_count := debt_count + 1;
  end loop;
  if debt_count <> cardinality(target_receivable_ids) then raise exception 'invalid_receivable'; end if;
  for item in select value from jsonb_array_elements(target_installments) loop
    amount_value := round((item ->> 'amount')::numeric, 2); due_value := (item ->> 'due_on')::date;
    if amount_value is null or amount_value <= 0 or due_value is null then raise exception 'invalid_input'; end if;
    plan_total := plan_total + amount_value;
  end loop;
  if plan_total <> total then raise exception 'agreement_total_mismatch'; end if;
  insert into public.payment_agreements(property_id, unit_id, total_amount, notes, created_by)
  values(target_property_id, target_unit_id, total, clean_notes, auth.uid()) returning id into created_id;
  for item in select value from jsonb_array_elements(target_installments) order by (value ->> 'due_on')::date loop
    seq := seq + 1;
    insert into public.payment_agreement_installments(property_id, agreement_id, number, amount, due_on)
    values(target_property_id, created_id, seq, round((item ->> 'amount')::numeric, 2), (item ->> 'due_on')::date);
  end loop;
  insert into public.payment_agreement_debts(property_id, agreement_id, receivable_id, amount, created_by)
  select target_property_id, created_id, ar.id, private.receivable_outstanding(ar.id), auth.uid()
  from public.accounts_receivable ar where ar.id = any(target_receivable_ids);
  perform private.write_property_audit(target_property_id, 'payment_agreement.created', 'payment_agreement', created_id,
    jsonb_build_object('unit_id', target_unit_id, 'installments', seq, 'total', total, 'debts', debt_count));
  return created_id;
end;
$$;
revoke all on function public.create_payment_agreement(uuid, uuid, text, jsonb, uuid[]) from public, anon;
grant execute on function public.create_payment_agreement(uuid, uuid, text, jsonb, uuid[]) to authenticated;

-- 6. Sumar una deuda al acuerdo vigente: su saldo entra al total y se reparte entre las cuotas que faltan.
create or replace function public.add_receivable_to_payment_agreement(target_receivable_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.accounts_receivable%rowtype; agreement public.payment_agreements%rowtype; amount_value numeric;
  schedule jsonb; pending_ids uuid[]; share numeric; remainder numeric;
begin
  select * into item from public.accounts_receivable where id = target_receivable_id;
  if not found or auth.uid() is null or not private.is_active_member(item.property_id, 'administrator') then raise exception 'not_authorized'; end if;
  perform private.lock_unit_finance(item.property_id, item.unit_id);
  select * into agreement from public.payment_agreements where property_id = item.property_id and unit_id = item.unit_id and status = 'active' for update;
  if not found then raise exception 'no_active_agreement'; end if;
  if item.status <> 'active' then raise exception 'invalid_receivable'; end if;
  if exists(select 1 from public.payment_agreement_debts d join public.payment_agreements g on g.id = d.agreement_id
    where d.receivable_id = item.id and g.status in ('active', 'completed')) then raise exception 'already_added'; end if;
  amount_value := private.receivable_outstanding(item.id);
  if amount_value <= 0 then raise exception 'invalid_receivable'; end if;
  schedule := private.agreement_schedule(agreement.id);
  select array_agg((x ->> 'id')::uuid order by (x ->> 'number')::integer) into pending_ids
  from jsonb_array_elements(schedule -> 'installments') x where (x ->> 'due_amount')::numeric > 0;
  -- Sin cuotas pendientes, la deuda va a la última cuota.
  if pending_ids is null then
    select array[x.id] into pending_ids from public.payment_agreement_installments x where x.agreement_id = agreement.id order by x.number desc limit 1;
  end if;
  if pending_ids is null then raise exception 'no_pending_installments'; end if;
  share := floor(amount_value / cardinality(pending_ids) * 100) / 100; remainder := amount_value - share * cardinality(pending_ids);
  update public.payment_agreement_installments set amount = amount + share + case when id = pending_ids[cardinality(pending_ids)] then remainder else 0 end
  where id = any(pending_ids);
  update public.payment_agreements set total_amount = total_amount + amount_value where id = agreement.id;
  insert into public.payment_agreement_debts(property_id, agreement_id, receivable_id, amount, created_by)
  values(item.property_id, agreement.id, item.id, amount_value, auth.uid());
  perform private.write_property_audit(item.property_id, 'payment_agreement.debt_added', 'payment_agreement', agreement.id,
    jsonb_build_object('receivable_id', item.id, 'amount', amount_value, 'installments', cardinality(pending_ids)));
end;
$$;
revoke all on function public.add_receivable_to_payment_agreement(uuid) from public, anon;
grant execute on function public.add_receivable_to_payment_agreement(uuid) to authenticated;

-- 7. Pago desde un comprobante de cuota: completo a las deudas del acuerdo y sin pasar de lo que falta.
create or replace function public.record_evidence_payment(
  target_evidence_id uuid, target_amount numeric, target_paid_on date, target_reference text, target_allocations jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare item public.finance_payment_evidence%rowtype; created_payment uuid; covering_agreement uuid; allocated numeric;
begin
  select * into item from public.finance_payment_evidence where id = target_evidence_id for update;
  if not found or auth.uid() is null or not private.is_active_member(item.property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if item.payment_id is not null then raise exception 'evidence_already_registered'; end if;
  if item.agreement_installment_id is not null then
    select g.id into covering_agreement from public.payment_agreement_installments x join public.payment_agreements g on g.id = x.agreement_id
    where x.id = item.agreement_installment_id and g.status = 'active';
    if covering_agreement is null then raise exception 'agreement_not_active'; end if;
    select coalesce(sum((a ->> 'amount')::numeric), 0) into allocated from jsonb_array_elements(coalesce(target_allocations, '[]'::jsonb)) a;
    if allocated <> target_amount or target_amount > private.agreement_remaining(covering_agreement)
      or exists(select 1 from jsonb_array_elements(coalesce(target_allocations, '[]'::jsonb)) a
        where not exists(select 1 from public.payment_agreement_debts d where d.agreement_id = covering_agreement and d.receivable_id = (a ->> 'receivable_id')::uuid))
    then raise exception 'agreement_payment_mismatch'; end if;
  end if;
  created_payment := public.record_payment(item.property_id, item.unit_id, target_amount, target_paid_on, target_reference, coalesce(target_allocations, '[]'::jsonb), item.id);
  update public.finance_payment_evidence set payment_id = created_payment,
    received_at = coalesce(received_at, now()), received_by = coalesce(received_by, auth.uid()) where id = item.id;
  perform private.write_property_audit(item.property_id, 'payment_evidence.accepted', 'finance_payment_evidence', item.id,
    jsonb_build_object('payment_id', created_payment, 'amount', target_amount, 'from_form', true));
  return created_payment;
end;
$$;
revoke all on function public.record_evidence_payment(uuid, numeric, date, text, jsonb) from public, anon;
grant execute on function public.record_evidence_payment(uuid, numeric, date, text, jsonb) to authenticated;

-- 8. Acuerdos vigentes de antes: se amarran a sus deudas (las de antes del acuerdo que tenían saldo o recibieron
--    pagos después de crearlo, y las que se sumaron después), con el saldo que tenían al crearse el acuerdo.
insert into public.payment_agreement_debts(property_id, agreement_id, receivable_id, amount)
select g.property_id, g.id, ar.id,
  private.receivable_outstanding(ar.id) + coalesce((select sum(pa.amount) from public.payment_allocations pa join public.payments p on p.property_id = pa.property_id and p.id = pa.payment_id
    where pa.property_id = ar.property_id and pa.receivable_id = ar.id and p.status = 'posted' and p.created_at >= g.created_at), 0)
from public.payment_agreements g
join public.accounts_receivable ar on ar.property_id = g.property_id and ar.unit_id = g.unit_id and ar.status = 'active'
where g.status = 'active'
  and (exists(select 1 from public.payment_agreement_additions a where a.agreement_id = g.id and a.receivable_id = ar.id)
    or (ar.created_at < g.created_at and (private.receivable_outstanding(ar.id) > 0
      or exists(select 1 from public.payment_allocations pa join public.payments p on p.property_id = pa.property_id and p.id = pa.payment_id
        where pa.property_id = ar.property_id and pa.receivable_id = ar.id and p.status = 'posted' and p.created_at >= g.created_at))))
  and private.receivable_outstanding(ar.id) + coalesce((select sum(pa.amount) from public.payment_allocations pa join public.payments p on p.property_id = pa.property_id and p.id = pa.payment_id
    where pa.property_id = ar.property_id and pa.receivable_id = ar.id and p.status = 'posted' and p.created_at >= g.created_at), 0) > 0
on conflict (agreement_id, receivable_id) do nothing;

select private.sync_unit_agreements(u.property_id, u.unit_id)
from (select distinct property_id, unit_id from public.payment_agreements where status = 'active') u;

-- 9. La abogada ve el mismo calendario del acuerdo (lo que falta de cada cuota).
create or replace function public.legal_unit_detail(target_property_id uuid, target_unit_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; today date;
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.units where property_id = target_property_id and id = target_unit_id) then raise exception 'unit_not_found'; end if;
  select (now() at time zone p.timezone)::date into today from public.properties p where p.id = target_property_id;
  select jsonb_build_object(
    'unit', (select jsonb_build_object('building', b.name, 'code', u.code, 'floor', u.floor) from public.units u join public.buildings b on b.property_id = u.property_id and b.id = u.building_id where u.id = target_unit_id),
    'property', (select p.name from public.properties p where p.id = target_property_id),
    'overdue_days', private.property_overdue_days(target_property_id),
    'today', today,
    'signer', (select p.display_name from public.profiles p where p.id = auth.uid()),
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('name', c.full_name, 'type', c.user_type, 'email', c.email_normalized, 'phone', c.phone, 'primary', c.invitation_primary) order by c.invitation_primary desc, c.source_row)
      from public.census_records c where c.property_id = target_property_id and c.unit_id = target_unit_id), '[]'::jsonb),
    'receivables', coalesce((select jsonb_agg(jsonb_build_object('id', ar.id, 'concept', ar.concept, 'amount', ar.amount, 'outstanding', private.receivable_outstanding(ar.id), 'issued_on', ar.issued_on, 'due_on', ar.due_on, 'status', ar.status, 'source', ar.source,
        'void_reason', ar.void_reason, 'voided_at', ar.voided_at, 'voided_by_name', (select pr.display_name from public.profiles pr where pr.id = ar.voided_by)) order by ar.due_on desc, ar.created_at desc)
      from public.accounts_receivable ar where ar.property_id = target_property_id and ar.unit_id = target_unit_id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'amount', p.amount, 'paid_on', p.paid_on, 'reference', p.reference, 'status', p.status,
        'voided_at', p.voided_at, 'void_reason', p.void_reason, 'recorded_at', p.created_at,
        'concepts', private.legal_payment_concepts(p.property_id, p.id),
        'evidence_id', ev.id, 'evidence_name', ev.original_name,
        'payer_name', (select pr.display_name from public.profiles pr where pr.id = ev.uploaded_by),
        'recorded_by_name', (select pr.display_name from public.profiles pr where pr.id = p.recorded_by),
        'voided_by_name', (select pr.display_name from public.profiles pr where pr.id = p.voided_by),
        'corrected_on', (select c.corrected_on from private.legal_payment_correction(p.property_id, p.id) c),
        'corrects', exists(select 1 from public.finance_payment_evidence v where v.property_id = p.property_id and v.voided_payment_id is not null
          and (select c.corrected_by from private.legal_payment_correction(v.property_id, v.voided_payment_id) c) = p.id)
      ) order by p.paid_on desc, p.created_at desc)
      from public.payments p
      left join lateral (select e.id, e.original_name, e.uploaded_by from public.finance_payment_evidence e
        where e.property_id = p.property_id and (e.payment_id = p.id or e.voided_payment_id = p.id) order by e.created_at desc limit 1) ev on true
      where p.property_id = target_property_id and p.unit_id = target_unit_id), '[]'::jsonb),
    'agreements', coalesce((select jsonb_agg(jsonb_build_object('total', g.total_amount, 'status', g.status, 'notes', g.notes, 'created_at', g.created_at,
        'cancel_reason', g.cancel_reason, 'cancelled_at', g.cancelled_at, 'cancelled_by_name', (select pr.display_name from public.profiles pr where pr.id = g.cancelled_by),
        'schedule', private.agreement_schedule(g.id),
        'installments', coalesce((select jsonb_agg(jsonb_build_object('amount', i.amount, 'due_on', i.due_on) order by i.due_on) from public.payment_agreement_installments i where i.property_id = g.property_id and i.agreement_id = g.id), '[]'::jsonb)) order by g.created_at desc)
      from public.payment_agreements g where g.property_id = target_property_id and g.unit_id = target_unit_id), '[]'::jsonb)
  ) into result;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (target_property_id, auth.uid(), 'property', 'legal.unit_viewed', 'unit', target_unit_id, '{}'::jsonb);
  return result;
end;
$$;

notify pgrst, 'reload schema';
commit;

-- Debe dar true en todo.
select
  has_function_privilege('authenticated', 'public.create_payment_agreement(uuid,uuid,text,jsonb,uuid[])', 'execute') as crear_con_deudas,
  has_function_privilege('authenticated', 'public.payment_agreement_schedule(uuid)', 'execute') as calendario,
  exists(select 1 from pg_trigger where tgname = 'payment_allocations_sync_agreements') as estado_automatico,
  not exists(select 1 from public.payment_agreements g where g.status = 'active' and not exists(select 1 from public.payment_agreement_debts d where d.agreement_id = g.id)) as vigentes_con_deudas,
  pg_get_functiondef('public.legal_unit_detail(uuid,uuid)'::regprocedure) like '%agreement_schedule%' as abogada_mismo_calculo;
