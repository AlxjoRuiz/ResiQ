-- Etapa 16: diagnóstico de catálogo. Solo lectura; no devuelve datos personales.
begin read only;

-- Tablas operativas sin RLS: resultado esperado vacío.
select c.relname as table_without_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- Privilegios efectivos: revisión necesaria si aparece true.
-- Incluye grants heredados y de PUBLIC, no solo grants escritos en migraciones.
select r.role_name,t.table_name,p.privilege,
  has_table_privilege(r.role_name,format('public.%I',t.table_name),p.privilege) as allowed
from (values ('anon'),('authenticated')) r(role_name)
cross join (values ('audit_logs'),('email_jobs'),('email_logs'),('documents'),('notifications')) t(table_name)
cross join (values ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE')) p(privilege)
where to_regclass(format('public.%I',t.table_name)) is not null
order by t.table_name,r.role_name,p.privilege;

-- Avisos: authenticated debería poder cambiar read_at, pero no los demás campos.
select a.attname as column_name,
  has_column_privilege('authenticated','public.notifications',a.attname,'UPDATE') as allowed
from pg_attribute a
where a.attrelid='public.notifications'::regclass and a.attnum>0 and not a.attisdropped
order by a.attnum;

-- Políticas de estas tablas: evaluar junto con privilegios (RLS no cubre TRUNCATE).
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where schemaname='public' and tablename in ('audit_logs','email_jobs','email_logs','documents','notifications')
order by tablename,policyname;

-- Funciones privilegiadas sin search_path fijo: resultado esperado vacío.
select n.nspname as schema_name,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.prosecdef
and not exists(select 1 from unnest(coalesce(p.proconfig,array[]::text[])) setting where setting like 'search_path=%');

-- RPC internas sensibles accesibles para roles de navegador: esperado false.
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='private' and (p.proname like 'enqueue_%' or p.proname='write_property_audit'))
   or (n.nspname='public' and p.proname in ('claim_email_jobs','complete_email_job','fail_email_job','authorize_email_job','complete_verified_document','list_rejected_document_cleanup','complete_rejected_document_cleanup'))
order by n.nspname,p.proname;

rollback;
