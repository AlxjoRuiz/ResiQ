-- Saldos a favor (13/11/2026, pedido de Alejandro). Hasta hoy ResiQ no tenía dónde guardar un saldo a favor: los
-- pagos no pueden quedar con sobrante (regla del 10/11, se mantiene) y el Excel de cartera rechazaba los valores
-- negativos (21 apartamentos de Bonavento).
-- * Un saldo a favor entra por el Excel de cartera (fila con valor negativo) o a mano («Registrar saldo a favor» en
--   la cuenta del apartamento).
-- * La administración decide cuándo usarlo: «Aplicar» lo descuenta de una obligación con saldo del mismo apartamento.
--   Al aplicarlo se registra un abono a esa obligación con la referencia «Saldo a favor» (así todos los saldos,
--   la mora, los acuerdos y el informe jurídico siguen cuadrando sin cambios). Ese abono no envía el correo de
--   «Pago registrado». Si se anula el abono, el saldo a favor vuelve a quedar disponible.
-- * Un saldo a favor se puede anular solo si todavía no se ha usado.
-- * El residente ve sus saldos a favor en su cuenta (mismo permiso que la cartera del apartamento).
begin;

create table if not exists public.unit_credits (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  concept text not null check (char_length(trim(concept)) between 2 and 180),
  issued_on date not null,
  source text not null check (source in ('import', 'manual')),
  external_reference text check (external_reference is null or char_length(external_reference) <= 120),
  import_batch_id uuid,
  status text not null default 'active' check (status in ('active', 'void')),
  void_reason text check (void_reason is null or char_length(trim(void_reason)) between 3 and 500),
  voided_by uuid references public.profiles(id) on delete restrict,
  voided_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (property_id, id),
  foreign key (property_id, unit_id) references public.units(property_id, id) on delete restrict
);
create index if not exists unit_credits_unit_idx on public.unit_credits(property_id, unit_id, status);
create unique index if not exists unit_credits_import_ref_uidx on public.unit_credits(property_id, external_reference) where source = 'import' and status = 'active';
alter table public.unit_credits enable row level security;
revoke all on public.unit_credits from anon, authenticated;
grant select on public.unit_credits to authenticated;
drop policy if exists unit_credits_read_finance on public.unit_credits;
create policy unit_credits_read_finance on public.unit_credits for select to authenticated using (private.can_access_unit_finance(property_id, unit_id));

-- El abono que sale de un saldo a favor queda marcado con su saldo a favor.
alter table public.payments add column if not exists credit_id uuid references public.unit_credits(id) on delete restrict;
create index if not exists payments_credit_idx on public.payments(credit_id) where credit_id is not null;

-- Lo que le queda a un saldo a favor: su valor menos los abonos vigentes que salieron de él.
create or replace function private.credit_remaining(target_credit_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select case when c.status = 'active' then greatest(c.amount - coalesce((select sum(p.amount) from public.payments p where p.credit_id = c.id and p.status = 'posted'), 0), 0) else 0 end
  from public.unit_credits c where c.id = target_credit_id;
$$;
revoke all on function private.credit_remaining(uuid) from public, anon, authenticated;

-- Saldos a favor del apartamento con lo que le queda a cada uno (para la cuenta del apartamento).
create or replace function public.list_unit_credits(target_property_id uuid, target_unit_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_access_unit_finance(target_property_id, target_unit_id) then raise exception 'not_authorized'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'concept', c.concept, 'amount', c.amount, 'remaining', private.credit_remaining(c.id),
      'issued_on', c.issued_on, 'source', c.source, 'status', c.status, 'void_reason', c.void_reason) order by c.issued_on, c.created_at)
    from public.unit_credits c where c.property_id = target_property_id and c.unit_id = target_unit_id), '[]'::jsonb);
end;
$$;
revoke all on function public.list_unit_credits(uuid, uuid) from public, anon;
grant execute on function public.list_unit_credits(uuid, uuid) to authenticated;

-- «Registrar saldo a favor» (administración).
create or replace function public.create_unit_credit(target_property_id uuid, target_unit_id uuid, target_amount numeric, target_concept text, target_issued_on date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_id uuid; clean_concept text := trim(target_concept);
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if target_amount is null or target_amount <= 0 or target_issued_on is null or char_length(coalesce(clean_concept, '')) not between 2 and 180 then raise exception 'invalid_input'; end if;
  if not exists (select 1 from public.units where id = target_unit_id and property_id = target_property_id and status = 'active') then raise exception 'unit_not_found'; end if;
  insert into public.unit_credits(property_id, unit_id, amount, concept, issued_on, source, created_by)
  values (target_property_id, target_unit_id, target_amount, clean_concept, target_issued_on, 'manual', auth.uid()) returning id into created_id;
  perform private.write_property_audit(target_property_id, 'credit.created', 'unit_credit', created_id, jsonb_build_object('unit_id', target_unit_id, 'amount', target_amount));
  return created_id;
end;
$$;
revoke all on function public.create_unit_credit(uuid, uuid, numeric, text, date) from public, anon;
grant execute on function public.create_unit_credit(uuid, uuid, numeric, text, date) to authenticated;

-- «Aplicar» un saldo a favor a una obligación con saldo del mismo apartamento (administración).
create or replace function public.apply_unit_credit(target_property_id uuid, target_credit_id uuid, target_receivable_id uuid, target_amount numeric, target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare credit public.unit_credits%rowtype; receivable public.accounts_receivable%rowtype; created_id uuid; zone text;
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if target_amount is null or target_amount <= 0 or target_idempotency_key is null then raise exception 'invalid_input'; end if;
  select * into credit from public.unit_credits where id = target_credit_id and property_id = target_property_id for update;
  if not found or credit.status <> 'active' then raise exception 'credit_not_found'; end if;
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
  insert into public.activity_events(property_id, payment_id, actor_id, event_type, new_state, description) values (target_property_id, created_id, auth.uid(), 'payment_recorded', 'posted', 'Saldo a favor aplicado');
  perform private.write_property_audit(target_property_id, 'credit.applied', 'unit_credit', credit.id, jsonb_build_object('unit_id', credit.unit_id, 'receivable_id', receivable.id, 'payment_id', created_id, 'amount', target_amount));
  return created_id;
exception when unique_violation then raise exception 'duplicate_payment';
end;
$$;
revoke all on function public.apply_unit_credit(uuid, uuid, uuid, numeric, uuid) from public, anon;
grant execute on function public.apply_unit_credit(uuid, uuid, uuid, numeric, uuid) to authenticated;

-- Anular un saldo a favor que todavía no se ha usado (administración).
create or replace function public.void_unit_credit(target_property_id uuid, target_credit_id uuid, target_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare credit public.unit_credits%rowtype;
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if char_length(trim(coalesce(target_reason, ''))) not between 3 and 500 then raise exception 'invalid_input'; end if;
  select * into credit from public.unit_credits where id = target_credit_id and property_id = target_property_id for update;
  if not found or credit.status <> 'active' then raise exception 'credit_not_found'; end if;
  if exists (select 1 from public.payments p where p.credit_id = credit.id and p.status = 'posted') then raise exception 'credit_already_applied'; end if;
  update public.unit_credits set status = 'void', void_reason = trim(target_reason), voided_by = auth.uid(), voided_at = now() where id = credit.id;
  perform private.write_property_audit(target_property_id, 'credit.voided', 'unit_credit', credit.id, jsonb_build_object('unit_id', credit.unit_id, 'reason', trim(target_reason)));
end;
$$;
revoke all on function public.void_unit_credit(uuid, uuid, text) from public, anon;
grant execute on function public.void_unit_credit(uuid, uuid, text) to authenticated;

-- Importar cartera: igual que 20261027170000, y además las filas con «kind» = 'credit' (valor negativo en el Excel)
-- se guardan como saldo a favor. Las repetidas (misma referencia) se saltan, como las obligaciones.
create or replace function public.import_receivables(target_property_id uuid,target_batch_id uuid,target_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare item jsonb; created_id uuid; imported integer:=0; unit_id_value uuid; amount_value numeric; issued_value date; due_value date; source_value text; reference_value text; concept_value text; touched_units uuid[]:='{}';
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if target_batch_id is null or target_rows is null or jsonb_typeof(target_rows)<>'array' or jsonb_array_length(target_rows)<1 then raise exception 'invalid_import'; end if;
  for item in select value from jsonb_array_elements(target_rows) loop
    unit_id_value:=(item->>'unit_id')::uuid; amount_value:=(item->>'amount')::numeric; issued_value:=(item->>'issued_on')::date;
    reference_value:=nullif(trim(item->>'external_reference'),''); concept_value:=trim(item->>'concept');
    if not exists(select 1 from public.units where id=unit_id_value and property_id=target_property_id and status='active') then raise exception 'unit_not_found'; end if;
    if item->>'kind' = 'credit' then
      if reference_value is null or char_length(reference_value)>120 or char_length(concept_value) not between 2 and 180 or amount_value<=0 or issued_value is null then raise exception 'invalid_import_row'; end if;
      continue when exists(select 1 from public.unit_credits c where c.property_id=target_property_id and c.source='import' and c.status='active' and c.external_reference=reference_value);
      insert into public.unit_credits(property_id,unit_id,amount,concept,issued_on,source,external_reference,import_batch_id,created_by)
      values(target_property_id,unit_id_value,amount_value,concept_value,issued_value,'import',reference_value,target_batch_id,auth.uid());
      imported:=imported+1;
      continue;
    end if;
    due_value:=(item->>'due_on')::date; source_value:=coalesce(nullif(item->>'source',''),'import');
    if source_value not in ('import','opening_balance') or reference_value is null or char_length(reference_value)>120 or char_length(concept_value) not between 2 and 180 or amount_value<=0 or due_value<issued_value then raise exception 'invalid_import_row'; end if;
    -- Ya cargada (en otra importación o repetida en este archivo): se salta.
    continue when exists(select 1 from public.accounts_receivable ar where ar.property_id=target_property_id and ar.source=source_value and ar.external_reference=reference_value);
    perform private.lock_unit_finance(target_property_id,unit_id_value);
    insert into public.accounts_receivable(property_id,unit_id,concept,amount,currency,issued_on,due_on,source,external_reference,import_batch_id,recorded_by)
    values(target_property_id,unit_id_value,concept_value,amount_value,'COP',issued_value,due_value,source_value,reference_value,target_batch_id,auth.uid()) returning id into created_id;
    insert into public.activity_events(property_id,receivable_id,actor_id,event_type,new_state,description) values(target_property_id,created_id,auth.uid(),'receivable_created','active','Obligación importada');
    imported:=imported+1;
    if not unit_id_value = any(touched_units) then touched_units:=array_append(touched_units,unit_id_value); end if;
  end loop;
  -- Solo se avisa a los apartamentos que recibieron obligaciones nuevas.
  foreach unit_id_value in array touched_units loop
    perform private.enqueue_finance_notification(target_property_id,unit_id_value,'receivable',target_batch_id,'receivable_created','Cartera actualizada','La administración importó nuevas obligaciones en tu cuenta.','receivable-batch:'||target_batch_id||':'||unit_id_value,jsonb_build_object('batch_id',target_batch_id));
  end loop;
  if imported>0 then
    perform private.write_property_audit(target_property_id,'receivable.batch_imported','accounts_receivable',target_batch_id,jsonb_build_object('rows',imported,'batch_id',target_batch_id));
  end if;
  return imported;
end;
$$;

commit;

notify pgrst, 'reload schema';

-- Debe dar true en las dos columnas.
select exists(select 1 from pg_tables where schemaname = 'public' and tablename = 'unit_credits') as tabla_saldos_a_favor,
  pg_get_functiondef('public.import_receivables(uuid,uuid,jsonb)'::regprocedure) like '%unit_credits%' as importa_saldos_a_favor;
