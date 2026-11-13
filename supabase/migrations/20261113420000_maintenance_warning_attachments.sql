-- Documentos en los llamados de atención (13/11/2026, pedido de Alejandro). El admin de mantenimiento puede adjuntar
-- documentos (PDF, JPG o PNG; hasta 5 y 4 MB en total por envío) al crear o editar un llamado, y quitarlos. El trabajador
-- los ve y los descarga en sus llamados (solo lectura). Los archivos quedan en el almacenamiento privado
-- (private-documents/maintenance/warnings/…) y se abren con un enlace temporal.
begin;

create table if not exists public.maintenance_warning_attachments (
  id uuid primary key default gen_random_uuid(),
  warning_id uuid not null references public.maintenance_warnings(id) on delete cascade,
  object_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  created_at timestamptz not null default now()
);
create index if not exists maintenance_warning_attachments_warning_idx on public.maintenance_warning_attachments(warning_id);
alter table public.maintenance_warning_attachments enable row level security;
revoke all on public.maintenance_warning_attachments from public, anon, authenticated;

-- Quién puede ver un llamado: el admin de su lado o el trabajador dueño.
create or replace function private.maintenance_can_see_warning(target_warning_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.maintenance_warnings w join public.maintenance_staff s on s.id = w.staff_id
    where w.id = target_warning_id
      and ((private.is_maintenance_staff('admin') and private.maintenance_same_side(w.staff_id)) or (s.user_id = auth.uid() and s.status = 'active'))
  );
$$;
revoke all on function private.maintenance_can_see_warning(uuid) from public, anon, authenticated;

-- Admin: agrega documentos ya subidos a un llamado de su lado. attachments = [{path, name, type, size}].
create or replace function public.maintenance_add_warning_attachments(target_warning_id uuid, target_attachments jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare item jsonb; added integer := 0; staff uuid;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  select w.staff_id into staff from public.maintenance_warnings w where w.id = target_warning_id;
  if staff is null or not private.maintenance_same_side(staff) then raise exception 'warning_not_found'; end if;
  if jsonb_typeof(coalesce(target_attachments, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(target_attachments, '[]'::jsonb)) > 5 then raise exception 'invalid_attachments'; end if;
  if (select count(*) from public.maintenance_warning_attachments a where a.warning_id = target_warning_id) + jsonb_array_length(coalesce(target_attachments, '[]'::jsonb)) > 10 then raise exception 'too_many_attachments'; end if;
  for item in select value from jsonb_array_elements(coalesce(target_attachments, '[]'::jsonb)) loop
    if coalesce(item ->> 'path', '') !~ ('^maintenance/warnings/' || target_warning_id::text || '/') then raise exception 'invalid_attachments'; end if;
    insert into public.maintenance_warning_attachments(warning_id, object_path, original_name, mime_type, size_bytes)
    values (target_warning_id, item ->> 'path', left(item ->> 'name', 180), item ->> 'type', (item ->> 'size')::bigint);
    added := added + 1;
  end loop;
  return added;
end;
$$;

-- Admin: quita un documento; devuelve su ruta para borrar el archivo.
create or replace function public.maintenance_remove_warning_attachment(target_attachment_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare attachment public.maintenance_warning_attachments%rowtype; staff uuid;
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  select * into attachment from public.maintenance_warning_attachments where id = target_attachment_id;
  if not found then raise exception 'attachment_not_found'; end if;
  select w.staff_id into staff from public.maintenance_warnings w where w.id = attachment.warning_id;
  if not private.maintenance_same_side(staff) then raise exception 'attachment_not_found'; end if;
  delete from public.maintenance_warning_attachments where id = attachment.id;
  return attachment.object_path;
end;
$$;

-- Documentos de los llamados que la persona puede ver (para la lista).
create or replace function public.maintenance_list_warning_attachments()
returns table(attachment_id uuid, warning_id uuid, original_name text, mime_type text, size_bytes bigint)
language sql stable security definer set search_path = '' as $$
  select a.id, a.warning_id, a.original_name, a.mime_type, a.size_bytes from public.maintenance_warning_attachments a
  where private.maintenance_can_see_warning(a.warning_id) order by a.created_at;
$$;

-- Para descargar un documento (ruta y nombre), si la persona puede ver su llamado.
create or replace function public.maintenance_warning_attachment_file(target_attachment_id uuid)
returns table(object_path text, original_name text)
language sql stable security definer set search_path = '' as $$
  select a.object_path, a.original_name from public.maintenance_warning_attachments a
  where a.id = target_attachment_id and private.maintenance_can_see_warning(a.warning_id);
$$;

-- Borrar un llamado ahora devuelve las rutas de sus documentos para borrar también los archivos.
drop function if exists public.maintenance_delete_warning(uuid);
create function public.maintenance_delete_warning(target_warning_id uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare warning public.maintenance_warnings%rowtype; paths text[];
begin
  if auth.uid() is null or not private.is_maintenance_staff('admin') then raise exception 'not_authorized'; end if;
  select * into warning from public.maintenance_warnings where id = target_warning_id for update;
  if not found or not private.maintenance_same_side(warning.staff_id) then raise exception 'warning_not_found'; end if;
  select coalesce(array_agg(a.object_path), '{}') into paths from public.maintenance_warning_attachments a where a.warning_id = warning.id;
  delete from public.maintenance_warnings where id = warning.id;
  return paths;
end;
$$;

revoke all on function public.maintenance_add_warning_attachments(uuid, jsonb), public.maintenance_remove_warning_attachment(uuid),
  public.maintenance_list_warning_attachments(), public.maintenance_warning_attachment_file(uuid), public.maintenance_delete_warning(uuid) from public, anon;
grant execute on function public.maintenance_add_warning_attachments(uuid, jsonb), public.maintenance_remove_warning_attachment(uuid),
  public.maintenance_list_warning_attachments(), public.maintenance_warning_attachment_file(uuid), public.maintenance_delete_warning(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Debe dar true.
select exists(select 1 from pg_tables where schemaname = 'public' and tablename = 'maintenance_warning_attachments') as documentos_en_llamados;
