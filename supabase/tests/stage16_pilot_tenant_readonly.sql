-- Read-only checks using the approved Bosques pilot resident. No records or permissions changed.
begin read only;
select set_config('request.jwt.claims','{"sub":"b5ce4454-e02c-47f2-b139-d94d6e79962b","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','b5ce4454-e02c-47f2-b139-d94d6e79962b',true);
set local role authenticated;
do $test$
declare relation record; leaked bigint; checked integer:=0;
begin
 if not exists(select 1 from public.properties where id='1bde3475-3ed2-4f57-bd13-39784b12d2a6') then raise exception 'resident_pilot_access_missing'; end if;
 if exists(select 1 from public.properties where id<>'1bde3475-3ed2-4f57-bd13-39784b12d2a6') then raise exception 'resident_other_property_visible'; end if;
 for relation in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attname='property_id' and not a.attisdropped where n.nspname='public' and c.relkind in ('r','p') and has_table_privilege(current_user,c.oid,'SELECT') loop
  execute format('select count(*) from public.%I where property_id <> $1',relation.relname) into leaked using '1bde3475-3ed2-4f57-bd13-39784b12d2a6'::uuid;
  if leaked>0 then raise exception 'cross_tenant_leak: %',relation.relname; end if;
  checked:=checked+1;
 end loop;
 if checked=0 then raise exception 'no_tables_checked'; end if;
 raise notice 'Resident isolation checked across % property-scoped tables',checked;
end; $test$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $test$
declare relation record; visible_rows bigint;
begin
 for relation in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attname='property_id' and not a.attisdropped where n.nspname='public' and c.relkind in ('r','p') and has_table_privilege(current_user,c.oid,'SELECT') loop
  execute format('select count(*) from public.%I',relation.relname) into visible_rows;
  if visible_rows>0 then raise exception 'anonymous_property_data_visible: %',relation.relname; end if;
 end loop;
end; $test$;
reset role;
select 'resident_cross_tenant_and_anonymous_read_checks_passed' as result;
rollback;
