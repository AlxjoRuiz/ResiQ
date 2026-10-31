-- Módulo jurídico, entrega 1: acceso y bandeja de la abogada (31/10/2026, decisiones de Alejandro).
-- * Una sola abogada de cobros, a nivel plataforma (no pertenece a ningún conjunto). El superadmin la
--   invita con un enlace a su correo, igual que al admin de mantenimiento.
-- * El superadmin le asigna conjuntos uno por uno, cada uno con su umbral de mora (60 días por defecto).
--   Solo ve los conjuntos asignados; los demás no existen para ella.
-- * No se copia la cartera: la abogada la consulta en vivo (la que sube y registra el admin del conjunto:
--   cobros importados, multas u obligaciones manuales, pagos, anulaciones y acuerdos). Solo lectura.
-- * Intereses de mora: fuera por ahora. La abogada no ve nada de PQRS, visitas, paquetes ni asambleas.
-- Antes de usarlo con datos reales, cada conjunto debe autorizar el tratamiento de datos (Ley 1581).
begin;

create table public.legal_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger legal_staff_set_updated_at before update on public.legal_staff for each row execute function private.set_updated_at();
alter table public.legal_staff enable row level security;
-- Cada cuenta lee solo su propia fila (para saber si es del equipo jurídico); el resto pasa por funciones.
create policy legal_staff_read_own on public.legal_staff for select to authenticated using (user_id = auth.uid());
grant select on public.legal_staff to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.legal_staff from authenticated;
revoke all on public.legal_staff from anon;

create table public.legal_invitations (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null check (email_normalized = lower(trim(email_normalized))),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  expires_at timestamptz not null,
  link_issued_at timestamptz,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  accepted_by uuid references public.profiles(id) on delete restrict,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'accepted') = (accepted_by is not null and accepted_at is not null))
);
alter table public.legal_invitations enable row level security;
revoke all on public.legal_invitations from public, anon, authenticated;

-- Conjuntos asignados a jurídica (uno por conjunto: hay una sola abogada) con su umbral de mora.
create table public.legal_assignments (
  property_id uuid primary key references public.properties(id) on delete restrict,
  overdue_days integer not null default 60 check (overdue_days between 1 and 3650),
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger legal_assignments_set_updated_at before update on public.legal_assignments for each row execute function private.set_updated_at();
alter table public.legal_assignments enable row level security;
revoke all on public.legal_assignments from public, anon, authenticated;

-- Última visita de la abogada a cada conjunto (para marcar las novedades nuevas).
create table public.legal_property_views (
  staff_id uuid not null references public.legal_staff(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  seen_at timestamptz not null default now(),
  primary key (staff_id, property_id)
);
alter table public.legal_property_views enable row level security;
revoke all on public.legal_property_views from public, anon, authenticated;

-- ¿La sesión es de la abogada activa? ¿Y tiene asignado este conjunto (activo)?
create or replace function private.legal_staff_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select s.id from public.legal_staff s where s.user_id = auth.uid() and s.status = 'active';
$$;
create or replace function private.legal_can_view(target_property_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.legal_staff_id() is not null and exists(
    select 1 from public.legal_assignments a join public.properties p on p.id = a.property_id
    where a.property_id = target_property_id and p.status = 'active');
$$;
revoke all on function private.legal_staff_id(), private.legal_can_view(uuid) from public, anon;
grant execute on function private.legal_staff_id(), private.legal_can_view(uuid) to authenticated;

-- Superadmin: invitar a la abogada y obtener el enlace (7 días).
create or replace function public.platform_invite_legal(target_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare normalized_email text := lower(trim(coalesce(target_email, ''))); raw_token text;
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  if char_length(normalized_email) > 254 or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  if exists(select 1 from public.legal_staff s join auth.users u on u.id = s.user_id
            where lower(u.email) = normalized_email and s.status <> 'revoked') then raise exception 'already_member'; end if;
  update public.legal_invitations set status = 'revoked', updated_at = now() where email_normalized = normalized_email and status = 'pending';
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.legal_invitations(email_normalized, token_hash, expires_at, link_issued_at, invited_by)
  values (normalized_email, encode(extensions.digest(raw_token, 'sha256'), 'hex'), now() + interval '7 days', now(), auth.uid());
  return raw_token;
end;
$$;

-- Superadmin: enlace nuevo de 7 días para una invitación pendiente o vencida (el anterior deja de servir).
create or replace function public.platform_reissue_legal_invitation(target_invitation_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text;
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.legal_invitations set token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    expires_at = now() + interval '7 days', link_issued_at = now(), updated_at = now()
  where id = target_invitation_id and status = 'pending';
  if not found then raise exception 'invitation_not_found'; end if;
  return raw_token;
end;
$$;

-- Superadmin: la abogada y sus invitaciones pendientes.
create or replace function public.platform_list_legal()
returns table(staff_id uuid, invitation_id uuid, display_name text, email text, member_status text, since timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query
  select s.id, null::uuid, p.display_name, u.email::text, s.status, s.created_at
  from public.legal_staff s join public.profiles p on p.id = s.user_id join auth.users u on u.id = s.user_id
  where s.status <> 'revoked'
  union all
  select null::uuid, i.id, null::text, i.email_normalized, case when i.expires_at > now() then 'invited' else 'expired' end, i.created_at
  from public.legal_invitations i where i.status = 'pending'
  order by 6 desc;
end;
$$;

-- Aceptar la invitación con la cuenta del correo invitado: queda como abogada de cobros.
create or replace function public.accept_legal_invitation(invitation_token text)
returns text language plpgsql security definer set search_path = '' as $$
declare inv public.legal_invitations%rowtype; actor_email text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  actor_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select * into inv from public.legal_invitations
  where token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex') and status = 'pending' for update;
  if not found or inv.expires_at <= now() then raise exception 'invalid_invitation'; end if;
  if actor_email = '' or actor_email <> inv.email_normalized then raise exception 'email_mismatch'; end if;
  if exists(select 1 from public.legal_staff where user_id = auth.uid() and status = 'active') then raise exception 'membership_exists'; end if;
  insert into public.legal_staff(user_id, status, created_by) values (auth.uid(), 'active', inv.invited_by)
  on conflict (user_id) do update set status = 'active', updated_at = now();
  update public.legal_invitations set status = 'accepted', accepted_by = auth.uid(), accepted_at = now(), updated_at = now() where id = inv.id;
  return 'legal';
end;
$$;

-- Superadmin: conjuntos con su asignación a jurídica y su umbral.
create or replace function public.platform_list_legal_assignments()
returns table(property_id uuid, property_name text, property_status text, assigned boolean, overdue_days integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query
  select p.id, p.name, p.status, a.property_id is not null, coalesce(a.overdue_days, 60)
  from public.properties p left join public.legal_assignments a on a.property_id = p.id
  where p.status <> 'archived' order by p.name;
end;
$$;

-- Superadmin: asignar o quitar un conjunto a jurídica, con su umbral de mora. Queda en auditoría.
create or replace function public.platform_set_legal_assignment(target_property_id uuid, target_assigned boolean, target_overdue_days integer)
returns void language plpgsql security definer set search_path = '' as $$
declare previous public.legal_assignments%rowtype;
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.properties where id = target_property_id and status <> 'archived') then raise exception 'property_not_found'; end if;
  if target_assigned and (target_overdue_days is null or target_overdue_days not between 1 and 3650) then raise exception 'invalid_overdue_days'; end if;
  select * into previous from public.legal_assignments where property_id = target_property_id;
  if target_assigned then
    insert into public.legal_assignments(property_id, overdue_days, assigned_by) values (target_property_id, target_overdue_days, auth.uid())
    on conflict (property_id) do update set overdue_days = excluded.overdue_days, assigned_by = excluded.assigned_by, updated_at = now();
  else
    delete from public.legal_assignments where property_id = target_property_id;
  end if;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (target_property_id, auth.uid(), 'property', case when target_assigned then 'legal.assignment_saved' else 'legal.assignment_removed' end, 'property', target_property_id,
    jsonb_build_object('assigned', target_assigned, 'overdue_days', case when target_assigned then target_overdue_days end, 'previous_overdue_days', previous.overdue_days));
end;
$$;

-- Abogada: sus conjuntos asignados con las cifras de cartera y las novedades desde su última visita.
create or replace function public.legal_list_properties()
returns table(property_id uuid, property_name text, city text, overdue_days integer, units_in_arrears integer, arrears_amount numeric, units_current integer, news_count integer, seen_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := private.legal_staff_id();
begin
  if auth.uid() is null or me is null then raise exception 'not_authorized'; end if;
  return query
  with props as (
    select p.id, p.name, p.city, p.timezone, a.overdue_days, v.seen_at
    from public.legal_assignments a join public.properties p on p.id = a.property_id and p.status = 'active'
    left join public.legal_property_views v on v.property_id = p.id and v.staff_id = me
  ), recv as (
    select ar.property_id, ar.unit_id, ar.due_on, private.receivable_outstanding(ar.id) as outstanding
    from public.accounts_receivable ar join props on props.id = ar.property_id where ar.status = 'active'
  ), units as (
    select r.property_id, r.unit_id,
      sum(r.outstanding) filter (where r.due_on < (now() at time zone props.timezone)::date) as overdue,
      min(r.due_on) filter (where r.outstanding > 0 and r.due_on < (now() at time zone props.timezone)::date) as oldest
    from recv r join props on props.id = r.property_id group by r.property_id, r.unit_id
  ), totals as (
    select u.property_id,
      count(*) filter (where u.oldest is not null and (now() at time zone props.timezone)::date - u.oldest >= props.overdue_days)::integer as in_arrears,
      coalesce(sum(u.overdue) filter (where u.oldest is not null and (now() at time zone props.timezone)::date - u.oldest >= props.overdue_days), 0) as amount
    from units u join props on props.id = u.property_id group by u.property_id
  )
  select props.id, props.name, props.city, props.overdue_days, coalesce(t.in_arrears, 0),
    coalesce(t.amount, 0)::numeric,
    ((select count(*) from public.units x where x.property_id = props.id and x.status = 'active') - coalesce(t.in_arrears, 0))::integer,
    (select count(*)::integer from public.legal_property_news(props.id) n where n.is_new),
    props.seen_at
  from props left join totals t on t.property_id = props.id
  order by props.name;
end;
$$;

-- Abogada: cada apartamento del conjunto con su cartera en vivo. in_arrears = la deuda vencida más antigua
-- sin pagar lleva al menos el umbral de días del conjunto.
create or replace function public.legal_property_accounts(target_property_id uuid)
returns table(unit_id uuid, building_name text, unit_code text, owner_name text, outstanding numeric, overdue numeric, days_overdue integer, last_payment_on date, agreement_active boolean, in_arrears boolean)
language plpgsql stable security definer set search_path = '' as $$
declare today date; threshold integer;
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  select (now() at time zone p.timezone)::date, a.overdue_days into today, threshold
  from public.properties p join public.legal_assignments a on a.property_id = p.id where p.id = target_property_id;
  return query
  with recv as (
    select ar.unit_id, ar.due_on, private.receivable_outstanding(ar.id) as owed
    from public.accounts_receivable ar where ar.property_id = target_property_id and ar.status = 'active'
  ), agg as (
    select r.unit_id, sum(r.owed) as total, sum(r.owed) filter (where r.due_on < today) as late,
      min(r.due_on) filter (where r.owed > 0 and r.due_on < today) as oldest
    from recv r group by r.unit_id
  ), paid as (
    select p.unit_id, max(p.paid_on) as last_paid from public.payments p where p.property_id = target_property_id and p.status = 'posted' group by p.unit_id
  ), agreements as (
    select distinct g.unit_id from public.payment_agreements g where g.property_id = target_property_id and g.status = 'active'
  ), owners as (
    select distinct on (c.unit_id) c.unit_id, c.full_name from public.census_records c
    where c.property_id = target_property_id and c.full_name is not null order by c.unit_id, c.invitation_primary desc, c.source_row
  )
  select u.id, b.name, u.code, o.full_name, coalesce(g.total, 0)::numeric, coalesce(g.late, 0)::numeric,
    coalesce(today - g.oldest, 0)::integer, pd.last_paid, ag.unit_id is not null, g.oldest is not null and today - g.oldest >= threshold
  from public.units u join public.buildings b on b.property_id = u.property_id and b.id = u.building_id
  left join agg g on g.unit_id = u.id left join paid pd on pd.unit_id = u.id
  left join agreements ag on ag.unit_id = u.id left join owners o on o.unit_id = u.id
  where u.property_id = target_property_id and u.status = 'active'
  order by coalesce(today - g.oldest, 0) desc, coalesce(g.late, 0) desc, b.name, u.code;
end;
$$;

-- Abogada: novedades de cartera del conjunto en los últimos 60 días (cobros nuevos, multas u otras
-- obligaciones, pagos, anulaciones y acuerdos). is_new = después de su última visita.
create or replace function public.legal_property_news(target_property_id uuid)
returns table(occurred_at timestamptz, kind text, unit_id uuid, unit_label text, description text, amount numeric, is_new boolean)
language plpgsql stable security definer set search_path = '' as $$
declare seen timestamptz; since timestamptz := now() - interval '60 days';
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  select v.seen_at into seen from public.legal_property_views v where v.property_id = target_property_id and v.staff_id = private.legal_staff_id();
  return query
  with events as (
    select ar.created_at as at, case ar.source when 'manual' then 'charge_manual' when 'opening_balance' then 'charge_opening' else 'charge_import' end as k, ar.unit_id as unit, ar.concept as text_value, ar.amount as value
    from public.accounts_receivable ar where ar.property_id = target_property_id and ar.created_at >= since
    union all
    select ar.voided_at, 'charge_voided', ar.unit_id, ar.concept, ar.amount
    from public.accounts_receivable ar where ar.property_id = target_property_id and ar.status = 'void' and ar.voided_at >= since
    union all
    select p.created_at, 'payment', p.unit_id, coalesce(p.reference, ''), p.amount
    from public.payments p where p.property_id = target_property_id and p.created_at >= since
    union all
    select p.voided_at, 'payment_voided', p.unit_id, coalesce(p.reference, ''), p.amount
    from public.payments p where p.property_id = target_property_id and p.status = 'void' and p.voided_at >= since
    union all
    select g.created_at, 'agreement', g.unit_id, coalesce(g.notes, ''), g.total_amount
    from public.payment_agreements g where g.property_id = target_property_id and g.created_at >= since
    union all
    select g.cancelled_at, 'agreement_cancelled', g.unit_id, coalesce(g.cancel_reason, ''), g.total_amount
    from public.payment_agreements g where g.property_id = target_property_id and g.status = 'cancelled' and g.cancelled_at >= since
  )
  select e.at, e.k, e.unit, b.name || ' · ' || u.code, e.text_value, e.value::numeric, seen is null or e.at > seen
  from events e join public.units u on u.property_id = target_property_id and u.id = e.unit
  join public.buildings b on b.property_id = u.property_id and b.id = u.building_id
  order by e.at desc limit 300;
end;
$$;

-- Abogada: marca la visita al conjunto (las novedades vistas dejan de salir como nuevas).
create or replace function public.legal_mark_property_seen(target_property_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := private.legal_staff_id();
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  insert into public.legal_property_views(staff_id, property_id, seen_at) values (me, target_property_id, now())
  on conflict (staff_id, property_id) do update set seen_at = excluded.seen_at;
end;
$$;

-- Abogada: detalle de un apartamento en solo lectura (cobros, pagos, acuerdo y contactos del censo).
-- Cada consulta queda en auditoría.
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
    'overdue_days', (select a.overdue_days from public.legal_assignments a where a.property_id = target_property_id),
    'today', today,
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('name', c.full_name, 'type', c.user_type, 'email', c.email_normalized, 'phone', c.phone, 'primary', c.invitation_primary) order by c.invitation_primary desc, c.source_row)
      from public.census_records c where c.property_id = target_property_id and c.unit_id = target_unit_id), '[]'::jsonb),
    'receivables', coalesce((select jsonb_agg(jsonb_build_object('concept', ar.concept, 'amount', ar.amount, 'outstanding', private.receivable_outstanding(ar.id), 'issued_on', ar.issued_on, 'due_on', ar.due_on, 'status', ar.status, 'source', ar.source) order by ar.due_on desc, ar.created_at desc)
      from public.accounts_receivable ar where ar.property_id = target_property_id and ar.unit_id = target_unit_id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('amount', p.amount, 'paid_on', p.paid_on, 'reference', p.reference, 'status', p.status) order by p.paid_on desc, p.created_at desc)
      from public.payments p where p.property_id = target_property_id and p.unit_id = target_unit_id), '[]'::jsonb),
    'agreements', coalesce((select jsonb_agg(jsonb_build_object('total', g.total_amount, 'status', g.status, 'notes', g.notes, 'created_at', g.created_at,
        'installments', coalesce((select jsonb_agg(jsonb_build_object('amount', i.amount, 'due_on', i.due_on) order by i.due_on) from public.payment_agreement_installments i where i.property_id = g.property_id and i.agreement_id = g.id), '[]'::jsonb)) order by g.created_at desc)
      from public.payment_agreements g where g.property_id = target_property_id and g.unit_id = target_unit_id), '[]'::jsonb)
  ) into result;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (target_property_id, auth.uid(), 'property', 'legal.unit_viewed', 'unit', target_unit_id, '{}'::jsonb);
  return result;
end;
$$;

revoke all on function public.platform_invite_legal(text), public.platform_reissue_legal_invitation(uuid), public.platform_list_legal(),
  public.accept_legal_invitation(text), public.platform_list_legal_assignments(), public.platform_set_legal_assignment(uuid, boolean, integer),
  public.legal_list_properties(), public.legal_property_accounts(uuid), public.legal_property_news(uuid), public.legal_mark_property_seen(uuid),
  public.legal_unit_detail(uuid, uuid) from public, anon;
grant execute on function public.platform_invite_legal(text), public.platform_reissue_legal_invitation(uuid), public.platform_list_legal(),
  public.accept_legal_invitation(text), public.platform_list_legal_assignments(), public.platform_set_legal_assignment(uuid, boolean, integer),
  public.legal_list_properties(), public.legal_property_accounts(uuid), public.legal_property_news(uuid), public.legal_mark_property_seen(uuid),
  public.legal_unit_detail(uuid, uuid) to authenticated;

commit;

select
  exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'legal_assignments') as asignaciones_creadas,
  not has_table_privilege('authenticated', 'public.legal_invitations', 'select')
    and not has_table_privilege('authenticated', 'public.legal_assignments', 'select') as datos_juridicos_protegidos,
  has_function_privilege('authenticated', 'public.legal_property_accounts(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.legal_property_accounts(uuid)', 'execute') as bandeja_protegida,
  has_function_privilege('authenticated', 'public.accept_legal_invitation(text)', 'execute') as aceptar_invitacion_juridica;
