-- Lectura de catalogo, no modifica datos ni marca asistencias.
select
  to_regprocedure('public.self_check_in_assembly(uuid)') is not null as function_exists,
  has_function_privilege('authenticated','public.self_check_in_assembly(uuid)','EXECUTE') as authenticated_can_execute,
  not has_function_privilege('anon','public.self_check_in_assembly(uuid)','EXECUTE') as anon_cannot_execute,
  (select p.prosecdef from pg_proc p where p.oid = to_regprocedure('public.self_check_in_assembly(uuid)')) as security_definer;
