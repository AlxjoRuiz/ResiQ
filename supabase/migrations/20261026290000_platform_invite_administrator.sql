-- Superadmin: invitar otro administrador a un conjunto existente y generar de nuevo el enlace de una
-- invitación de administración (26/10/2026). El código del enlace no se guarda, solo su hash; cada
-- enlace nuevo vale 7 días e invalida el anterior. El conjunto debe estar activo.
begin;

create or replace function public.platform_invite_administrator(target_property_id uuid, target_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(trim(coalesce(target_email, '')));
  property_status text;
  raw_token text;
  new_invitation_id uuid;
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  if char_length(normalized_email) > 254 or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  select status into property_status from public.properties where id = target_property_id;
  if not found then raise exception 'invalid_property'; end if;
  if property_status <> 'active' then raise exception 'property_inactive'; end if;
  -- Una cuenta con cualquier rol vigente en el conjunto no puede aceptar otra invitación allí.
  if exists (select 1 from public.property_members pm join auth.users au on au.id = pm.user_id
             where pm.property_id = target_property_id and lower(au.email) = normalized_email and pm.status = 'active') then
    raise exception 'already_member';
  end if;
  update public.invitations set status = 'revoked', updated_at = now()
  where property_id = target_property_id and email_normalized = normalized_email and status = 'pending' and 'administrator' = any(roles);
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invitations(property_id, email_normalized, token_hash, roles, expires_at, invited_by, link_issued_at)
  values (target_property_id, normalized_email, encode(extensions.digest(raw_token, 'sha256'), 'hex'),
          array['administrator']::text[], now() + interval '7 days', auth.uid(), now())
  returning id into new_invitation_id;
  perform private.write_property_audit(target_property_id, 'invitation.admin_created', 'invitation', new_invitation_id, '{}'::jsonb);
  return raw_token;
end;
$$;

create or replace function public.platform_reissue_admin_invitation(target_invitation_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare inv public.invitations%rowtype; raw_token text;
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  select * into inv from public.invitations where id = target_invitation_id for update;
  if not found or inv.status <> 'pending' or not ('administrator' = any(inv.roles)) then raise exception 'invitation_not_found'; end if;
  if not exists (select 1 from public.properties where id = inv.property_id and status = 'active') then raise exception 'property_inactive'; end if;
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.invitations set token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    expires_at = now() + interval '7 days', link_issued_at = now(), updated_at = now()
  where id = inv.id;
  perform private.write_property_audit(inv.property_id, 'invitation.link_revealed', 'invitation', inv.id, '{}'::jsonb);
  return raw_token;
end;
$$;

-- La lista ahora incluye el id de la invitación y las vencidas (para generar un enlace nuevo).
drop function public.platform_list_administrators();
create function public.platform_list_administrators()
returns table(property_id uuid, property_name text, property_status text, display_name text, email text, member_status text, since timestamptz, invitation_id uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query
  select p.id, p.name, p.status, pr.display_name, au.email::text, pm.status, pm.joined_at, null::uuid
  from public.property_members pm
  join public.properties p on p.id = pm.property_id
  join public.profiles pr on pr.id = pm.user_id
  join auth.users au on au.id = pm.user_id
  where 'administrator' = any(pm.roles)
  union all
  select p.id, p.name, p.status, null::text, i.email_normalized, case when i.expires_at > now() then 'invited' else 'expired' end, i.created_at, i.id
  from public.invitations i
  join public.properties p on p.id = i.property_id
  where i.status = 'pending' and 'administrator' = any(i.roles)
  order by 2, 7;
end;
$$;

revoke all on function public.platform_invite_administrator(uuid,text), public.platform_reissue_admin_invitation(uuid), public.platform_list_administrators() from public, anon;
grant execute on function public.platform_invite_administrator(uuid,text), public.platform_reissue_admin_invitation(uuid), public.platform_list_administrators() to authenticated;

commit;

select
  has_function_privilege('authenticated', 'public.platform_invite_administrator(uuid,text)', 'execute')
    and not has_function_privilege('anon', 'public.platform_invite_administrator(uuid,text)', 'execute') as invitar_admin_disponible,
  has_function_privilege('authenticated', 'public.platform_reissue_admin_invitation(uuid)', 'execute') as nuevo_enlace_disponible,
  exists(select 1 from information_schema.parameters where specific_schema = 'public'
    and specific_name like 'platform_list_administrators%' and parameter_name = 'invitation_id') as lista_con_invitaciones;
