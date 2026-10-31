-- Pruebas ResiQ (31/10/2026, pedido de Alejandro): en «Correos de prueba» se ven también las cuentas
-- @resiq.invalid que ya existen (de prueba sin marcarlas) y las marcadas a mano, con a qué tienen acceso.
-- Las cuentas retiradas (retirado-N@resiq.invalid) no salen.
begin;

create or replace function public.platform_list_test_accounts()
returns table(email text, display_name text, access text, last_sign_in_at timestamptz, automatic boolean, marked boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  return query
  with accounts as (
    select au.id, lower(au.email::text) as mail, au.last_sign_in_at as seen from auth.users au
    where au.email is not null
      and ((lower(au.email::text) like '%@resiq.invalid' and lower(au.email::text) not like 'retirado-%')
        or exists(select 1 from public.platform_test_emails t where t.email_normalized = lower(au.email::text)))
  ), grants as (
    select pm.user_id, p.name || ' · ' || case when 'administrator' = any(pm.roles) and pm.is_admin_assistant then 'Auxiliar'
      when 'administrator' = any(pm.roles) then 'Administrador' when 'concierge' = any(pm.roles) then 'Portería' else 'Residente' end
      || case when pm.status = 'suspended' then ' (suspendido)' else '' end as label
    from public.property_members pm join public.properties p on p.id = pm.property_id where pm.status in ('active', 'suspended')
    union all
    select ms.user_id, 'Mantenimiento · ' || case ms.role when 'admin' then 'Admin' else 'Trabajador' end || case when ms.status = 'suspended' then ' (suspendido)' else '' end
    from public.maintenance_staff ms where ms.status <> 'revoked'
    union all
    select ls.user_id, 'Jurídica' || case when ls.status = 'suspended' then ' (suspendida)' else '' end
    from public.legal_staff ls where ls.status <> 'revoked'
  )
  select a.mail, pr.display_name, (select string_agg(g.label, ', ' order by g.label) from grants g where g.user_id = a.id),
    a.seen, a.mail like '%@resiq.invalid', exists(select 1 from public.platform_test_emails t where t.email_normalized = a.mail)
  from accounts a left join public.profiles pr on pr.id = a.id
  union all
  -- Correos marcados que todavía no tienen cuenta (por ejemplo, una invitación sin aceptar).
  select t.email_normalized, null::text, null::text, null::timestamptz, t.email_normalized like '%@resiq.invalid', true
  from public.platform_test_emails t where not exists(select 1 from auth.users au where lower(au.email::text) = t.email_normalized)
  order by 1;
end;
$$;

revoke all on function public.platform_list_test_accounts() from public, anon;
grant execute on function public.platform_list_test_accounts() to authenticated;

commit;

-- Debe dar true.
select has_function_privilege('authenticated', 'public.platform_list_test_accounts()', 'execute')
  and not has_function_privilege('anon', 'public.platform_list_test_accounts()', 'execute') as cuentas_de_prueba_protegidas;
