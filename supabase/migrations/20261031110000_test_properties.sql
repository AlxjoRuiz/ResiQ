-- Pruebas ResiQ (31/10/2026, pedido de Alejandro): todo lo de prueba se separa de lo de producción.
-- * Conjuntos de prueba (con sus administradores, auxiliares, portería y residentes): salen solo en la
--   sección «Pruebas ResiQ» del superadmin y no en Inicio, Conjuntos, Usuarios, Equipos ni Métricas.
-- * Cuentas de prueba del personal de ResiQ (mantenimiento y jurídica), que no pertenecen a un conjunto:
--   se marcan por correo. Los correos @resiq.invalid cuentan como de prueba sin marcarlos.
-- Todo funciona igual que lo de producción: solo cambia dónde lo ve el superadmin.
begin;

alter table public.properties add column if not exists is_test boolean not null default false;

-- Marca inicial: Bosques, Mirador y Conjunto Carga de Prueba (la consulta final muestra cuáles quedaron).
update public.properties set is_test = true
where slug = 'carga-prueba-resiq' or name ilike '%bosque%' or name ilike '%mirador%';

create table public.platform_test_emails (
  email_normalized text primary key check (email_normalized = lower(trim(email_normalized)) and char_length(email_normalized) between 3 and 254),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.platform_test_emails enable row level security;
revoke all on public.platform_test_emails from public, anon, authenticated;

-- Superadmin: los conjuntos de prueba.
create or replace function public.platform_test_property_ids()
returns setof uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query select p.id from public.properties p where p.is_test;
end;
$$;

-- Superadmin: marcar o desmarcar un conjunto como de prueba. Queda en auditoría.
create or replace function public.platform_set_property_test(target_property_id uuid, target_is_test boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  if target_is_test is null then raise exception 'invalid_value'; end if;
  update public.properties set is_test = target_is_test where id = target_property_id;
  if not found then raise exception 'property_not_found'; end if;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (target_property_id, auth.uid(), 'property', case when target_is_test then 'platform.property_marked_test' else 'platform.property_marked_production' end,
    'property', target_property_id, jsonb_build_object('is_test', target_is_test));
end;
$$;

-- Superadmin: los correos marcados como de prueba.
create or replace function public.platform_list_test_emails()
returns setof text language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query select t.email_normalized from public.platform_test_emails t order by t.email_normalized;
end;
$$;

-- Superadmin: marcar o desmarcar un correo del personal de ResiQ como de prueba.
create or replace function public.platform_set_test_email(target_email text, target_is_test boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare normalized_email text := lower(trim(coalesce(target_email, '')));
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  if char_length(normalized_email) > 254 or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  if target_is_test then
    insert into public.platform_test_emails(email_normalized, created_by) values (normalized_email, auth.uid()) on conflict do nothing;
  else
    delete from public.platform_test_emails where email_normalized = normalized_email;
  end if;
end;
$$;

revoke all on function public.platform_test_property_ids(), public.platform_set_property_test(uuid, boolean),
  public.platform_list_test_emails(), public.platform_set_test_email(text, boolean) from public, anon;
grant execute on function public.platform_test_property_ids(), public.platform_set_property_test(uuid, boolean),
  public.platform_list_test_emails(), public.platform_set_test_email(text, boolean) to authenticated;

commit;

-- Debe mostrar Bosques, Mirador y Conjunto Carga de Prueba, con correos_protegidos = true. Si sale otro
-- conjunto, desmárcalo desde su ficha.
select name as conjunto_de_prueba, status,
  not has_table_privilege('authenticated', 'public.platform_test_emails', 'select') as correos_protegidos
from public.properties where is_test order by name;
