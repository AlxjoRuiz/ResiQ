-- Módulo jurídico (31/10/2026, corrección de Alejandro): los días de mora NO los configura el superadmin.
-- Salen de la política de mora que el admin del conjunto define en Cartera («Días de mora para bloquear
-- reservas», property_policies.minimum_overdue_days; 30 si nunca la cambió). El superadmin solo asigna o
-- quita conjuntos. legal_assignments.overdue_days queda sin uso. Mismas firmas que antes.
begin;

-- Días de mora del conjunto según su admin.
create or replace function private.property_overdue_days(target_property_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select pp.minimum_overdue_days from public.property_policies pp where pp.property_id = target_property_id), 30);
$$;
revoke all on function private.property_overdue_days(uuid) from public, anon;
grant execute on function private.property_overdue_days(uuid) to authenticated;

-- Superadmin: conjuntos con su asignación a jurídica y los días de mora que puso su admin.
create or replace function public.platform_list_legal_assignments()
returns table(property_id uuid, property_name text, property_status text, assigned boolean, overdue_days integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query
  select p.id, p.name, p.status, a.property_id is not null, private.property_overdue_days(p.id)
  from public.properties p left join public.legal_assignments a on a.property_id = p.id
  where p.status <> 'archived' order by p.name;
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
    select p.id, p.name, p.city, p.timezone, private.property_overdue_days(p.id) as overdue_days, v.seen_at
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
-- sin pagar lleva al menos los días de mora que puso el admin del conjunto.
create or replace function public.legal_property_accounts(target_property_id uuid)
returns table(unit_id uuid, building_name text, unit_code text, owner_name text, outstanding numeric, overdue numeric, days_overdue integer, last_payment_on date, agreement_active boolean, in_arrears boolean)
language plpgsql stable security definer set search_path = '' as $$
declare today date; threshold integer;
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  select (now() at time zone p.timezone)::date into today from public.properties p where p.id = target_property_id;
  threshold := private.property_overdue_days(target_property_id);
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
    'overdue_days', private.property_overdue_days(target_property_id),
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

commit;

-- Debe dar true.
select exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'property_overdue_days')
  and not has_function_privilege('anon', 'private.property_overdue_days(uuid)', 'execute') as mora_del_admin_en_juridica;
