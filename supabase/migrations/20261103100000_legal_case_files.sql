-- Módulo jurídico, entrega 2 (03/11/2026): expediente prejurídico por apartamento y etiqueta para el admin.
-- * Un expediente abierto por apartamento (el cerrado queda en el historial). Estados: open (abierto),
--   contacted (contactado), commitment (compromiso de pago), broken (compromiso incumplido), legal
--   (remitido a cobro jurídico) y closed (cerrado, con motivo). Próximo seguimiento con fecha.
-- * Gestiones: llamada, correo, WhatsApp, visita, nota; además se anotan solas el requerimiento de pago
--   enviado (y abre el expediente si no había) y cada respuesta del residente.
-- * Compromisos de pago: valor y fecha; la abogada los marca cumplidos o incumplidos.
-- * El admin del conjunto solo ve que el apartamento está «En cobro jurídico» (expediente abierto);
--   residentes y portería no ven nada. Todo queda en auditoría.
begin;

create table public.legal_cases (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid not null,
  status text not null default 'open' check (status in ('open', 'contacted', 'commitment', 'broken', 'legal', 'closed')),
  next_follow_up date,
  closed_reason text check (closed_reason is null or char_length(trim(closed_reason)) between 3 and 500),
  opened_by uuid not null references public.profiles(id) on delete restrict,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  foreign key (property_id, unit_id) references public.units(property_id, id) on delete restrict,
  check ((status = 'closed') = (closed_at is not null and closed_reason is not null))
);
create unique index legal_cases_one_open_idx on public.legal_cases(property_id, unit_id) where status <> 'closed';
alter table public.legal_cases enable row level security;
revoke all on public.legal_cases from public, anon, authenticated;

create table public.legal_case_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.legal_cases(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  kind text not null check (kind in ('call', 'email', 'whatsapp', 'visit', 'note', 'notice', 'reply', 'status')),
  occurred_on date not null,
  summary text not null check (char_length(trim(summary)) between 2 and 2000),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index legal_case_actions_case_idx on public.legal_case_actions(case_id, occurred_on desc, created_at desc);
alter table public.legal_case_actions enable row level security;
revoke all on public.legal_case_actions from public, anon, authenticated;

create table public.legal_case_commitments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.legal_cases(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  due_on date not null,
  note text check (note is null or char_length(trim(note)) between 2 and 500),
  status text not null default 'pending' check (status in ('pending', 'met', 'broken')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index legal_case_commitments_case_idx on public.legal_case_commitments(case_id, due_on);
alter table public.legal_case_commitments enable row level security;
revoke all on public.legal_case_commitments from public, anon, authenticated;

-- Fecha de hoy en la zona del conjunto.
create or replace function private.property_today(target_property_id uuid)
returns date language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select p.timezone from public.properties p where p.id = target_property_id), 'America/Bogota'))::date;
$$;
revoke all on function private.property_today(uuid) from public, anon, authenticated;

-- Expediente abierto del apartamento; si no hay, lo abre (sin revisar permisos: lo llaman funciones que ya los revisaron).
create or replace function private.legal_ensure_case(target_property_id uuid, target_unit_id uuid, actor uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare found_id uuid;
begin
  select c.id into found_id from public.legal_cases c where c.property_id = target_property_id and c.unit_id = target_unit_id and c.status <> 'closed';
  if found_id is null then
    insert into public.legal_cases(property_id, unit_id, opened_by) values (target_property_id, target_unit_id, actor) returning id into found_id;
    insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
    values (target_property_id, actor, 'property', 'legal.case_opened', 'unit', target_unit_id, jsonb_build_object('case_id', found_id));
  end if;
  return found_id;
end;
$$;
revoke all on function private.legal_ensure_case(uuid, uuid, uuid) from public, anon, authenticated;

-- El requerimiento de pago enviado se anota solo en el expediente (y lo abre si no había).
create or replace function private.legal_notice_to_case()
returns trigger language plpgsql security definer set search_path = '' as $$
declare case_id uuid;
begin
  case_id := private.legal_ensure_case(new.property_id, new.unit_id, new.sent_by);
  insert into public.legal_case_actions(case_id, property_id, kind, occurred_on, summary, created_by)
  values (case_id, new.property_id, 'notice', private.property_today(new.property_id),
    'Requerimiento de pago enviado a ' || new.recipient_email || ' por ' || '$ ' || replace(to_char(new.total, 'FM999,999,999,990'), ',', '.') || ': ' || new.subject, new.sent_by);
  return new;
end;
$$;
revoke all on function private.legal_notice_to_case() from public, anon, authenticated;
create trigger legal_collection_notices_to_case after insert on public.legal_collection_notices
for each row execute function private.legal_notice_to_case();

-- Cada respuesta del residente por correo se anota sola en el expediente abierto.
create or replace function private.legal_reply_to_case()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n public.legal_collection_notices%rowtype; case_id uuid;
begin
  if new.author <> 'resident' then return new; end if;
  select * into n from public.legal_collection_notices where id = new.notice_id;
  select c.id into case_id from public.legal_cases c where c.property_id = n.property_id and c.unit_id = n.unit_id and c.status <> 'closed';
  if case_id is not null then
    insert into public.legal_case_actions(case_id, property_id, kind, occurred_on, summary)
    values (case_id, n.property_id, 'reply', private.property_today(n.property_id), 'Respuesta del residente: ' || left(new.body, 300));
  end if;
  return new;
end;
$$;
revoke all on function private.legal_reply_to_case() from public, anon, authenticated;
create trigger legal_notice_messages_to_case after insert on public.legal_notice_messages
for each row execute function private.legal_reply_to_case();

-- Abogada: expediente del apartamento (el abierto, o el último cerrado) con gestiones y compromisos.
create or replace function public.legal_unit_case(target_property_id uuid, target_unit_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c public.legal_cases%rowtype;
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  select * into c from public.legal_cases x where x.property_id = target_property_id and x.unit_id = target_unit_id
  order by (x.status <> 'closed') desc, x.opened_at desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', c.id, 'status', c.status, 'next_follow_up', c.next_follow_up, 'closed_reason', c.closed_reason, 'opened_at', c.opened_at, 'closed_at', c.closed_at,
    'today', private.property_today(target_property_id),
    'actions', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.kind, 'occurred_on', a.occurred_on, 'summary', a.summary, 'created_at', a.created_at) order by a.occurred_on desc, a.created_at desc)
      from public.legal_case_actions a where a.case_id = c.id), '[]'::jsonb),
    'commitments', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'amount', m.amount, 'due_on', m.due_on, 'note', m.note, 'status', m.status) order by m.due_on)
      from public.legal_case_commitments m where m.case_id = c.id), '[]'::jsonb));
end;
$$;

-- Abogada: expedientes abiertos del conjunto (estado y próximo seguimiento), para la lista En mora.
create or replace function public.legal_property_cases(target_property_id uuid)
returns table(unit_id uuid, status text, next_follow_up date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  return query select c.unit_id, c.status, c.next_follow_up from public.legal_cases c where c.property_id = target_property_id and c.status <> 'closed';
end;
$$;

-- Abogada: abre el expediente del apartamento (si ya hay uno abierto, devuelve ese).
create or replace function public.legal_open_case(target_property_id uuid, target_unit_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.legal_staff_id() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.units where property_id = target_property_id and id = target_unit_id) then raise exception 'unit_not_found'; end if;
  return private.legal_ensure_case(target_property_id, target_unit_id, auth.uid());
end;
$$;

-- Abogada: cambia el estado y el próximo seguimiento. Cerrar pide motivo. El cambio queda como gestión.
create or replace function public.legal_update_case(target_case_id uuid, target_status text, target_next_follow_up date, target_closed_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.legal_cases%rowtype; reason text := nullif(trim(coalesce(target_closed_reason, '')), '');
  labels constant jsonb := '{"open":"Abierto","contacted":"Contactado","commitment":"Compromiso de pago","broken":"Compromiso incumplido","legal":"Remitido a cobro jurídico","closed":"Cerrado"}';
begin
  select * into c from public.legal_cases where id = target_case_id for update;
  if auth.uid() is null or not found or private.legal_staff_id() is null or not private.legal_can_view(c.property_id) then raise exception 'not_authorized'; end if;
  if c.status = 'closed' then raise exception 'case_closed'; end if;
  if target_status is null or not labels ? target_status then raise exception 'invalid_status'; end if;
  if target_status = 'closed' and (reason is null or char_length(reason) not between 3 and 500) then raise exception 'closed_reason_required'; end if;
  update public.legal_cases set status = target_status, next_follow_up = case when target_status = 'closed' then null else target_next_follow_up end,
    closed_reason = case when target_status = 'closed' then reason end, closed_at = case when target_status = 'closed' then now() end, updated_at = now()
  where id = c.id;
  if target_status <> c.status or target_next_follow_up is distinct from c.next_follow_up then
    insert into public.legal_case_actions(case_id, property_id, kind, occurred_on, summary, created_by)
    values (c.id, c.property_id, 'status', private.property_today(c.property_id),
      case when target_status <> c.status then 'Estado: ' || (labels ->> c.status) || ' → ' || (labels ->> target_status) || coalesce(' · Motivo: ' || case when target_status = 'closed' then reason end, '') else 'Seguimiento actualizado' end
      || case when target_status <> 'closed' and target_next_follow_up is not null then ' · Próximo seguimiento: ' || to_char(target_next_follow_up, 'DD/MM/YYYY') else '' end, auth.uid());
  end if;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (c.property_id, auth.uid(), 'property', 'legal.case_updated', 'unit', c.unit_id, jsonb_build_object('case_id', c.id, 'status', target_status, 'previous_status', c.status));
end;
$$;

-- Abogada: registra una gestión (llamada, correo, WhatsApp, visita o nota).
create or replace function public.legal_add_case_action(target_case_id uuid, target_kind text, target_occurred_on date, target_summary text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.legal_cases%rowtype; created uuid; clean text := trim(coalesce(target_summary, ''));
begin
  select * into c from public.legal_cases where id = target_case_id;
  if auth.uid() is null or not found or private.legal_staff_id() is null or not private.legal_can_view(c.property_id) then raise exception 'not_authorized'; end if;
  if c.status = 'closed' then raise exception 'case_closed'; end if;
  if target_kind not in ('call', 'email', 'whatsapp', 'visit', 'note') or char_length(clean) not between 2 and 2000 then raise exception 'invalid_action'; end if;
  if target_occurred_on is null or target_occurred_on > private.property_today(c.property_id) then raise exception 'invalid_date'; end if;
  insert into public.legal_case_actions(case_id, property_id, kind, occurred_on, summary, created_by)
  values (c.id, c.property_id, target_kind, target_occurred_on, clean, auth.uid()) returning id into created;
  update public.legal_cases set updated_at = now() where id = c.id;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (c.property_id, auth.uid(), 'property', 'legal.case_action_added', 'unit', c.unit_id, jsonb_build_object('case_id', c.id, 'kind', target_kind));
  return created;
end;
$$;

-- Abogada: registra un compromiso de pago (pasa el expediente a «Compromiso de pago»).
create or replace function public.legal_add_commitment(target_case_id uuid, target_amount numeric, target_due_on date, target_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.legal_cases%rowtype; created uuid; clean text := nullif(trim(coalesce(target_note, '')), '');
begin
  select * into c from public.legal_cases where id = target_case_id for update;
  if auth.uid() is null or not found or private.legal_staff_id() is null or not private.legal_can_view(c.property_id) then raise exception 'not_authorized'; end if;
  if c.status = 'closed' then raise exception 'case_closed'; end if;
  if target_amount is null or target_amount <= 0 or target_amount > 1000000000000 or target_due_on is null then raise exception 'invalid_commitment'; end if;
  insert into public.legal_case_commitments(case_id, property_id, amount, due_on, note, created_by)
  values (c.id, c.property_id, round(target_amount, 2), target_due_on, clean, auth.uid()) returning id into created;
  insert into public.legal_case_actions(case_id, property_id, kind, occurred_on, summary, created_by)
  values (c.id, c.property_id, 'status', private.property_today(c.property_id),
    'Compromiso de pago por ' || '$ ' || replace(to_char(target_amount, 'FM999,999,999,990'), ',', '.') || ' para el ' || to_char(target_due_on, 'DD/MM/YYYY') || coalesce(' · ' || clean, ''), auth.uid());
  update public.legal_cases set status = 'commitment', next_follow_up = coalesce(next_follow_up, target_due_on), updated_at = now() where id = c.id;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (c.property_id, auth.uid(), 'property', 'legal.commitment_added', 'unit', c.unit_id, jsonb_build_object('case_id', c.id, 'amount', target_amount, 'due_on', target_due_on));
  return created;
end;
$$;

-- Abogada: marca un compromiso cumplido o incumplido (incumplido pasa el expediente a «Compromiso incumplido»).
create or replace function public.legal_set_commitment_status(target_commitment_id uuid, target_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.legal_case_commitments%rowtype; c public.legal_cases%rowtype;
begin
  select * into m from public.legal_case_commitments where id = target_commitment_id for update;
  if found then select * into c from public.legal_cases where id = m.case_id for update; end if;
  if auth.uid() is null or m.id is null or private.legal_staff_id() is null or not private.legal_can_view(c.property_id) then raise exception 'not_authorized'; end if;
  if c.status = 'closed' then raise exception 'case_closed'; end if;
  if target_status not in ('met', 'broken') or m.status <> 'pending' then raise exception 'invalid_status'; end if;
  update public.legal_case_commitments set status = target_status, resolved_at = now() where id = m.id;
  insert into public.legal_case_actions(case_id, property_id, kind, occurred_on, summary, created_by)
  values (c.id, c.property_id, 'status', private.property_today(c.property_id),
    'Compromiso de ' || '$ ' || replace(to_char(m.amount, 'FM999,999,999,990'), ',', '.') || ' del ' || to_char(m.due_on, 'DD/MM/YYYY') || case when target_status = 'met' then ' cumplido' else ' incumplido' end, auth.uid());
  if target_status = 'broken' then update public.legal_cases set status = 'broken', updated_at = now() where id = c.id; end if;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (c.property_id, auth.uid(), 'property', 'legal.commitment_resolved', 'unit', c.unit_id, jsonb_build_object('case_id', c.id, 'commitment_id', m.id, 'status', target_status));
end;
$$;

-- Admin del conjunto: apartamentos «En cobro jurídico» (con expediente abierto). Solo eso; no ve el expediente.
create or replace function public.property_legal_units(target_property_id uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(c.unit_id), '{}') from public.legal_cases c
  where c.property_id = target_property_id and c.status <> 'closed' and private.is_active_member(target_property_id, 'administrator');
$$;

revoke all on function public.legal_unit_case(uuid, uuid), public.legal_property_cases(uuid), public.legal_open_case(uuid, uuid),
  public.legal_update_case(uuid, text, date, text), public.legal_add_case_action(uuid, text, date, text), public.legal_add_commitment(uuid, numeric, date, text),
  public.legal_set_commitment_status(uuid, text), public.property_legal_units(uuid) from public, anon;
grant execute on function public.legal_unit_case(uuid, uuid), public.legal_property_cases(uuid), public.legal_open_case(uuid, uuid),
  public.legal_update_case(uuid, text, date, text), public.legal_add_case_action(uuid, text, date, text), public.legal_add_commitment(uuid, numeric, date, text),
  public.legal_set_commitment_status(uuid, text), public.property_legal_units(uuid) to authenticated;
notify pgrst, 'reload schema';

commit;

-- Debe dar 3 veces true.
select
  exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'legal_cases') as expedientes_creados,
  not has_table_privilege('authenticated', 'public.legal_cases', 'select')
    and not has_table_privilege('authenticated', 'public.legal_case_actions', 'select') as expedientes_protegidos,
  exists(select 1 from pg_trigger where tgname = 'legal_collection_notices_to_case') as requerimiento_se_anota;
