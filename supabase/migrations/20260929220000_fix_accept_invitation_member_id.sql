-- Evita la ambigüedad entre la variable PL/pgSQL y la columna member_id.
create or replace function public.accept_invitation(invitation_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invitations%rowtype;
  created_member_id uuid;
  actor_email text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  actor_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select *
  into inv
  from public.invitations
  where token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex')
    and status = 'pending'
  for update;

  if not found or inv.expires_at <= now() then
    raise exception 'invalid_invitation';
  end if;

  if actor_email = '' or actor_email <> inv.email_normalized then
    raise exception 'email_mismatch';
  end if;

  insert into public.property_members(property_id, user_id, roles, status, created_by)
  values(inv.property_id, auth.uid(), inv.roles, 'active', inv.invited_by)
  on conflict (property_id, user_id) do nothing
  returning id into created_member_id;

  if created_member_id is null then
    raise exception 'membership_exists';
  end if;

  if inv.unit_id is not null and not exists (
    select 1
    from public.unit_memberships um
    where um.property_id = inv.property_id
      and um.unit_id = inv.unit_id
      and um.member_id = created_member_id
      and um.relationship = inv.relationship
      and (um.valid_to is null or um.valid_to > now())
  ) then
    insert into public.unit_memberships(property_id, unit_id, member_id, relationship, created_by)
    values(inv.property_id, inv.unit_id, created_member_id, inv.relationship, inv.invited_by);
  end if;

  update public.invitations
  set status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now(),
      updated_at = now()
  where id = inv.id;

  return created_member_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
