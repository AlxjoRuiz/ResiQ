-- Plataforma › Administradores: marca a los auxiliares de administración (26/10/2026).
begin;

drop function public.platform_list_administrators();
create function public.platform_list_administrators()
returns table(property_id uuid, property_name text, property_status text, display_name text, email text, member_status text, since timestamptz, invitation_id uuid, is_assistant boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query
  select p.id, p.name, p.status, pr.display_name, au.email::text, pm.status, pm.joined_at, null::uuid, pm.is_admin_assistant
  from public.property_members pm
  join public.properties p on p.id = pm.property_id
  join public.profiles pr on pr.id = pm.user_id
  join auth.users au on au.id = pm.user_id
  where 'administrator' = any(pm.roles)
  union all
  select p.id, p.name, p.status, null::text, i.email_normalized, case when i.expires_at > now() then 'invited' else 'expired' end, i.created_at, i.id, i.is_admin_assistant
  from public.invitations i
  join public.properties p on p.id = i.property_id
  where i.status = 'pending' and 'administrator' = any(i.roles)
  order by 2, 9, 7;
end;
$$;
revoke all on function public.platform_list_administrators() from public, anon;
grant execute on function public.platform_list_administrators() to authenticated;

commit;

select exists(select 1 from information_schema.parameters where specific_schema = 'public'
  and specific_name like 'platform_list_administrators%' and parameter_name = 'is_assistant') as auxiliares_marcados;
