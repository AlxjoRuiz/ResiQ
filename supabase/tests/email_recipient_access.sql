\ir security_fixture.sql
select public.create_receivable('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Security test charge',100,current_date,current_date,null);
-- Simulate a historical queued job from before explicit unit payloads.
update public.email_jobs set template_data=template_data-'unit_id';
update public.notifications set payload=payload-'unit_id';
select count(*) from public.claim_email_jobs('security-worker',10);
create temp table job_target as select id from public.email_jobs;
grant select on job_target to service_role;
set local role service_role;
do $$ begin
 if not public.authorize_email_job((select id from job_target limit 1),'security-worker') then raise exception 'authorized_recipient_denied'; end if;
 if public.authorize_email_job((select id from job_target limit 1),'different-worker') then raise exception 'wrong_lease_authorized'; end if;
end $$;
reset role;
update public.unit_memberships set finance_access=false where id='60000000-0000-4000-8000-000000000001';
set local role service_role;
do $$ begin
 if public.authorize_email_job((select id from job_target limit 1),'security-worker') then raise exception 'revoked_recipient_authorized'; end if;
end $$;
reset role;
do $$ begin
 if (select status from public.email_jobs limit 1)<>'cancelled' then raise exception 'revoked_job_not_cancelled'; end if;
 if auth.uid()<>'10000000-0000-4000-8000-000000000001'::uuid then raise exception 'actor_context_not_restored'; end if;
end $$;
rollback;
