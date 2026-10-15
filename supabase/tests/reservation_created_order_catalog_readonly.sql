-- Solo lectura; ejecutar después de 20261015000000_reservation_created_order.sql.
select
  to_regprocedure('public.list_operational_reservations_recent(uuid,timestamptz,timestamptz)') is not null as function_exists,
  pg_get_function_result('public.list_operational_reservations_recent(uuid,timestamptz,timestamptz)'::regprocedure) like '%created_at timestamp with time zone%' as includes_creation_time,
  has_function_privilege('authenticated','public.list_operational_reservations_recent(uuid,timestamptz,timestamptz)','EXECUTE') as authenticated_can_execute,
  not has_function_privilege('anon','public.list_operational_reservations_recent(uuid,timestamptz,timestamptz)','EXECUTE') as anon_cannot_execute;
