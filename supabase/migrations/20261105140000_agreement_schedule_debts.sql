-- Deudas fuera del acuerdo (05/11/2026, pedido de Alejandro): el calendario del acuerdo trae además qué deudas
-- cubre (debt_ids), para que el admin, el residente y la abogada vean «No está en el acuerdo de pago» en una deuda
-- nueva que no se sumó al acuerdo. El cálculo de las cuotas queda igual.
begin;

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
  if n = 0 then return jsonb_build_object('agreement_id', g.id, 'status', g.status, 'total', g.total_amount, 'remaining', remaining, 'paid', paid, 'installments', '[]'::jsonb, 'debt_ids', coalesce((select jsonb_agg(d.receivable_id) from public.payment_agreement_debts d where d.agreement_id = g.id), '[]'::jsonb)); end if;
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
  return jsonb_build_object('agreement_id', g.id, 'status', g.status, 'total', g.total_amount, 'remaining', remaining, 'paid', paid, 'installments', result, 'debt_ids', coalesce((select jsonb_agg(d.receivable_id) from public.payment_agreement_debts d where d.agreement_id = g.id), '[]'::jsonb));
end;
$$;
revoke all on function private.agreement_schedule(uuid) from public, anon, authenticated;

commit;

-- Debe dar true.
select pg_get_functiondef('private.agreement_schedule(uuid)'::regprocedure) like '%debt_ids%' as deudas_del_acuerdo;
