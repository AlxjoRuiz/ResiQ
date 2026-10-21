-- Ejecutar despues de 20261021010000_concierge_email_identity.sql.
-- Solo consulta catalogos; todas las columnas deben ser true.
select
  to_regclass('public.concierge_accounts') is not null as table_exists,
  exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concierge_accounts'
      and column_name = 'email_normalized' and is_nullable = 'NO') as email_required,
  exists (select 1 from pg_constraint
    where conrelid = 'public.concierge_accounts'::regclass
      and conname = 'concierge_accounts_email_normalized_key' and contype = 'u') as email_unique,
  not exists (select 1 from pg_constraint
    where conrelid = 'public.concierge_accounts'::regclass
      and conname = 'concierge_accounts_phone_e164_key') as phone_not_login_identity,
  not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'concierge_accounts'
      and column_name like 'activation_%') as no_temporary_password_columns,
  (select relrowsecurity from pg_class
    where oid = 'public.concierge_accounts'::regclass) as rls_enabled,
  not has_table_privilege('authenticated', 'public.concierge_accounts', 'INSERT') as no_browser_insert,
  not has_table_privilege('authenticated', 'public.concierge_accounts', 'UPDATE') as no_browser_update;
