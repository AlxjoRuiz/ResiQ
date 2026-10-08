-- Read-only assertions for effective grants; no user data or mutations.
begin read only;
do $$ declare t record; begin
  if not has_column_privilege('authenticated','public.notifications','read_at','UPDATE') then
    raise exception 'notification_read_marker_permission_missing';
  end if;
  for t in select attname from pg_attribute where attrelid='public.notifications'::regclass and attnum>0 and not attisdropped and attname<>'read_at' loop
    if has_column_privilege('authenticated','public.notifications',t.attname,'UPDATE') then
      raise exception 'notification_column_editable: %',t.attname;
    end if;
  end loop;
  for t in select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') loop
    if has_table_privilege('anon',t.oid,'TRUNCATE') or has_table_privilege('authenticated',t.oid,'TRUNCATE') then
      raise exception 'browser_truncate_granted: %',t.relname;
    end if;
  end loop;
end $$;
select 'stage16_effective_grants_passed' as result;
rollback;
