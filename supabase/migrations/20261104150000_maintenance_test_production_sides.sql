-- Mantenimiento separado en prueba y producción (04/11/2026, pedido de Alejandro).
-- Hasta hoy el módulo era un solo equipo: todo admin de mantenimiento veía a todos los trabajadores, incluidos
-- los de prueba. Ahora cada admin ve y maneja solo a los trabajadores de su mismo lado:
-- * De prueba: correo @resiq.invalid o marcado como de prueba en Plataforma › Pruebas ResiQ.
-- * De producción: el resto.
-- Aplica a Trabajadores, Asistencia, Tareas, Llamados de atención, Informe e Inicio. Las funciones son las
-- mismas de antes con el filtro agregado (mismas firmas). Lo del propio trabajador no cambia.
begin;

-- ¿La cuenta de este miembro del equipo es de prueba?
create or replace function private.maintenance_staff_is_test(target_staff_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select lower(u.email::text) like '%@resiq.invalid'
      or exists(select 1 from public.platform_test_emails t where t.email_normalized = lower(u.email::text))
    from public.maintenance_staff s join auth.users u on u.id = s.user_id where s.id = target_staff_id), false);
$$;
revoke all on function private.maintenance_staff_is_test(uuid) from public, anon, authenticated;

-- ¿Ese miembro del equipo está del mismo lado (prueba o producción) que la cuenta que consulta?
create or replace function private.maintenance_same_side(target_staff_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.maintenance_staff_is_test(target_staff_id) = private.maintenance_staff_is_test(
    (select s.id from public.maintenance_staff s where s.user_id = auth.uid() and s.status = 'active' limit 1));
$$;
revoke all on function private.maintenance_same_side(uuid) from public, anon;
grant execute on function private.maintenance_same_side(uuid) to authenticated;

-- Admin de mantenimiento: ¿su cuenta es de prueba? (los trabajadores que crea una cuenta de prueba quedan de prueba).
create or replace function public.maintenance_is_test_side()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.maintenance_staff_is_test((select s.id from public.maintenance_staff s where s.user_id = auth.uid() and s.status = 'active' limit 1));
$$;
revoke all on function public.maintenance_is_test_side() from public, anon;
grant execute on function public.maintenance_is_test_side() to authenticated;

-- Admin de mantenimiento: ¿puede manejar a este trabajador? (editar, contraseña, suspender, eliminar).
create or replace function public.maintenance_can_manage_worker(target_staff_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_maintenance_staff('admin') and private.maintenance_same_side(target_staff_id)
    and exists(select 1 from public.maintenance_staff s where s.id = target_staff_id and s.role = 'worker');
$$;
revoke all on function public.maintenance_can_manage_worker(uuid) from public, anon;
grant execute on function public.maintenance_can_manage_worker(uuid) to authenticated;

create or replace function public.maintenance_list_workers()
returns table(record_id uuid, staff_id uuid, username text, first_name text, first_surname text, document_number text,
  birth_date date, phone_e164 text, email text, address text, vehicles jsonb, staff_status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  return query
  select r.id, s.id, r.username, r.first_name, r.first_surname, r.document_number, r.birth_date, r.phone_e164,
    r.email_normalized, r.address, r.vehicles, s.status, r.created_at
  from public.maintenance_worker_records r join public.maintenance_staff s on s.id = r.staff_id
  where r.removed_at is null and s.role = 'worker' and private.maintenance_same_side(s.id)
  order by r.first_name, r.first_surname;
end;
$$;

create or replace function public.maintenance_list_attendance(target_from timestamptz, target_to timestamptz, target_staff_id uuid default null)
returns table(attendance_id uuid, staff_id uuid, worker_name text, check_in_at timestamptz, check_in_photo_path text,
  check_out_at timestamptz, check_out_photo_path text, check_out_manual boolean, check_out_reason text)
language plpgsql stable security definer set search_path = '' as $$
declare me public.maintenance_staff%rowtype;
begin
  select * into me from public.maintenance_staff where user_id = auth.uid() and status = 'active';
  if not found then raise exception 'not_authorized'; end if;
  return query
  select a.id, a.staff_id, coalesce(r.first_name || ' ' || r.first_surname, p.display_name), a.check_in_at, a.check_in_photo_path,
    a.check_out_at, a.check_out_photo_path, a.check_out_manual, a.check_out_reason
  from public.maintenance_attendance a
  join public.maintenance_staff s on s.id = a.staff_id
  join public.profiles p on p.id = s.user_id
  left join public.maintenance_worker_records r on r.staff_id = s.id
  where a.check_in_at >= target_from and a.check_in_at < target_to
    and (me.role = 'admin' or a.staff_id = me.id)
    and (me.role <> 'admin' or private.maintenance_same_side(a.staff_id))
    and (target_staff_id is null or a.staff_id = target_staff_id)
  order by a.check_in_at desc;
end;
$$;

create or replace function public.maintenance_close_attendance(target_attendance_id uuid, target_check_out_at timestamptz, target_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.maintenance_attendance%rowtype;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  select * into item from public.maintenance_attendance where id = target_attendance_id for update;
  if not found or item.check_out_at is not null or not private.maintenance_same_side(item.staff_id) then raise exception 'not_open'; end if;
  if target_check_out_at is null or target_check_out_at <= item.check_in_at or target_check_out_at > now() then raise exception 'invalid_time'; end if;
  if char_length(trim(coalesce(target_reason, ''))) not between 3 and 300 then raise exception 'reason_required'; end if;
  update public.maintenance_attendance set check_out_at = target_check_out_at, check_out_manual = true,
    check_out_reason = trim(target_reason), closed_by = auth.uid() where id = item.id;
end;
$$;

create or replace function public.maintenance_list_warnings(target_staff_id uuid default null)
returns table(warning_id uuid, staff_id uuid, worker_name text, warning_date date, reason text, description text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare me public.maintenance_staff%rowtype;
begin
  select * into me from public.maintenance_staff s where s.user_id = auth.uid() and s.status = 'active';
  if not found then raise exception 'not_authorized'; end if;
  return query
  select w.id, w.staff_id, coalesce(r.first_name || ' ' || r.first_surname, p.display_name), w.warning_date, w.reason, w.description, w.created_at
  from public.maintenance_warnings w
  join public.maintenance_staff s on s.id = w.staff_id
  join public.profiles p on p.id = s.user_id
  left join public.maintenance_worker_records r on r.staff_id = s.id
  where (me.role = 'admin' or w.staff_id = me.id)
    and (me.role <> 'admin' or private.maintenance_same_side(w.staff_id))
    and (target_staff_id is null or w.staff_id = target_staff_id)
  order by w.warning_date desc, w.created_at desc
  limit 300;
end;
$$;

create or replace function public.maintenance_create_warning(target_staff_id uuid, target_date date, target_reason text, target_description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created uuid;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.maintenance_staff where id = target_staff_id and role = 'worker' and status in ('active', 'suspended') and private.maintenance_same_side(id)) then
    raise exception 'invalid_worker';
  end if;
  if target_date is null or target_date > (now() at time zone 'America/Bogota')::date then raise exception 'invalid_date'; end if;
  insert into public.maintenance_warnings(staff_id, warning_date, reason, description, created_by)
  values (target_staff_id, target_date, trim(target_reason), trim(target_description), auth.uid()) returning id into created;
  return created;
exception when check_violation then raise exception 'invalid_data';
end;
$$;

create or replace function public.maintenance_create_task(target_title text, target_description text, target_property_name text,
  target_due_date date, target_staff_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare requested integer; valid integer; created integer;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  if target_due_date is null or target_due_date < (now() at time zone 'America/Bogota')::date then raise exception 'invalid_due_date'; end if;
  select count(distinct worker) into requested from unnest(coalesce(target_staff_ids, '{}'::uuid[])) worker;
  if requested = 0 then raise exception 'workers_required'; end if;
  select count(*) into valid from public.maintenance_staff where id = any(target_staff_ids) and role = 'worker' and status = 'active' and private.maintenance_same_side(id);
  if valid <> requested then raise exception 'invalid_worker'; end if;
  insert into public.maintenance_tasks(batch_id, staff_id, title, description, property_name, due_date, created_by)
  select batch.id, worker, trim(target_title), trim(target_description), trim(target_property_name), target_due_date, auth.uid()
  from (select distinct unnest(target_staff_ids) worker) workers, (select gen_random_uuid() id) batch;
  get diagnostics created = row_count;
  return created;
exception when check_violation then raise exception 'invalid_data';
end;
$$;

create or replace function public.maintenance_delete_task(target_task_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  delete from public.maintenance_tasks t where t.id = target_task_id and t.status = 'pending' and private.maintenance_same_side(t.staff_id)
    and not exists(select 1 from public.maintenance_task_deliveries d where d.task_id = t.id);
  if not found then raise exception 'cannot_delete'; end if;
end;
$$;

create or replace function public.maintenance_list_tasks(target_staff_id uuid default null, target_status text default null)
returns table(task_id uuid, staff_id uuid, worker_name text, title text, description text, property_name text, due_date date,
  status text, overdue boolean, created_at timestamptz, deliveries jsonb)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare me public.maintenance_staff%rowtype; today date := (now() at time zone 'America/Bogota')::date;
begin
  select * into me from public.maintenance_staff s where s.user_id = auth.uid() and s.status = 'active';
  if not found then raise exception 'not_authorized'; end if;
  return query
  select t.id, t.staff_id, coalesce(r.first_name || ' ' || r.first_surname, p.display_name), t.title, t.description, t.property_name,
    t.due_date, t.status, (t.status in ('pending', 'rejected') and t.due_date < today), t.created_at,
    coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'note', d.note, 'photo_paths', d.photo_paths, 'submitted_at', d.submitted_at,
      'review', d.review, 'review_comment', d.review_comment, 'reviewed_at', d.reviewed_at) order by d.submitted_at desc)
      from public.maintenance_task_deliveries d where d.task_id = t.id), '[]'::jsonb)
  from public.maintenance_tasks t
  join public.maintenance_staff s on s.id = t.staff_id
  join public.profiles p on p.id = s.user_id
  left join public.maintenance_worker_records r on r.staff_id = s.id
  where (me.role = 'admin' or t.staff_id = me.id)
    and (me.role <> 'admin' or private.maintenance_same_side(t.staff_id))
    and (target_staff_id is null or t.staff_id = target_staff_id)
    and (target_status is null
      or (target_status = 'overdue' and t.status in ('pending', 'rejected') and t.due_date < today)
      or t.status = target_status)
    and (t.status <> 'approved' or t.updated_at > now() - interval '90 days')
  order by case t.status when 'submitted' then 0 when 'rejected' then 1 when 'pending' then 2 else 3 end, t.due_date, t.created_at desc
  limit 300;
end;
$$;

create or replace function public.maintenance_review_task(target_task_id uuid, target_approve boolean, target_comment text)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.maintenance_tasks%rowtype;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  select * into item from public.maintenance_tasks where id = target_task_id for update;
  if not found or item.status <> 'submitted' or not private.maintenance_same_side(item.staff_id) then raise exception 'not_submitted'; end if;
  if not coalesce(target_approve, false) and char_length(trim(coalesce(target_comment, ''))) < 3 then raise exception 'comment_required'; end if;
  update public.maintenance_task_deliveries set review = case when target_approve then 'approved' else 'rejected' end,
    review_comment = nullif(trim(target_comment), ''), reviewed_at = now(), reviewed_by = auth.uid()
  where id = (select id from public.maintenance_task_deliveries where task_id = item.id and review is null order by submitted_at desc limit 1);
  update public.maintenance_tasks set status = case when target_approve then 'approved' else 'rejected' end, updated_at = now() where id = item.id;
end;
$$;

create or replace function public.get_maintenance_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'America/Bogota')::date;
  today_start timestamptz := today::timestamp at time zone 'America/Bogota';
  month_start date := date_trunc('month', today)::date;
  result jsonb;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  select jsonb_build_object(
    'active_workers', (select count(*) from public.maintenance_staff where role = 'worker' and status = 'active' and private.maintenance_same_side(id)),
    'on_shift', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(r.first_name || ' ' || r.first_surname, p.display_name), 'check_in_at', a.check_in_at) order by a.check_in_at)
      from public.maintenance_attendance a
      join public.maintenance_staff s on s.id = a.staff_id
      join public.profiles p on p.id = s.user_id
      left join public.maintenance_worker_records r on r.staff_id = s.id
      where a.check_out_at is null and a.check_in_at >= today_start and private.maintenance_same_side(a.staff_id)), '[]'::jsonb),
    'open_previous', (select count(*) from public.maintenance_attendance where check_out_at is null and check_in_at < today_start and private.maintenance_same_side(staff_id)),
    'to_review', (select count(*) from public.maintenance_tasks where status = 'submitted' and private.maintenance_same_side(staff_id)),
    'overdue', (select count(*) from public.maintenance_tasks where status in ('pending', 'rejected') and due_date < today and private.maintenance_same_side(staff_id)),
    'due_today', (select count(*) from public.maintenance_tasks where status in ('pending', 'rejected') and due_date = today and private.maintenance_same_side(staff_id)),
    'series', (
      select jsonb_agg(jsonb_build_object(
        'day', to_char(day, 'YYYY-MM-DD'),
        'workers', (select count(distinct a.staff_id) from public.maintenance_attendance a
          where private.maintenance_same_side(a.staff_id) and a.check_in_at >= day at time zone 'America/Bogota' and a.check_in_at < (day + interval '1 day') at time zone 'America/Bogota'),
        'minutes', (select coalesce(round(sum(extract(epoch from (a.check_out_at - a.check_in_at)) / 60)), 0)::integer from public.maintenance_attendance a
          where private.maintenance_same_side(a.staff_id) and a.check_out_at is not null and a.check_in_at >= day at time zone 'America/Bogota' and a.check_in_at < (day + interval '1 day') at time zone 'America/Bogota')
      ) order by day)
      from generate_series((today - 13)::timestamp, today::timestamp, interval '1 day') day),
    'tasks_month', (
      select jsonb_build_object(
        'approved', count(*) filter (where status = 'approved'),
        'submitted', count(*) filter (where status = 'submitted'),
        'open', count(*) filter (where status in ('pending', 'rejected') and due_date >= today),
        'overdue', count(*) filter (where status in ('pending', 'rejected') and due_date < today))
      from public.maintenance_tasks where private.maintenance_same_side(staff_id) and due_date >= month_start and due_date < (month_start + interval '1 month')::date)
  ) into result;
  return result;
end;
$$;

create or replace function public.maintenance_report(target_from date, target_to date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  from_at timestamptz := target_from::timestamp at time zone 'America/Bogota';
  to_at timestamptz := (target_to + 1)::timestamp at time zone 'America/Bogota';
  today date := (now() at time zone 'America/Bogota')::date;
  result jsonb;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  if target_from is null or target_to is null or target_to < target_from or target_to - target_from > 365 then raise exception 'invalid_range'; end if;

  with attendance as (
    select a.staff_id, a.check_in_at, a.check_out_at, a.check_out_manual, a.check_out_reason
    from public.maintenance_attendance a
    where a.check_in_at >= from_at and a.check_in_at < to_at and private.maintenance_same_side(a.staff_id)
  ), tasks as (
    select t.id, t.staff_id, t.title, t.property_name, t.due_date, t.status,
      (t.status in ('pending', 'rejected') and t.due_date < today) as overdue,
      (select min(d.submitted_at) from public.maintenance_task_deliveries d where d.task_id = t.id) as first_submitted_at,
      (select count(*) from public.maintenance_task_deliveries d where d.task_id = t.id) as deliveries,
      (select max(d.reviewed_at) from public.maintenance_task_deliveries d where d.task_id = t.id and d.review = 'approved') as approved_at
    from public.maintenance_tasks t
    where t.due_date between target_from and target_to and private.maintenance_same_side(t.staff_id)
  ), warnings as (
    select w.staff_id, w.warning_date, w.reason, w.description
    from public.maintenance_warnings w
    where w.warning_date between target_from and target_to and private.maintenance_same_side(w.staff_id)
  ), workers as (
    select s.id as staff_id, coalesce(r.first_name || ' ' || r.first_surname, p.display_name) as name, r.username, s.status
    from public.maintenance_staff s
    join public.profiles p on p.id = s.user_id
    left join public.maintenance_worker_records r on r.staff_id = s.id
    where s.role = 'worker' and private.maintenance_same_side(s.id)
      and (s.status <> 'revoked'
        or exists(select 1 from attendance x where x.staff_id = s.id)
        or exists(select 1 from tasks x where x.staff_id = s.id)
        or exists(select 1 from warnings x where x.staff_id = s.id))
  )
  select jsonb_build_object(
    'workers', coalesce((select jsonb_agg(to_jsonb(w) order by w.name) from workers w), '[]'::jsonb),
    'attendance', coalesce((select jsonb_agg(to_jsonb(a) order by a.check_in_at) from attendance a), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) order by t.due_date, t.title) from tasks t), '[]'::jsonb),
    'warnings', coalesce((select jsonb_agg(to_jsonb(w) order by w.warning_date) from warnings w), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

notify pgrst, 'reload schema';
commit;

-- Debe dar true.
select pg_get_functiondef('public.maintenance_list_workers()'::regprocedure) like '%maintenance_same_side%'
  and pg_get_functiondef('public.get_maintenance_dashboard()'::regprocedure) like '%maintenance_same_side%'
  and has_function_privilege('authenticated', 'public.maintenance_can_manage_worker(uuid)', 'execute') as mantenimiento_separado;
