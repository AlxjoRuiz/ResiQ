-- Módulo de mantenimiento, entrega 4: tareas (28/10/2026).
-- * El admin de mantenimiento crea una tarea (título, descripción, nombre del conjunto escrito a mano y
--   fecha límite) y elige uno o varios trabajadores: cada uno recibe su propia copia (batch_id las une).
-- * El trabajador la entrega con 1 a 5 fotos y una nota opcional. El admin la aprueba o la rechaza con
--   comentario; si la rechaza, el trabajador puede volver a entregarla. Cada entrega queda en el historial.
-- * «Vencida» no se guarda: se calcula (pendiente o rechazada con la fecha límite ya pasada, hora Bogotá).
-- Las fotos van en el almacenamiento privado (las sube el servidor de la app); aquí solo sus rutas.
begin;

create table public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  staff_id uuid not null references public.maintenance_staff(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 3 and 120),
  description text not null check (char_length(trim(description)) between 3 and 2000),
  property_name text not null check (char_length(trim(property_name)) between 2 and 120),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'approved', 'rejected')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index maintenance_tasks_staff_idx on public.maintenance_tasks(staff_id, status, due_date);
create index maintenance_tasks_created_idx on public.maintenance_tasks(created_at desc);

create table public.maintenance_task_deliveries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.maintenance_tasks(id) on delete cascade,
  note text check (note is null or char_length(note) <= 1000),
  photo_paths text[] not null check (cardinality(photo_paths) between 1 and 5),
  submitted_at timestamptz not null default now(),
  review text check (review in ('approved', 'rejected')),
  review_comment text check (review_comment is null or char_length(review_comment) <= 1000),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  check ((review is null) = (reviewed_at is null)),
  -- Rechazar exige explicar qué falta.
  check (review is distinct from 'rejected' or char_length(trim(coalesce(review_comment, ''))) >= 3)
);
create index maintenance_task_deliveries_task_idx on public.maintenance_task_deliveries(task_id, submitted_at desc);

alter table public.maintenance_tasks enable row level security;
alter table public.maintenance_task_deliveries enable row level security;
revoke all on public.maintenance_tasks, public.maintenance_task_deliveries from public, anon, authenticated;

-- Admin: crea la tarea y una copia por cada trabajador activo elegido. Devuelve cuántas copias creó.
create or replace function public.maintenance_create_task(target_title text, target_description text, target_property_name text,
  target_due_date date, target_staff_ids uuid[])
returns integer language plpgsql security definer set search_path = '' as $$
declare requested integer; valid integer; created integer;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  if target_due_date is null or target_due_date < (now() at time zone 'America/Bogota')::date then raise exception 'invalid_due_date'; end if;
  select count(distinct worker) into requested from unnest(coalesce(target_staff_ids, '{}'::uuid[])) worker;
  if requested = 0 then raise exception 'workers_required'; end if;
  select count(*) into valid from public.maintenance_staff where id = any(target_staff_ids) and role = 'worker' and status = 'active';
  if valid <> requested then raise exception 'invalid_worker'; end if;
  insert into public.maintenance_tasks(batch_id, staff_id, title, description, property_name, due_date, created_by)
  select batch.id, worker, trim(target_title), trim(target_description), trim(target_property_name), target_due_date, auth.uid()
  from (select distinct unnest(target_staff_ids) worker) workers, (select gen_random_uuid() id) batch;
  get diagnostics created = row_count;
  return created;
exception when check_violation then raise exception 'invalid_data';
end;
$$;

-- Trabajador: entrega su tarea (pendiente o rechazada) con las rutas de las fotos ya subidas.
create or replace function public.maintenance_submit_task(target_task_id uuid, target_note text, target_photo_paths text[])
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid; item public.maintenance_tasks%rowtype;
begin
  select id into me from public.maintenance_staff where user_id = auth.uid() and status = 'active' and role = 'worker';
  if me is null then raise exception 'not_authorized'; end if;
  select * into item from public.maintenance_tasks where id = target_task_id and staff_id = me for update;
  if not found then raise exception 'not_found'; end if;
  if item.status not in ('pending', 'rejected') then raise exception 'not_open'; end if;
  if coalesce(cardinality(target_photo_paths), 0) not between 1 and 5 then raise exception 'photo_required'; end if;
  -- Las fotos deben estar en la carpeta de este trabajador y de esta tarea.
  if exists(select 1 from unnest(target_photo_paths) path where path not like 'maintenance/tasks/' || me::text || '/' || item.id::text || '/%') then
    raise exception 'invalid_photo';
  end if;
  insert into public.maintenance_task_deliveries(task_id, note, photo_paths) values (item.id, nullif(trim(target_note), ''), target_photo_paths);
  update public.maintenance_tasks set status = 'submitted', updated_at = now() where id = item.id;
end;
$$;

-- Admin: aprueba o rechaza la última entrega. Rechazar exige comentario.
create or replace function public.maintenance_review_task(target_task_id uuid, target_approve boolean, target_comment text)
returns void language plpgsql security definer set search_path = '' as $$
declare item public.maintenance_tasks%rowtype;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  select * into item from public.maintenance_tasks where id = target_task_id for update;
  if not found or item.status <> 'submitted' then raise exception 'not_submitted'; end if;
  if not coalesce(target_approve, false) and char_length(trim(coalesce(target_comment, ''))) < 3 then raise exception 'comment_required'; end if;
  update public.maintenance_task_deliveries set review = case when target_approve then 'approved' else 'rejected' end,
    review_comment = nullif(trim(target_comment), ''), reviewed_at = now(), reviewed_by = auth.uid()
  where id = (select id from public.maintenance_task_deliveries where task_id = item.id and review is null order by submitted_at desc limit 1);
  update public.maintenance_tasks set status = case when target_approve then 'approved' else 'rejected' end, updated_at = now() where id = item.id;
end;
$$;

-- Admin: elimina una tarea creada por error, solo si el trabajador aún no la ha entregado nunca.
create or replace function public.maintenance_delete_task(target_task_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  delete from public.maintenance_tasks t where t.id = target_task_id and t.status = 'pending'
    and not exists(select 1 from public.maintenance_task_deliveries d where d.task_id = t.id);
  if not found then raise exception 'cannot_delete'; end if;
end;
$$;

-- Tareas: el admin ve las de todos; el trabajador solo las suyas. Las aprobadas hace más de 90 días no
-- se listan aquí (quedan para el informe). Filtro de estado: pending, submitted, approved, rejected u overdue.
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
    and (target_staff_id is null or t.staff_id = target_staff_id)
    and (target_status is null
      or (target_status = 'overdue' and t.status in ('pending', 'rejected') and t.due_date < today)
      or t.status = target_status)
    and (t.status <> 'approved' or t.updated_at > now() - interval '90 days')
  order by case t.status when 'submitted' then 0 when 'rejected' then 1 when 'pending' then 2 else 3 end, t.due_date, t.created_at desc
  limit 300;
end;
$$;

revoke all on function public.maintenance_create_task(text, text, text, date, uuid[]), public.maintenance_submit_task(uuid, text, text[]),
  public.maintenance_review_task(uuid, boolean, text), public.maintenance_delete_task(uuid), public.maintenance_list_tasks(uuid, text) from public, anon;
grant execute on function public.maintenance_create_task(text, text, text, date, uuid[]), public.maintenance_submit_task(uuid, text, text[]),
  public.maintenance_review_task(uuid, boolean, text), public.maintenance_delete_task(uuid), public.maintenance_list_tasks(uuid, text) to authenticated;

commit;

select
  not has_table_privilege('authenticated', 'public.maintenance_tasks', 'select')
    and not has_table_privilege('authenticated', 'public.maintenance_task_deliveries', 'select') as tareas_protegidas,
  has_function_privilege('authenticated', 'public.maintenance_list_tasks(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.maintenance_list_tasks(uuid, text)', 'execute') as listar_disponible,
  has_function_privilege('authenticated', 'public.maintenance_submit_task(uuid, text, text[])', 'execute') as entregar_disponible;
