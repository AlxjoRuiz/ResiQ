-- Auxiliares: editar ficha, sustituir contraseña y eliminar, igual que portería (27/10/2026). La
-- lista devuelve el id de la ficha; al eliminar se revoca la membresía y la ficha queda marcada.
begin;

alter table public.admin_assistant_records add column removed_at timestamptz;

drop function public.get_admin_assistants(uuid);
create function public.get_admin_assistants(target_property_id uuid)
returns table(member_id uuid, invitation_id uuid, display_name text, email text, assistant_status text, since timestamptz,
  full_name text, document_number text, birth_date date, phone_e164 text, address text, vehicles jsonb, username text,
  record_id uuid, first_name text, first_surname text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  return query
  select pm.id, null::uuid, pr.display_name, au.email::text, pm.status, pm.joined_at,
    r.first_name || ' ' || r.first_surname, r.document_number, r.birth_date, r.phone_e164, r.address, r.vehicles, r.username,
    r.id, r.first_name, r.first_surname
  from public.property_members pm join public.profiles pr on pr.id = pm.user_id join auth.users au on au.id = pm.user_id
  left join public.admin_assistant_records r on r.member_id = pm.id
  where pm.property_id = target_property_id and pm.is_admin_assistant and pm.status <> 'revoked'
  union all
  select null::uuid, i.id, null::text, i.email_normalized, case when i.expires_at > now() then 'invited' else 'expired' end, i.created_at,
    r.first_name || ' ' || r.first_surname, r.document_number, r.birth_date, r.phone_e164, r.address, r.vehicles, null::text,
    r.id, r.first_name, r.first_surname
  from public.invitations i left join public.admin_assistant_records r on r.invitation_id = i.id
  where i.property_id = target_property_id and i.is_admin_assistant and i.status = 'pending'
  order by 6 desc;
end;
$$;
revoke all on function public.get_admin_assistants(uuid) from public, anon;
grant execute on function public.get_admin_assistants(uuid) to authenticated;

commit;

select
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'admin_assistant_records' and column_name = 'removed_at') as baja_auxiliar,
  exists(select 1 from information_schema.parameters where specific_schema = 'public'
    and specific_name like 'get_admin_assistants%' and parameter_name = 'record_id') as lista_con_ficha;
