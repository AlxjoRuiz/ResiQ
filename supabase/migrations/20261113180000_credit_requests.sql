-- Solicitudes de saldo a favor (13/11/2026, pedido de Alejandro). Cuando el residente quiere usar su saldo a favor
-- ya no se aplica de una vez: le llega a la administración como un comprobante de pago.
-- * El residente elige la deuda y el valor («Usar saldo a favor»). Queda «Por revisar» y la administración recibe el
--   mismo aviso que con un comprobante (tipo payment_evidence_submitted), con el apartamento y la deuda.
-- * La administración la ve en «Comprobantes de pago» del apartamento, con a qué deuda se abona, y la registra
--   («Aceptar y registrar») o la rechaza con un motivo. Al registrarla baja la deuda y baja el saldo a favor (el
--   mismo abono «Saldo a favor · …» de 20261113140000).
-- * Mientras una solicitud esté por revisar, ese valor queda apartado: el saldo disponible y la deuda no se pueden
--   pedir dos veces.
-- * La administración sigue pudiendo aplicar el saldo a favor directo («Aplicar»); el residente ya no.
-- * El punto rojo de Cartera de la administración también marca los apartamentos con solicitudes por revisar.
begin;

create table if not exists public.unit_credit_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid not null,
  credit_id uuid not null references public.unit_credits(id) on delete restrict,
  receivable_id uuid not null references public.accounts_receivable(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'registered', 'rejected')),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  payment_id uuid references public.payments(id) on delete restrict,
  decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz,
  reject_reason text check (reject_reason is null or char_length(trim(reject_reason)) between 3 and 500),
  foreign key (property_id, unit_id) references public.units(property_id, id) on delete restrict
);
create index if not exists unit_credit_requests_unit_idx on public.unit_credit_requests(property_id, unit_id, status);
alter table public.unit_credit_requests enable row level security;
revoke all on public.unit_credit_requests from anon, authenticated;
grant select on public.unit_credit_requests to authenticated;
drop policy if exists unit_credit_requests_read_finance on public.unit_credit_requests;
create policy unit_credit_requests_read_finance on public.unit_credit_requests for select to authenticated using (private.can_access_unit_finance(property_id, unit_id));

-- Lo que está apartado por solicitudes por revisar.
create or replace function private.credit_pending(target_credit_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(r.amount), 0) from public.unit_credit_requests r where r.credit_id = target_credit_id and r.status = 'pending';
$$;
create or replace function private.receivable_credit_pending(target_receivable_id uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(r.amount), 0) from public.unit_credit_requests r where r.receivable_id = target_receivable_id and r.status = 'pending';
$$;
revoke all on function private.credit_pending(uuid), private.receivable_credit_pending(uuid) from public, anon, authenticated;

-- Aplicar un saldo a favor (lógica común): crea el abono «Saldo a favor · …» y lo amarra a la deuda.
create or replace function private.apply_credit_core(target_property_id uuid, credit public.unit_credits, target_receivable_id uuid, target_amount numeric, target_idempotency_key uuid, description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare receivable public.accounts_receivable%rowtype; created_id uuid; zone text;
begin
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
  insert into public.activity_events(property_id, payment_id, actor_id, event_type, new_state, description) values (target_property_id, created_id, auth.uid(), 'payment_recorded', 'posted', description);
  perform private.write_property_audit(target_property_id, 'credit.applied', 'unit_credit', credit.id,
    jsonb_build_object('unit_id', credit.unit_id, 'receivable_id', receivable.id, 'payment_id', created_id, 'amount', target_amount));
  return created_id;
end;
$$;
revoke all on function private.apply_credit_core(uuid, public.unit_credits, uuid, numeric, uuid, text) from public, anon, authenticated;

-- «Aplicar» directo: de nuevo solo la administración. No puede tomar lo apartado por solicitudes por revisar.
create or replace function public.apply_unit_credit(target_property_id uuid, target_credit_id uuid, target_receivable_id uuid, target_amount numeric, target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare credit public.unit_credits%rowtype;
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if target_amount is null or target_amount <= 0 or target_idempotency_key is null then raise exception 'invalid_input'; end if;
  select * into credit from public.unit_credits where id = target_credit_id and property_id = target_property_id for update;
  if not found or credit.status <> 'active' then raise exception 'credit_not_found'; end if;
  if target_amount > private.credit_remaining(credit.id) - private.credit_pending(credit.id) then raise exception 'credit_insufficient'; end if;
  if target_amount > private.receivable_outstanding(target_receivable_id) - private.receivable_credit_pending(target_receivable_id) then raise exception 'receivable_overallocated'; end if;
  return private.apply_credit_core(target_property_id, credit, target_receivable_id, target_amount, target_idempotency_key, 'Saldo a favor aplicado');
exception when unique_violation then raise exception 'duplicate_payment';
end;
$$;
revoke all on function public.apply_unit_credit(uuid, uuid, uuid, numeric, uuid) from public, anon;
grant execute on function public.apply_unit_credit(uuid, uuid, uuid, numeric, uuid) to authenticated;

-- «Usar saldo a favor» (residente con acceso a la cartera del apartamento).
create or replace function public.request_unit_credit(target_property_id uuid, target_credit_id uuid, target_receivable_id uuid, target_amount numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare credit public.unit_credits%rowtype; receivable public.accounts_receivable%rowtype; created_id uuid; unit_label text; recipient record;
begin
  if auth.uid() is null then raise exception 'not_authorized'; end if;
  if target_amount is null or target_amount <= 0 then raise exception 'invalid_input'; end if;
  select * into credit from public.unit_credits where id = target_credit_id and property_id = target_property_id for update;
  if not found or not private.can_access_unit_finance(target_property_id, credit.unit_id) then raise exception 'not_authorized'; end if;
  if credit.status <> 'active' then raise exception 'credit_not_found'; end if;
  perform private.lock_unit_finance(target_property_id, credit.unit_id);
  select * into receivable from public.accounts_receivable where id = target_receivable_id and property_id = target_property_id and unit_id = credit.unit_id;
  if not found or receivable.status <> 'active' then raise exception 'invalid_receivable'; end if;
  if target_amount > private.credit_remaining(credit.id) - private.credit_pending(credit.id) then raise exception 'credit_insufficient'; end if;
  if target_amount > private.receivable_outstanding(receivable.id) - private.receivable_credit_pending(receivable.id) then raise exception 'receivable_overallocated'; end if;
  insert into public.unit_credit_requests(property_id, unit_id, credit_id, receivable_id, amount, requested_by)
  values (target_property_id, credit.unit_id, credit.id, receivable.id, target_amount, auth.uid()) returning id into created_id;
  -- Mismo aviso que un comprobante de pago, para cada administrador del conjunto.
  select b.name || ' · ' || u.code into unit_label from public.units u join public.buildings b on b.id = u.building_id where u.id = credit.unit_id and u.property_id = target_property_id;
  for recipient in select pm.id from public.property_members pm where pm.property_id = target_property_id and pm.status = 'active' and 'administrator' = any(pm.roles) loop
    insert into public.notifications(property_id, recipient_member_id, type, subject, body, target_type, target_id, payload, dedupe_key)
    values (target_property_id, recipient.id, 'payment_evidence_submitted', 'Saldo a favor · ' || coalesce(unit_label, 'Apartamento'),
      'El residente quiere usar ' || to_char(target_amount, 'FM999G999G999G990') || ' de su saldo a favor («' || credit.concept || '») para pagar «' || receivable.concept || '».',
      'receivable', receivable.id, jsonb_build_object('unit_id', credit.unit_id, 'credit_request_id', created_id),
      'credit-request:' || created_id || ':' || recipient.id)
    on conflict (property_id, recipient_member_id, dedupe_key) do nothing;
  end loop;
  perform private.write_property_audit(target_property_id, 'credit.requested', 'unit_credit', credit.id, jsonb_build_object('unit_id', credit.unit_id, 'receivable_id', receivable.id, 'amount', target_amount, 'request_id', created_id));
  return created_id;
end;
$$;
revoke all on function public.request_unit_credit(uuid, uuid, uuid, numeric) from public, anon;
grant execute on function public.request_unit_credit(uuid, uuid, uuid, numeric) to authenticated;

-- «Aceptar y registrar» (administración): aplica el saldo a favor como en la solicitud.
create or replace function public.register_credit_request(target_property_id uuid, target_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare request public.unit_credit_requests%rowtype; credit public.unit_credits%rowtype; created_id uuid;
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  select * into request from public.unit_credit_requests where id = target_request_id and property_id = target_property_id for update;
  if not found or request.status <> 'pending' then raise exception 'request_not_pending'; end if;
  select * into credit from public.unit_credits where id = request.credit_id for update;
  if credit.status <> 'active' then raise exception 'credit_not_found'; end if;
  created_id := private.apply_credit_core(target_property_id, credit, request.receivable_id, request.amount, gen_random_uuid(), 'Saldo a favor aplicado (solicitud del residente)');
  update public.unit_credit_requests set status = 'registered', payment_id = created_id, decided_by = auth.uid(), decided_at = now() where id = request.id;
  return created_id;
end;
$$;
revoke all on function public.register_credit_request(uuid, uuid) from public, anon;
grant execute on function public.register_credit_request(uuid, uuid) to authenticated;

-- «Rechazar» (administración), con motivo; el valor apartado vuelve a quedar disponible.
create or replace function public.reject_credit_request(target_property_id uuid, target_request_id uuid, target_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare request public.unit_credit_requests%rowtype;
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if char_length(trim(coalesce(target_reason, ''))) not between 3 and 500 then raise exception 'invalid_input'; end if;
  select * into request from public.unit_credit_requests where id = target_request_id and property_id = target_property_id for update;
  if not found or request.status <> 'pending' then raise exception 'request_not_pending'; end if;
  update public.unit_credit_requests set status = 'rejected', reject_reason = trim(target_reason), decided_by = auth.uid(), decided_at = now() where id = request.id;
  perform private.write_property_audit(target_property_id, 'credit.request_rejected', 'unit_credit', request.credit_id, jsonb_build_object('request_id', request.id, 'reason', trim(target_reason)));
end;
$$;
revoke all on function public.reject_credit_request(uuid, uuid, text) from public, anon;
grant execute on function public.reject_credit_request(uuid, uuid, text) to authenticated;

-- Saldos a favor del apartamento: además de lo disponible, lo apartado por solicitudes por revisar.
create or replace function public.list_unit_credits(target_property_id uuid, target_unit_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_access_unit_finance(target_property_id, target_unit_id) then raise exception 'not_authorized'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'concept', c.concept, 'amount', c.amount, 'remaining', private.credit_remaining(c.id),
      'pending', private.credit_pending(c.id), 'issued_on', c.issued_on, 'source', c.source, 'status', c.status, 'void_reason', c.void_reason) order by c.issued_on, c.created_at)
    from public.unit_credits c where c.property_id = target_property_id and c.unit_id = target_unit_id), '[]'::jsonb);
end;
$$;

-- Punto rojo de Cartera (administración): también los apartamentos con solicitudes de saldo a favor por revisar.
create or replace function public.list_units_with_pending_evidence(target_property_id uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct unit_id), '{}') from (
    select e.unit_id from public.finance_payment_evidence e
    where e.property_id = target_property_id and private.is_active_member(target_property_id, 'administrator')
      and private.evidence_is_pending(e.id)
    union all
    select r.unit_id from public.unit_credit_requests r
    where r.property_id = target_property_id and r.status = 'pending' and private.is_active_member(target_property_id, 'administrator')
    union all
    select u.id from public.units u
    where u.property_id = target_property_id and not private.is_active_member(target_property_id, 'administrator')
      and private.can_access_unit_finance(target_property_id, u.id) and private.unit_needs_repayment(target_property_id, u.id)
  ) pending;
$$;

commit;

notify pgrst, 'reload schema';

-- Debe dar true en las dos columnas.
select exists(select 1 from pg_tables where schemaname = 'public' and tablename = 'unit_credit_requests') as solicitudes_saldo_a_favor,
  pg_get_functiondef('public.list_units_with_pending_evidence(uuid)'::regprocedure) like '%unit_credit_requests%' as punto_rojo_saldo_a_favor;
