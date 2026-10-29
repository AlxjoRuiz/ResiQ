-- Informe de mantenimiento por rango de fechas (28/10/2026): «desde» y «hasta» elegidos en un calendario.
-- Igual que maintenance_monthly_report, pero recibe un rango (de target_from a target_to, ambos
-- incluidos, máximo un año): sirve para un solo día, una semana, un mes, etc. Hora de Bogotá:
-- * asistencia: jornadas con llegada dentro del rango;
-- * tareas: las que tienen la fecha límite dentro del rango;
-- * llamados: los que tienen fecha dentro del rango.
-- Los datos se leen en vivo cada vez, así que el informe siempre está al día.
-- maintenance_monthly_report se deja mientras se publica la nueva versión de la app.
begin;

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
    where a.check_in_at >= from_at and a.check_in_at < to_at
  ), tasks as (
    select t.id, t.staff_id, t.title, t.property_name, t.due_date, t.status,
      (t.status in ('pending', 'rejected') and t.due_date < today) as overdue,
      (select min(d.submitted_at) from public.maintenance_task_deliveries d where d.task_id = t.id) as first_submitted_at,
      (select count(*) from public.maintenance_task_deliveries d where d.task_id = t.id) as deliveries,
      (select max(d.reviewed_at) from public.maintenance_task_deliveries d where d.task_id = t.id and d.review = 'approved') as approved_at
    from public.maintenance_tasks t
    where t.due_date between target_from and target_to
  ), warnings as (
    select w.staff_id, w.warning_date, w.reason, w.description
    from public.maintenance_warnings w
    where w.warning_date between target_from and target_to
  ), workers as (
    select s.id as staff_id, coalesce(r.first_name || ' ' || r.first_surname, p.display_name) as name, r.username, s.status
    from public.maintenance_staff s
    join public.profiles p on p.id = s.user_id
    left join public.maintenance_worker_records r on r.staff_id = s.id
    where s.role = 'worker'
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

revoke all on function public.maintenance_report(date, date) from public, anon;
grant execute on function public.maintenance_report(date, date) to authenticated;

commit;

select
  has_function_privilege('authenticated', 'public.maintenance_report(date, date)', 'execute') as informe_por_rango_disponible,
  not has_function_privilege('anon', 'public.maintenance_report(date, date)', 'execute') as informe_por_rango_protegido;
