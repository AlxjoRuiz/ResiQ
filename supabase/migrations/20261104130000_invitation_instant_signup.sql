-- Registro con invitación al instante (04/11/2026, pedido de Alejandro): al crear la cuenta con nombre y
-- contraseña desde el enlace de invitación, la cuenta queda confirmada y la invitación aceptada en el mismo
-- paso, sin ir al correo. Solo con el correo al que se envió la invitación.
-- Esta función la usa solo el servidor (service_role): dado el código del enlace, devuelve el correo invitado
-- (si la invitación sigue pendiente y vigente, de un conjunto, de mantenimiento o de jurídica) y, si ese correo
-- ya tiene cuenta, si está confirmada (para completar cuentas que se registraron y nunca confirmaron).
begin;

create or replace function public.invitation_signup_target(invitation_token text)
returns table(email text, user_id uuid, confirmed boolean) language plpgsql stable security definer set search_path = '' as $$
declare hashed text := encode(extensions.digest(coalesce(invitation_token, ''), 'sha256'), 'hex'); invited text;
begin
  select i.email_normalized into invited from public.invitations i where i.token_hash = hashed and i.status = 'pending' and i.expires_at > now();
  if invited is null then
    select i.email_normalized into invited from public.maintenance_invitations i where i.token_hash = hashed and i.status = 'pending' and i.expires_at > now();
  end if;
  if invited is null then
    select i.email_normalized into invited from public.legal_invitations i where i.token_hash = hashed and i.status = 'pending' and i.expires_at > now();
  end if;
  if invited is null then return; end if;
  return query select invited, u.id, u.email_confirmed_at is not null
    from (select 1) one left join auth.users u on lower(u.email::text) = invited;
end;
$$;
revoke all on function public.invitation_signup_target(text) from public, anon, authenticated;
grant execute on function public.invitation_signup_target(text) to service_role;

commit;

-- Debe dar true.
select has_function_privilege('service_role', 'public.invitation_signup_target(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.invitation_signup_target(text)', 'execute')
  and not has_function_privilege('anon', 'public.invitation_signup_target(text)', 'execute') as registro_al_instante;
