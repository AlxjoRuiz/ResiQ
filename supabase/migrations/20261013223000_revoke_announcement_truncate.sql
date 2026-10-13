-- Announcement tables were created after the general browser TRUNCATE revocation.
-- TRUNCATE bypasses row security and is not needed by browser roles.
begin;

revoke truncate on table public.announcements, public.announcement_recipients
  from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('announcements', 'announcement_recipients')
      and (has_table_privilege('anon', c.oid, 'TRUNCATE')
        or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))
  ) then
    raise exception 'browser_truncate_grant_remains';
  end if;
end $$;

commit;
