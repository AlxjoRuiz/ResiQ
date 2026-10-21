-- Solo lectura. Ejecutar despues de la migracion de principal del censo.
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'census_imports'
      and column_name = 'primary_selection_finalized' and data_type = 'boolean'
  ) as finalized_column_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'census_records'
      and column_name = 'invitation_primary' and data_type = 'boolean'
  ) as primary_column_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'census_records'
      and column_name = 'invitation_relationship' and data_type = 'text'
  ) as relationship_column_ok,
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'census_records'
      and indexname = 'census_one_invitation_primary_per_unit'
  ) as unique_primary_index_ok,
  to_regprocedure('public.import_census_with_primary(uuid,text,jsonb,jsonb,jsonb)') is not null
    as import_function_ok,
  has_function_privilege('authenticated',
    'public.import_census_with_primary(uuid,text,jsonb,jsonb,jsonb)', 'EXECUTE')
    as authenticated_execute_ok,
  not has_function_privilege('anon',
    'public.import_census_with_primary(uuid,text,jsonb,jsonb,jsonb)', 'EXECUTE')
    as anon_blocked_ok;
