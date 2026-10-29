-- Módulo de mantenimiento, entrega 3: asistencia con foto (28/10/2026).
-- * El trabajador marca LLEGADA y SALIDA de su jornada con una foto obligatoria. La hora siempre la
--   pone el servidor (now()); se muestra en hora de Bogotá. La hora del celular nunca se usa.
-- * No se puede marcar una llegada con otra jornada abierta (índice único) ni salir sin llegada.
-- * Si olvida la salida, el admin de mantenimiento la registra a mano con la hora y un motivo; esa
--   jornada queda marcada como «salida manual». Mientras no tenga salida no suma horas.
-- Las fotos van en el almacenamiento privado (las sube el servidor de la app); aquí solo su ruta.
begin;

create table public.maintenance_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.maintenance_staff(id) on delete restrict,
  check_in_at timestamptz not null default now(),
  check_in_photo_path text not null,
  check_out_at timestamptz,
  check_out_photo_path text,
  check_out_manual boolean not null default false,
  check_out_reason text check (check_out_reason is null or char_length(trim(check_out_reason)) between 3 and 300),
  closed_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (check_out_at is null or check_out_at > check_in_at),
  -- Salida normal: con foto. Salida manual del admin: con motivo y sin foto.
  check (check_out_at is null or (check_out_manual and check_out_reason is not null) or (not check_out_manual and check_out_photo_path is not null))
);
-- Una sola jornada abierta por trabajador: no hay dos llegadas seguidas sin salida.
create unique index maintenance_attendance_one_open_idx on public.maintenance_attendance(staff_id) where check_out_at is null;
create index maintenance_attendance_staff_idx on public.maintenance_attendance(staff_id, check_in_at desc);
alter table public.maintenance_attendance enable row level security;
revoke all on public.maintenance_attendance from public, anon, authenticated;

-- Trabajador: marca su llegada (con la ruta de la foto ya subida por el servidor).
create or replace function public.maintenance_check_in(target_photo_path text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare me uuid; arrived timestamptz;
begin
  select id into me from public.maintenance_staff where user_id = auth.uid() and status = 'active' and role = 'worker';
  if me is null then raise exception 'not_authorized'; end if;
  if coalesce(trim(target_photo_path), '') = '' then raise exception 'photo_required'; end if;
  if exists(select 1 from public.maintenance_attendance where staff_id = me and check_out_at is null) then raise exception 'already_checked_in'; end if;
  insert into public.maintenance_attendance(staff_id, check_in_photo_path) values (me, target_photo_path) returning check_in_at into arrived;
  return arrived;
exception when unique_violation then raise exception 'already_checked_in';
end;
$$;

-- Trabajador: marca la salida de su jornada abierta.
create or replace function public.maintenance_check_out(target_photo_path text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare me uuid; left_at timestamptz;
begin
  select id into me from public.maintenance_staff where user_id = auth.uid() and status = 'active' and role = 'worker';
  if me is null then raise exception 'not_authorized'; end if;
  if coalesce(trim(target_photo_path), '') = '' then raise exception 'photo_required'; end if;
  update public.maintenance_attendance set check_out_at = now(), check_out_photo_path = target_photo_path
  where staff_id = me and check_out_at is null returning check_out_at into left_at;
  if left_at is null then raise exception 'not_checked_in'; end if;
  return left_at;
end;
$$;

-- Admin de mantenimiento: registra a mano la salida olvidada, con la hora y un motivo.
create or replace function public.maintenance_close_attendance(target_attendance_id uuid, target_check_out_at timestamptz, target_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.maintenance_attendance%rowtype;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  select * into item from public.maintenance_attendance where id = target_attendance_id for update;
  if not found or item.check_out_at is not null then raise exception 'not_open'; end if;
  if target_check_out_at is null or target_check_out_at <= item.check_in_at or target_check_out_at > now() then raise exception 'invalid_time'; end if;
  if char_length(trim(coalesce(target_reason, ''))) not between 3 and 300 then raise exception 'reason_required'; end if;
  update public.maintenance_attendance set check_out_at = target_check_out_at, check_out_manual = true,
    check_out_reason = trim(target_reason), closed_by = auth.uid() where id = item.id;
end;
$$;

-- Asistencia: el admin ve la de todos (filtrable por trabajador); el trabajador solo la suya.
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
    and (target_staff_id is null or a.staff_id = target_staff_id)
  order by a.check_in_at desc;
end;
$$;

revoke all on function public.maintenance_check_in(text), public.maintenance_check_out(text),
  public.maintenance_close_attendance(uuid, timestamptz, text), public.maintenance_list_attendance(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.maintenance_check_in(text), public.maintenance_check_out(text),
  public.maintenance_close_attendance(uuid, timestamptz, text), public.maintenance_list_attendance(timestamptz, timestamptz, uuid) to authenticated;

commit;

select
  exists(select 1 from pg_indexes where indexname = 'maintenance_attendance_one_open_idx') as una_jornada_abierta,
  not has_table_privilege('authenticated', 'public.maintenance_attendance', 'select') as asistencia_protegida,
  has_function_privilege('authenticated', 'public.maintenance_check_in(text)', 'execute')
    and not has_function_privilege('anon', 'public.maintenance_check_in(text)', 'execute') as marcar_disponible;
