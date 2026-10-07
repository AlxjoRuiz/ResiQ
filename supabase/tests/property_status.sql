\ir security_fixture.sql
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.units)<>1 then raise exception 'active_tenant_access_denied'; end if;
 perform public.create_visit('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',null,'Security visitor',null,'personal',null,null,now()+interval '1 day',now()+interval '1 day 1 hour',1,null,null);
end $$;
reset role;
update public.properties set status='suspended' where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ declare blocked boolean:=false; begin
 if exists(select 1 from public.units) or exists(select 1 from public.unit_memberships) or exists(select 1 from public.visitors) then raise exception 'suspended_tenant_readable'; end if;
 begin
  perform public.create_visit('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',null,'Security visitor',null,'personal',null,null,now()+interval '1 day',now()+interval '1 day 1 hour',1,null,null);
 exception when others then blocked:=sqlerrm like '%property_inactive%' or sqlerrm like '%not_authorized%'; end;
 if not blocked then raise exception 'suspended_tenant_visit_created'; end if;
end $$;
reset role;
rollback;
