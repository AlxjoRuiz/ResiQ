-- Stage 16: remove inherited grants that are not constrained by row policies.
begin;
revoke all on public.notifications from public,anon,authenticated;
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
-- TRUNCATE bypasses RLS; browser roles have no maintenance responsibilities.
do $$ declare t record; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
  loop
    execute format('revoke truncate on public.%I from public,anon,authenticated',t.relname);
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
