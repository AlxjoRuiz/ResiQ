-- Módulo de mantenimiento, entrega 6: informe mensual (28/10/2026).
-- Una sola función, solo para el admin de mantenimiento, que devuelve en JSON los datos del mes
-- (hora de Bogotá), opcionalmente de un solo trabajador:
-- * asistencia: jornadas con llegada dentro del mes;
-- * tareas: las que tienen la fecha límite dentro del mes (con su estado actual y su primera entrega);
-- * llamados: los llamados de atención con fecha dentro del mes;
-- * trabajadores: los vigentes y los dados de baja que tengan algo en el mes.
-- Los totales se calculan en la app; aquí no se guarda nada nuevo.
begin;

create or replace function public.maintenance_monthly_report(target_month date, target_staff_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  month_start date := date_trunc('month', target_month)::date;
  month_end date := (date_trunc('month', target_month) + interval '1 month')::date;
  from_at timestamptz := month_start::timestamp at time zone 'America/Bogota';
  to_at timestamptz := month_end::timestamp at time zone 'America/Bogota';
  today date := (now() at time zone 'America/Bogota')::date;
  result jsonb;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  if target_month is null then raise exception 'invalid_month'; end if;

  with attendance as (
    select a.staff_id, a.check_in_at, a.check_out_at, a.check_out_manual, a.check_out_reason
    from public.maintenance_attendance a
    where a.check_in_at >= from_at and a.check_in_at < to_at and (target_staff_id is null or a.staff_id = target_staff_id)
  ), tasks as (
    select t.id, t.staff_id, t.title, t.property_name, t.due_date, t.status,
      (t.status in ('pending', 'rejected') and t.due_date < today) as overdue,
      (select min(d.submitted_at) from public.maintenance_task_deliveries d where d.task_id = t.id) as first_submitted_at,
      (select count(*) from public.maintenance_task_deliveries d where d.task_id = t.id) as deliveries,
      (select max(d.reviewed_at) from public.maintenance_task_deliveries d where d.task_id = t.id and d.review = 'approved') as approved_at
    from public.maintenance_tasks t
    where t.due_date >= month_start and t.due_date < month_end and (target_staff_id is null or t.staff_id = target_staff_id)
  ), warnings as (
    select w.staff_id, w.warning_date, w.reason, w.description
    from public.maintenance_warnings w
    where w.warning_date >= month_start and w.warning_date < month_end and (target_staff_id is null or w.staff_id = target_staff_id)
  ), workers as (
    select s.id as staff_id, coalesce(r.first_name || ' ' || r.first_surname, p.display_name) as name, r.username, s.status
    from public.maintenance_staff s
    join public.profiles p on p.id = s.user_id
    left join public.maintenance_worker_records r on r.staff_id = s.id
    where s.role = 'worker' and (target_staff_id is null or s.id = target_staff_id)
      and (s.status <> 'revoked'
        or exists(select 1 from attendance x where x.staff_id = s.id)
        or exists(select 1 from tasks x where x.staff_id = s.id)
        or exists(select 1 from warnings x where x.staff_id = s.id))
  )
  select jsonb_build_object(
    'month', to_char(month_start, 'YYYY-MM'),
    'workers', coalesce((select jsonb_agg(to_jsonb(w) order by w.name) from workers w), '[]'::jsonb),
    'attendance', coalesce((select jsonb_agg(to_jsonb(a) order by a.check_in_at) from attendance a), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t) order by t.due_date, t.title) from tasks t), '[]'::jsonb),
    'warnings', coalesce((select jsonb_agg(to_jsonb(w) order by w.warning_date) from warnings w), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.maintenance_monthly_report(date, uuid) from public, anon;
grant execute on function public.maintenance_monthly_report(date, uuid) to authenticated;

commit;

select
  has_function_privilege('authenticated', 'public.maintenance_monthly_report(date, uuid)', 'execute') as informe_disponible,
  not has_function_privilege('anon', 'public.maintenance_monthly_report(date, uuid)', 'execute') as informe_protegido;
