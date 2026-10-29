-- Módulo de mantenimiento, entrega 2: trabajadores (28/10/2026). El admin de mantenimiento los
-- registra con los mismos datos del portero y les asigna usuario permanente y contraseña. La cuenta
-- se crea desde el servidor de la app (clave de servicio); esta ficha solo se lee con la función de
-- abajo, y solo la ve el admin de mantenimiento.
begin;

create table public.maintenance_worker_records (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null unique references public.maintenance_staff(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  username text not null check (username ~ '^[a-z0-9]+$'),
  first_name text not null check (char_length(trim(first_name)) between 1 and 60),
  first_surname text not null check (char_length(trim(first_surname)) between 1 and 60),
  document_number text not null check (document_number ~ '^[0-9]{5,20}$'),
  birth_date date not null,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email_normalized text not null check (email_normalized = lower(trim(email_normalized))),
  address text check (address is null or char_length(address) <= 180),
  vehicles jsonb not null default '[]'::jsonb check (jsonb_typeof(vehicles) = 'array' and jsonb_array_length(vehicles) <= 1),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
-- El usuario no se repite ni se reutiliza (ni siquiera de trabajadores eliminados).
create unique index maintenance_worker_records_username_idx on public.maintenance_worker_records(username);
alter table public.maintenance_worker_records enable row level security;
revoke all on public.maintenance_worker_records from public, anon, authenticated;

-- Admin de mantenimiento: sus trabajadores con ficha y estado (sin los eliminados).
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
  where r.removed_at is null and s.role = 'worker'
  order by r.first_name, r.first_surname;
end;
$$;
revoke all on function public.maintenance_list_workers() from public, anon;
grant execute on function public.maintenance_list_workers() to authenticated;

commit;

select
  not has_table_privilege('authenticated', 'public.maintenance_worker_records', 'select') as ficha_protegida,
  has_function_privilege('authenticated', 'public.maintenance_list_workers()', 'execute')
    and not has_function_privilege('anon', 'public.maintenance_list_workers()', 'execute') as lista_trabajadores;
