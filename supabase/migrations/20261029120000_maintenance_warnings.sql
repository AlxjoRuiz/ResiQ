-- Módulo de mantenimiento, entrega 5: llamados de atención (28/10/2026).
-- * El admin de mantenimiento registra un llamado de atención a un trabajador: fecha, motivo y descripción.
-- * El trabajador solo puede consultar los suyos; no puede editarlos ni borrarlos.
-- * La fecha no puede ser futura (hora de Bogotá).
begin;

create table public.maintenance_warnings (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.maintenance_staff(id) on delete restrict,
  warning_date date not null,
  reason text not null check (char_length(trim(reason)) between 3 and 120),
  description text not null check (char_length(trim(description)) between 3 and 2000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index maintenance_warnings_staff_idx on public.maintenance_warnings(staff_id, warning_date desc);
alter table public.maintenance_warnings enable row level security;
revoke all on public.maintenance_warnings from public, anon, authenticated;

-- Admin: registra el llamado. El trabajador debe existir (activo o suspendido, no dado de baja).
create or replace function public.maintenance_create_warning(target_staff_id uuid, target_date date, target_reason text, target_description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created uuid;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.maintenance_staff where id = target_staff_id and role = 'worker' and status in ('active', 'suspended')) then
    raise exception 'invalid_worker';
  end if;
  if target_date is null or target_date > (now() at time zone 'America/Bogota')::date then raise exception 'invalid_date'; end if;
  insert into public.maintenance_warnings(staff_id, warning_date, reason, description, created_by)
  values (target_staff_id, target_date, trim(target_reason), trim(target_description), auth.uid()) returning id into created;
  return created;
exception when check_violation then raise exception 'invalid_data';
end;
$$;

-- Llamados: el admin ve los de todos (filtrable por trabajador); el trabajador solo los suyos.
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
    and (target_staff_id is null or w.staff_id = target_staff_id)
  order by w.warning_date desc, w.created_at desc
  limit 300;
end;
$$;

revoke all on function public.maintenance_create_warning(uuid, date, text, text), public.maintenance_list_warnings(uuid) from public, anon;
grant execute on function public.maintenance_create_warning(uuid, date, text, text), public.maintenance_list_warnings(uuid) to authenticated;

commit;

select
  not has_table_privilege('authenticated', 'public.maintenance_warnings', 'select')
    and not has_table_privilege('authenticated', 'public.maintenance_warnings', 'insert') as llamados_protegidos,
  has_function_privilege('authenticated', 'public.maintenance_list_warnings(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.maintenance_list_warnings(uuid)', 'execute') as consultar_disponible,
  has_function_privilege('authenticated', 'public.maintenance_create_warning(uuid, date, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.maintenance_create_warning(uuid, date, text, text)', 'execute') as registrar_disponible;
