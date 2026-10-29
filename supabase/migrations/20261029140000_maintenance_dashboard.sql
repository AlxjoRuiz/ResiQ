-- Inicio del admin de mantenimiento (28/10/2026): datos del dashboard en una sola llamada.
-- * active_workers: trabajadores activos.
-- * on_shift: quiénes están en jornada ahora (llegaron hoy y no han marcado salida), con su hora.
-- * open_previous: jornadas sin salida de días anteriores (el admin debe registrar la salida a mano).
-- * to_review / overdue / due_today: tareas por revisar, vencidas y que vencen hoy.
-- * series: últimos 14 días, trabajadores que marcaron llegada y minutos trabajados (jornadas cerradas).
-- * tasks_month: tareas con fecha límite este mes por estado (igual que el informe mensual).
-- Todo en hora de Bogotá. Solo el admin de mantenimiento.
begin;

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
    'active_workers', (select count(*) from public.maintenance_staff where role = 'worker' and status = 'active'),
    'on_shift', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(r.first_name || ' ' || r.first_surname, p.display_name), 'check_in_at', a.check_in_at) order by a.check_in_at)
      from public.maintenance_attendance a
      join public.maintenance_staff s on s.id = a.staff_id
      join public.profiles p on p.id = s.user_id
      left join public.maintenance_worker_records r on r.staff_id = s.id
      where a.check_out_at is null and a.check_in_at >= today_start), '[]'::jsonb),
    'open_previous', (select count(*) from public.maintenance_attendance where check_out_at is null and check_in_at < today_start),
    'to_review', (select count(*) from public.maintenance_tasks where status = 'submitted'),
    'overdue', (select count(*) from public.maintenance_tasks where status in ('pending', 'rejected') and due_date < today),
    'due_today', (select count(*) from public.maintenance_tasks where status in ('pending', 'rejected') and due_date = today),
    'series', (
      select jsonb_agg(jsonb_build_object(
        'day', to_char(day, 'YYYY-MM-DD'),
        'workers', (select count(distinct a.staff_id) from public.maintenance_attendance a
          where a.check_in_at >= day at time zone 'America/Bogota' and a.check_in_at < (day + interval '1 day') at time zone 'America/Bogota'),
        'minutes', (select coalesce(round(sum(extract(epoch from (a.check_out_at - a.check_in_at)) / 60)), 0)::integer from public.maintenance_attendance a
          where a.check_out_at is not null and a.check_in_at >= day at time zone 'America/Bogota' and a.check_in_at < (day + interval '1 day') at time zone 'America/Bogota')
      ) order by day)
      from generate_series((today - 13)::timestamp, today::timestamp, interval '1 day') day),
    'tasks_month', (
      select jsonb_build_object(
        'approved', count(*) filter (where status = 'approved'),
        'submitted', count(*) filter (where status = 'submitted'),
        'open', count(*) filter (where status in ('pending', 'rejected') and due_date >= today),
        'overdue', count(*) filter (where status in ('pending', 'rejected') and due_date < today))
      from public.maintenance_tasks where due_date >= month_start and due_date < (month_start + interval '1 month')::date)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_maintenance_dashboard() from public, anon;
grant execute on function public.get_maintenance_dashboard() to authenticated;

commit;

select
  has_function_privilege('authenticated', 'public.get_maintenance_dashboard()', 'execute') as dashboard_disponible,
  not has_function_privilege('anon', 'public.get_maintenance_dashboard()', 'execute') as dashboard_protegido;
