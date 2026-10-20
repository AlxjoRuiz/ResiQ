-- Ejecutar después de la migración; todas las columnas deben ser true.
select
  (select relrowsecurity from pg_class where oid='public.census_imports'::regclass) as imports_rls,
  (select relrowsecurity from pg_class where oid='public.census_records'::regclass) as records_rls,
  has_table_privilege('authenticated','public.census_imports','SELECT') as admin_client_can_read_imports_via_rls,
  has_table_privilege('authenticated','public.census_records','SELECT') as admin_client_can_read_records_via_rls,
  not has_table_privilege('authenticated','public.census_records','INSERT') as no_direct_insert,
  not has_table_privilege('anon','public.census_records','SELECT') as no_anon_read,
  (select count(*)=2 from pg_policies where schemaname='public'
     and tablename in ('census_imports','census_records') and cmd='SELECT') as admin_read_policies,
  to_regprocedure('public.import_census(uuid,text,jsonb,jsonb)') is not null as import_rpc_exists;
