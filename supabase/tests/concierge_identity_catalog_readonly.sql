-- Ejecutar despues de 20261021000000_concierge_identity_foundation.sql.
-- Solo inspecciona catalogos: no crea porteros ni cambia permisos.
select
  to_regclass('public.concierge_accounts') is not null as table_exists,
  (select relrowsecurity from pg_class where oid = 'public.concierge_accounts'::regclass) as rls_enabled,
  has_table_privilege('authenticated', 'public.concierge_accounts', 'SELECT') as authenticated_can_read_with_rls,
  not has_table_privilege('authenticated', 'public.concierge_accounts', 'INSERT') as authenticated_cannot_insert,
  not has_table_privilege('authenticated', 'public.concierge_accounts', 'UPDATE') as authenticated_cannot_update,
  not has_table_privilege('authenticated', 'public.concierge_accounts', 'DELETE') as authenticated_cannot_delete,
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'concierge_accounts'
    and policyname = 'concierge_accounts_admin_read' and cmd = 'SELECT') as admin_read_policy_exists,
  exists (select 1 from pg_constraint where conrelid = 'public.concierge_accounts'::regclass
    and conname = 'concierge_accounts_username_key' and contype = 'u') as username_unique_globally,
  exists (select 1 from pg_constraint where conrelid = 'public.concierge_accounts'::regclass
    and conname = 'concierge_accounts_phone_e164_key' and contype = 'u') as phone_unique_globally;
