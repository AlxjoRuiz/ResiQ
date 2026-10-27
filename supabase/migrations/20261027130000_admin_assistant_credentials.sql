-- Auxiliares con usuario y contraseña, igual que portería (decisión de Alejandro, 27/10/2026). El
-- admin los registra con sus datos, usuario (nombre + apellido + 2 dígitos de la cédula) y
-- contraseña; ya no se usa el enlace de invitación. Pueden entrar con el usuario o con el correo.
-- Los auxiliares registrados antes por enlace siguen como estaban.
begin;

alter table public.admin_assistant_records alter column invitation_id drop not null;
alter table public.admin_assistant_records add column user_id uuid references public.profiles(id) on delete restrict;
alter table public.admin_assistant_records add column username text check (username is null or username ~ '^[a-z0-9]+$');
create unique index admin_assistant_records_username_idx on public.admin_assistant_records(username) where username is not null;
alter table public.admin_assistant_records add constraint admin_assistant_records_origin_check
  check (invitation_id is not null or (username is not null and user_id is not null and member_id is not null));

drop function public.get_admin_assistants(uuid);
create function public.get_admin_assistants(target_property_id uuid)
returns table(member_id uuid, invitation_id uuid, display_name text, email text, assistant_status text, since timestamptz,
  full_name text, document_number text, birth_date date, phone_e164 text, address text, vehicles jsonb, username text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  return query
  select pm.id, null::uuid, pr.display_name, au.email::text, pm.status, pm.joined_at,
    r.first_name || ' ' || r.first_surname, r.document_number, r.birth_date, r.phone_e164, r.address, r.vehicles, r.username
  from public.property_members pm join public.profiles pr on pr.id = pm.user_id join auth.users au on au.id = pm.user_id
  left join public.admin_assistant_records r on r.member_id = pm.id
  where pm.property_id = target_property_id and pm.is_admin_assistant and pm.status <> 'revoked'
  union all
  select null::uuid, i.id, null::text, i.email_normalized, case when i.expires_at > now() then 'invited' else 'expired' end, i.created_at,
    r.first_name || ' ' || r.first_surname, r.document_number, r.birth_date, r.phone_e164, r.address, r.vehicles, null::text
  from public.invitations i left join public.admin_assistant_records r on r.invitation_id = i.id
  where i.property_id = target_property_id and i.is_admin_assistant and i.status = 'pending'
  order by 6 desc;
end;
$$;
revoke all on function public.get_admin_assistants(uuid) from public, anon;
grant execute on function public.get_admin_assistants(uuid) to authenticated;

commit;

select
  exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'admin_assistant_records' and column_name = 'username') as usuario_auxiliar,
  exists(select 1 from information_schema.parameters where specific_schema = 'public'
    and specific_name like 'get_admin_assistants%' and parameter_name = 'username') as lista_con_usuario;
