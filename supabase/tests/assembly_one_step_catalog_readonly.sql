-- Ejecutar en SQL Editor después de aplicar la migración de creación directa.
-- Esta consulta no crea asambleas ni envía avisos.
select
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='assembly_upload_staging') as staging_rls,
  not has_table_privilege('authenticated','public.assembly_upload_staging','SELECT')
    and not has_table_privilege('authenticated','public.assembly_upload_staging','INSERT')
    and not has_table_privilege('authenticated','public.assembly_upload_staging','UPDATE') as staging_private,
  has_function_privilege('authenticated',
    'public.create_published_assembly(uuid,text,text,text,timestamptz,text,jsonb,jsonb,uuid[],uuid)', 'EXECUTE') as publish_rpc_available,
  not has_function_privilege('authenticated',
    'public.create_assembly(uuid,text,text,text,timestamptz,text,jsonb,jsonb)', 'EXECUTE') as old_draft_rpc_closed,
  exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='assemblies' and t.tgname='assemblies_require_convocation' and t.tgenabled='O') as convocation_guard_enabled;
