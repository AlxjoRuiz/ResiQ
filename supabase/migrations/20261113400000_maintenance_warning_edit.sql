-- Editar y borrar llamados de atención (13/11/2026, pedido de Alejandro). Antes, un llamado registrado no se podía
-- cambiar. Ahora el admin de mantenimiento puede corregir la fecha, el motivo y la descripción, o borrarlo.
-- * Solo el admin de mantenimiento, y solo llamados de trabajadores de su lado (prueba o producción), como al crearlos.
-- * La fecha sigue sin poder ser futura. El trabajador sigue viendo los suyos en solo lectura (ya con el cambio).
begin;

create or replace function public.maintenance_update_warning(target_warning_id uuid, target_date date, target_reason text, target_description text)
returns void language plpgsql security definer set search_path = '' as $$
declare warning public.maintenance_warnings%rowtype;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  select * into warning from public.maintenance_warnings where id = target_warning_id for update;
  if not found or not private.maintenance_same_side(warning.staff_id) then raise exception 'warning_not_found'; end if;
  if target_date is null or target_date > (now() at time zone 'America/Bogota')::date then raise exception 'invalid_date'; end if;
  update public.maintenance_warnings set warning_date = target_date, reason = trim(target_reason), description = trim(target_description)
  where id = warning.id;
exception when check_violation then raise exception 'invalid_data';
end;
$$;

create or replace function public.maintenance_delete_warning(target_warning_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare warning public.maintenance_warnings%rowtype;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  select * into warning from public.maintenance_warnings where id = target_warning_id for update;
  if not found or not private.maintenance_same_side(warning.staff_id) then raise exception 'warning_not_found'; end if;
  delete from public.maintenance_warnings where id = warning.id;
end;
$$;

revoke all on function public.maintenance_update_warning(uuid, date, text, text), public.maintenance_delete_warning(uuid) from public, anon;
grant execute on function public.maintenance_update_warning(uuid, date, text, text), public.maintenance_delete_warning(uuid) to authenticated;

commit;

-- Debe dar true.
select exists(select 1 from pg_proc where proname = 'maintenance_update_warning') and exists(select 1 from pg_proc where proname = 'maintenance_delete_warning') as editar_borrar_llamados;
