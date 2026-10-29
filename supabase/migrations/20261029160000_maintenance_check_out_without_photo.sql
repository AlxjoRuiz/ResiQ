-- Asistencia de mantenimiento (29/10/2026, pedido de Alejandro): la foto solo se toma al marcar la
-- LLEGADA. La salida se marca con un botón, sin foto; la hora la sigue poniendo el servidor (now()).
-- * La regla de la tabla ya no exige foto en la salida normal; la salida manual del admin sigue
--   exigiendo motivo. Las salidas anteriores conservan su foto.
-- * maintenance_check_out acepta la foto como opcional (por defecto null) para que la versión de la
--   app ya publicada siga funcionando mientras se despliega la nueva, que la llama sin foto.
begin;

-- La restricción original no tiene nombre propio: se busca por su definición.
do $$
declare constraint_name text;
begin
  select c.conname into constraint_name from pg_constraint c
  where c.conrelid = 'public.maintenance_attendance'::regclass and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%check_out_photo_path%';
  if constraint_name is null then raise exception 'check_out_constraint_not_found'; end if;
  execute format('alter table public.maintenance_attendance drop constraint %I', constraint_name);
end;
$$;

-- Salida manual del admin: con motivo. Salida normal: con o sin foto.
alter table public.maintenance_attendance add constraint maintenance_attendance_check_out_rule
  check (check_out_at is null or not check_out_manual or check_out_reason is not null);

-- Trabajador: marca la salida de su jornada abierta. La foto es opcional.
create or replace function public.maintenance_check_out(target_photo_path text default null)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare me uuid; left_at timestamptz;
begin
  select id into me from public.maintenance_staff where user_id = auth.uid() and status = 'active' and role = 'worker';
  if me is null then raise exception 'not_authorized'; end if;
  update public.maintenance_attendance set check_out_at = now(), check_out_photo_path = nullif(trim(target_photo_path), '')
  where staff_id = me and check_out_at is null returning check_out_at into left_at;
  if left_at is null then raise exception 'not_checked_in'; end if;
  return left_at;
end;
$$;

revoke all on function public.maintenance_check_out(text) from public, anon;
grant execute on function public.maintenance_check_out(text) to authenticated;

commit;

select
  not exists(select 1 from pg_constraint where conrelid = 'public.maintenance_attendance'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%check_out_photo_path%') as salida_sin_foto_permitida,
  exists(select 1 from pg_constraint where conname = 'maintenance_attendance_check_out_rule') as salida_manual_con_motivo,
  pg_get_function_arguments('public.maintenance_check_out(text)'::regprocedure) like '%DEFAULT NULL%' as foto_de_salida_opcional,
  has_function_privilege('authenticated', 'public.maintenance_check_out(text)', 'execute')
    and not has_function_privilege('anon', 'public.maintenance_check_out(text)', 'execute') as salida_protegida;
