-- Superadmin: crear un conjunto y la invitación de su administrador inicial (26/10/2026).
-- Solo una cuenta activa en platform_admins. El conjunto nace activo y vacío; el administrador
-- entra con el enlace de invitación (7 días) usando el correo indicado. El código del enlace no se
-- guarda: solo su hash. No envía correo (modo de prueba); el superadmin comparte el enlace.
begin;

alter table public.invitations drop constraint invitations_roles_check;
alter table public.invitations add constraint invitations_roles_check check (
  cardinality(roles) > 0 and roles <@ array['administrator','concierge','member']::text[] and private.text_array_is_unique(roles)
);

create or replace function public.platform_create_property(
  target_name text, target_address text, target_city text, target_admin_email text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  clean_name text := trim(coalesce(target_name, ''));
  clean_address text := nullif(trim(coalesce(target_address, '')), '');
  clean_city text := nullif(trim(coalesce(target_city, '')), '');
  normalized_email text := lower(trim(coalesce(target_admin_email, '')));
  base_slug text;
  new_property_id uuid;
  new_invitation_id uuid;
  raw_token text;
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  if char_length(clean_name) not between 2 and 120 then raise exception 'invalid_name'; end if;
  if clean_address is not null and char_length(clean_address) > 180 then raise exception 'invalid_address'; end if;
  if clean_city is not null and char_length(clean_city) > 80 then raise exception 'invalid_city'; end if;
  if char_length(normalized_email) > 254 or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;

  -- Identificador interno a partir del nombre, con un sufijo aleatorio para que no se repita.
  base_slug := trim(both '-' from regexp_replace(lower(translate(clean_name, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'conjunto'; end if;
  insert into public.properties(name, slug, address, city, created_by)
  values (clean_name, left(base_slug, 60) || '-' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6), clean_address, clean_city, auth.uid())
  returning id into new_property_id;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invitations(property_id, email_normalized, token_hash, roles, expires_at, invited_by, link_issued_at)
  values (new_property_id, normalized_email, encode(extensions.digest(raw_token, 'sha256'), 'hex'),
          array['administrator']::text[], now() + interval '7 days', auth.uid(), now())
  returning id into new_invitation_id;

  perform private.write_property_audit(new_property_id, 'platform.property_created', 'property', new_property_id, '{}'::jsonb);
  perform private.write_property_audit(new_property_id, 'invitation.admin_created', 'invitation', new_invitation_id, '{}'::jsonb);
  return jsonb_build_object('property_id', new_property_id, 'token', raw_token);
end;
$$;
revoke all on function public.platform_create_property(text,text,text,text) from public, anon;
grant execute on function public.platform_create_property(text,text,text,text) to authenticated;

commit;

select
  pg_get_constraintdef((select oid from pg_constraint where conname = 'invitations_roles_check')) like '%administrator%' as invitacion_admin_permitida,
  has_function_privilege('authenticated', 'public.platform_create_property(text,text,text,text)', 'execute')
    and not has_function_privilege('anon', 'public.platform_create_property(text,text,text,text)', 'execute') as crear_conjunto_disponible;
