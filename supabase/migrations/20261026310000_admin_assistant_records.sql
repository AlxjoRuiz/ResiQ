-- Auxiliares de administración: el admin registra los mismos datos que de un portero (nombres,
-- apellidos, cédula, nacimiento, teléfono, correo, dirección y vehículo) y el auxiliar sigue
-- entrando con el enlace a su correo (decisión de Alejandro, 26/10/2026). La ficha solo se lee
-- con get_admin_assistants (administración del conjunto); no hay lectura directa.
begin;

create table public.admin_assistant_records (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  invitation_id uuid not null unique references public.invitations(id) on delete restrict,
  member_id uuid references public.property_members(id) on delete restrict,
  first_name text not null check (char_length(trim(first_name)) between 1 and 60),
  first_surname text not null check (char_length(trim(first_surname)) between 1 and 60),
  document_number text not null check (document_number ~ '^[0-9]{5,20}$'),
  birth_date date not null,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email_normalized text not null check (email_normalized = lower(trim(email_normalized))),
  address text check (address is null or char_length(address) <= 180),
  vehicles jsonb not null default '[]'::jsonb check (jsonb_typeof(vehicles) = 'array' and jsonb_array_length(vehicles) <= 1),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index admin_assistant_records_property_idx on public.admin_assistant_records(property_id, created_at desc);
alter table public.admin_assistant_records enable row level security;
revoke all on public.admin_assistant_records from public, anon, authenticated;
create trigger require_active_property_write before insert or update or delete on public.admin_assistant_records
for each row execute function private.require_active_property_write();

-- Al aceptar: la membresía queda marcada como auxiliar y la ficha se vincula a ella.
create or replace function private.mark_admin_assistant()
returns trigger language plpgsql security definer set search_path = '' as $$
declare accepted_member uuid;
begin
  if new.is_admin_assistant and new.status = 'accepted' and old.status is distinct from 'accepted' then
    update public.property_members set is_admin_assistant = true
    where property_id = new.property_id and user_id = new.accepted_by returning id into accepted_member;
    update public.admin_assistant_records set member_id = accepted_member where invitation_id = new.id;
  end if;
  return new;
end;
$$;

drop function public.invite_admin_assistant(uuid, text);
create function public.invite_admin_assistant(
  target_property_id uuid, target_email text, target_first_name text, target_first_surname text, target_document text,
  target_birth_date date, target_phone text, target_address text, target_vehicles jsonb
) returns text language plpgsql security definer set search_path = '' as $$
declare normalized_email text := lower(trim(coalesce(target_email, ''))); raw_token text; new_invitation_id uuid;
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if char_length(normalized_email) > 254 or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  if target_birth_date is null or target_birth_date > (now() at time zone 'America/Bogota')::date - interval '18 years' then raise exception 'invalid_birth_date'; end if;
  if exists (select 1 from public.property_members pm join auth.users au on au.id = pm.user_id
             where pm.property_id = target_property_id and lower(au.email) = normalized_email and pm.status <> 'revoked') then
    raise exception 'already_member';
  end if;
  update public.invitations set status = 'revoked', updated_at = now()
  where property_id = target_property_id and email_normalized = normalized_email and status = 'pending' and 'administrator' = any(roles);
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invitations(property_id, email_normalized, token_hash, roles, expires_at, invited_by, link_issued_at, is_admin_assistant)
  values (target_property_id, normalized_email, encode(extensions.digest(raw_token, 'sha256'), 'hex'),
          array['administrator']::text[], now() + interval '7 days', auth.uid(), now(), true)
  returning id into new_invitation_id;
  insert into public.admin_assistant_records(property_id, invitation_id, first_name, first_surname, document_number, birth_date,
    phone_e164, email_normalized, address, vehicles, created_by)
  values (target_property_id, new_invitation_id, trim(target_first_name), trim(target_first_surname), trim(target_document), target_birth_date,
    target_phone, normalized_email, nullif(trim(coalesce(target_address, '')), ''), coalesce(target_vehicles, '[]'::jsonb), auth.uid());
  perform private.write_property_audit(target_property_id, 'invitation.admin_assistant_created', 'invitation', new_invitation_id, '{}'::jsonb);
  return raw_token;
end;
$$;

drop function public.get_admin_assistants(uuid);
create function public.get_admin_assistants(target_property_id uuid)
returns table(member_id uuid, invitation_id uuid, display_name text, email text, assistant_status text, since timestamptz,
  full_name text, document_number text, birth_date date, phone_e164 text, address text, vehicles jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  return query
  select pm.id, null::uuid, pr.display_name, au.email::text, pm.status, pm.joined_at,
    r.first_name || ' ' || r.first_surname, r.document_number, r.birth_date, r.phone_e164, r.address, r.vehicles
  from public.property_members pm join public.profiles pr on pr.id = pm.user_id join auth.users au on au.id = pm.user_id
  left join public.admin_assistant_records r on r.member_id = pm.id
  where pm.property_id = target_property_id and pm.is_admin_assistant and pm.status <> 'revoked'
  union all
  select null::uuid, i.id, null::text, i.email_normalized, case when i.expires_at > now() then 'invited' else 'expired' end, i.created_at,
    r.first_name || ' ' || r.first_surname, r.document_number, r.birth_date, r.phone_e164, r.address, r.vehicles
  from public.invitations i left join public.admin_assistant_records r on r.invitation_id = i.id
  where i.property_id = target_property_id and i.is_admin_assistant and i.status = 'pending'
  order by 6 desc;
end;
$$;

revoke all on function public.invite_admin_assistant(uuid,text,text,text,text,date,text,text,jsonb), public.get_admin_assistants(uuid) from public, anon;
grant execute on function public.invite_admin_assistant(uuid,text,text,text,text,date,text,text,jsonb), public.get_admin_assistants(uuid) to authenticated;

commit;

select
  not has_table_privilege('authenticated', 'public.admin_assistant_records', 'select') as ficha_protegida,
  has_function_privilege('authenticated', 'public.invite_admin_assistant(uuid,text,text,text,text,date,text,text,jsonb)', 'execute') as invitar_con_datos,
  exists(select 1 from information_schema.parameters where specific_schema = 'public'
    and specific_name like 'get_admin_assistants%' and parameter_name = 'document_number') as lista_con_datos;
