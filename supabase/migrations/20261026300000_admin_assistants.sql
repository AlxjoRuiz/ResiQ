-- Auxiliares de administración (decisión de Alejandro, 26/10/2026). El admin del conjunto invita por
-- correo a un auxiliar con los mismos permisos de administración (rol administrator). Se marcan con
-- is_admin_assistant para que la sección de auxiliares solo gestione auxiliares: nadie puede
-- suspender desde ahí al administrador principal (el que invita el superadmin).
begin;

alter table public.invitations add column is_admin_assistant boolean not null default false;
alter table public.property_members add column is_admin_assistant boolean not null default false;

-- Al aceptar una invitación de auxiliar, la membresía queda marcada (accept_invitation no cambia).
create or replace function private.mark_admin_assistant()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_admin_assistant and new.status = 'accepted' and old.status is distinct from 'accepted' then
    update public.property_members set is_admin_assistant = true
    where property_id = new.property_id and user_id = new.accepted_by;
  end if;
  return new;
end;
$$;
revoke all on function private.mark_admin_assistant() from public, anon, authenticated;
create trigger invitations_mark_admin_assistant after update of status on public.invitations
for each row execute function private.mark_admin_assistant();

create or replace function public.invite_admin_assistant(target_property_id uuid, target_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare normalized_email text := lower(trim(coalesce(target_email, ''))); raw_token text; new_invitation_id uuid;
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if char_length(normalized_email) > 254 or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  -- Una cuenta ya vinculada al conjunto (en cualquier estado) no puede aceptar otra invitación allí.
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
  perform private.write_property_audit(target_property_id, 'invitation.admin_assistant_created', 'invitation', new_invitation_id, '{}'::jsonb);
  return raw_token;
end;
$$;

-- Enlace nuevo (7 días) o cancelar una invitación de auxiliar pendiente.
create or replace function public.manage_admin_assistant_invitation(target_property_id uuid, target_invitation_id uuid, target_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare inv public.invitations%rowtype; raw_token text;
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  select * into inv from public.invitations where id = target_invitation_id and property_id = target_property_id for update;
  if not found or inv.status <> 'pending' or not inv.is_admin_assistant then raise exception 'invitation_not_found'; end if;
  if target_action = 'cancel' then
    update public.invitations set status = 'revoked', updated_at = now() where id = inv.id;
    perform private.write_property_audit(target_property_id, 'invitation.admin_assistant_cancelled', 'invitation', inv.id, '{}'::jsonb);
    return null;
  elsif target_action = 'reissue' then
    raw_token := encode(extensions.gen_random_bytes(32), 'hex');
    update public.invitations set token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex'),
      expires_at = now() + interval '7 days', link_issued_at = now(), updated_at = now() where id = inv.id;
    perform private.write_property_audit(target_property_id, 'invitation.link_revealed', 'invitation', inv.id, '{}'::jsonb);
    return raw_token;
  end if;
  raise exception 'invalid_action';
end;
$$;

-- Suspender o reactivar a un auxiliar. Solo auxiliares y nunca la propia cuenta.
create or replace function public.set_admin_assistant_status(target_property_id uuid, target_member_id uuid, target_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare member public.property_members%rowtype;
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if target_status not in ('active','suspended') then raise exception 'invalid_status'; end if;
  select * into member from public.property_members where id = target_member_id and property_id = target_property_id for update;
  if not found or not member.is_admin_assistant or member.status = 'revoked' then raise exception 'assistant_not_found'; end if;
  if member.user_id = auth.uid() then raise exception 'cannot_change_self'; end if;
  update public.property_members set status = target_status where id = member.id;
  perform private.write_property_audit(target_property_id, 'member.admin_assistant_status', 'property_member', member.id,
    jsonb_build_object('previous_status', member.status, 'status', target_status));
end;
$$;

-- Auxiliares del conjunto e invitaciones de auxiliar pendientes, solo para administración.
create or replace function public.get_admin_assistants(target_property_id uuid)
returns table(member_id uuid, invitation_id uuid, display_name text, email text, assistant_status text, since timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  return query
  select pm.id, null::uuid, pr.display_name, au.email::text, pm.status, pm.joined_at
  from public.property_members pm join public.profiles pr on pr.id = pm.user_id join auth.users au on au.id = pm.user_id
  where pm.property_id = target_property_id and pm.is_admin_assistant and pm.status <> 'revoked'
  union all
  select null::uuid, i.id, null::text, i.email_normalized, case when i.expires_at > now() then 'invited' else 'expired' end, i.created_at
  from public.invitations i
  where i.property_id = target_property_id and i.is_admin_assistant and i.status = 'pending'
  order by 6 desc;
end;
$$;

revoke all on function public.invite_admin_assistant(uuid,text), public.manage_admin_assistant_invitation(uuid,uuid,text),
  public.set_admin_assistant_status(uuid,uuid,text), public.get_admin_assistants(uuid) from public, anon;
grant execute on function public.invite_admin_assistant(uuid,text), public.manage_admin_assistant_invitation(uuid,uuid,text),
  public.set_admin_assistant_status(uuid,uuid,text), public.get_admin_assistants(uuid) to authenticated;

commit;

select
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'property_members' and column_name = 'is_admin_assistant') as marca_auxiliar,
  exists(select 1 from pg_trigger where tgname = 'invitations_mark_admin_assistant') as marca_al_aceptar,
  has_function_privilege('authenticated', 'public.invite_admin_assistant(uuid,text)', 'execute')
    and not has_function_privilege('anon', 'public.invite_admin_assistant(uuid,text)', 'execute') as invitar_auxiliar_disponible,
  has_function_privilege('authenticated', 'public.get_admin_assistants(uuid)', 'execute') as lista_auxiliares;
