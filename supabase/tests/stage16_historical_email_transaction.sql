-- Disposable fixtures; every security regression ends in ROLLBACK.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001','admin@resiq.invalid','{"display_name":"Test admin"}'),
 ('10000000-0000-4000-8000-000000000002','member@resiq.invalid','{"display_name":"Test member"}'),
 ('10000000-0000-4000-8000-000000000003','representative@resiq.invalid','{"display_name":"Test representative"}');
insert into public.properties(id,name,slug,created_by) values('20000000-0000-4000-8000-000000000001','Security test','security-test','10000000-0000-4000-8000-000000000001');
insert into public.property_members(id,property_id,user_id,roles,created_by) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',array['administrator'],'10000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',array['member'],'10000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003',array['member'],'10000000-0000-4000-8000-000000000001');
insert into public.buildings(id,property_id,name,code) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Test building','TEST');
insert into public.units(id,property_id,building_id,code) values
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','101'),
 ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','102');
insert into public.unit_memberships(id,property_id,unit_id,member_id,relationship,finance_access,valid_from,created_by) values
 ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','owner',true,now()-interval '1 day','10000000-0000-4000-8000-000000000001'),
 ('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','resident',false,now()-interval '1 day','10000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);


select public.create_receivable('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Security test charge',100,current_date,current_date,null);
-- Simulate a historical queued job from before explicit unit payloads.
update public.email_jobs set template_data=template_data-'unit_id' where property_id='20000000-0000-4000-8000-000000000001';
update public.notifications set payload=payload-'unit_id' where property_id='20000000-0000-4000-8000-000000000001';
update public.email_jobs set status='processing',locked_by='security-worker',locked_until=now()+interval '5 minutes' where property_id='20000000-0000-4000-8000-000000000001';
select set_config('test.email_job',(select id::text from public.email_jobs where property_id='20000000-0000-4000-8000-000000000001' limit 1),true);
set local role service_role;
do $$ begin
 if not public.authorize_email_job(current_setting('test.email_job')::uuid,'security-worker') then raise exception 'authorized_recipient_denied'; end if;
 if public.authorize_email_job(current_setting('test.email_job')::uuid,'different-worker') then raise exception 'wrong_lease_authorized'; end if;
end $$;
reset role;
update public.unit_memberships set finance_access=false where id='60000000-0000-4000-8000-000000000001';
set local role service_role;
do $$ begin
 if public.authorize_email_job(current_setting('test.email_job')::uuid,'security-worker') then raise exception 'revoked_recipient_authorized'; end if;
end $$;
reset role;
do $$ begin
 if (select status from public.email_jobs where id=current_setting('test.email_job')::uuid)<>'cancelled' then raise exception 'revoked_job_not_cancelled'; end if;
 if auth.uid()<>'10000000-0000-4000-8000-000000000001'::uuid then raise exception 'actor_context_not_restored'; end if;
end $$;
select 'historical_email_access_passed' as result;
rollback;
