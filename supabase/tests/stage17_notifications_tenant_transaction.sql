-- Stage 17: notifications remain private to their recipient and property.
-- Run the entire script in the ResiQ SQL Editor. All fixtures are rolled back.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
 ('17000000-0000-4000-8000-000000000001','stage17-admin@resiq.invalid','{}'),
 ('17000000-0000-4000-8000-000000000002','stage17-resident-a@resiq.invalid','{}'),
 ('17000000-0000-4000-8000-000000000003','stage17-resident-b@resiq.invalid','{}');

insert into public.properties(id,name,slug,created_by) values
 ('17100000-0000-4000-8000-000000000001','Stage 17 property A','stage17-notifications-a','17000000-0000-4000-8000-000000000001'),
 ('17100000-0000-4000-8000-000000000002','Stage 17 property B','stage17-notifications-b','17000000-0000-4000-8000-000000000001');

insert into public.property_members(id,property_id,user_id,roles,created_by) values
 ('17200000-0000-4000-8000-000000000001','17100000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000002',array['member'],'17000000-0000-4000-8000-000000000001'),
 ('17200000-0000-4000-8000-000000000002','17100000-0000-4000-8000-000000000002','17000000-0000-4000-8000-000000000003',array['member'],'17000000-0000-4000-8000-000000000001');

insert into public.notifications(id,property_id,recipient_member_id,type,subject,body,target_type,dedupe_key) values
 ('17300000-0000-4000-8000-000000000001','17100000-0000-4000-8000-000000000001','17200000-0000-4000-8000-000000000001','pqrs_created','Stage 17 A','Fixture A','pqrs','stage17-a'),
 ('17300000-0000-4000-8000-000000000002','17100000-0000-4000-8000-000000000002','17200000-0000-4000-8000-000000000002','pqrs_created','Stage 17 B','Fixture B','pqrs','stage17-b');

select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $test$
begin
 if (select count(*) from public.notifications where id in ('17300000-0000-4000-8000-000000000001','17300000-0000-4000-8000-000000000002'))<>1 then raise exception 'resident_a_notification_visibility'; end if;
 if not exists(select 1 from public.notifications where id='17300000-0000-4000-8000-000000000001') then raise exception 'resident_a_own_notification_missing'; end if;
 if exists(select 1 from public.notifications where id='17300000-0000-4000-8000-000000000002') then raise exception 'resident_a_cross_property_notification_visible'; end if;
end $test$;
update public.notifications set read_at=now() where id='17300000-0000-4000-8000-000000000001';
do $test$
declare changed integer;
begin
 update public.notifications set read_at=now() where id='17300000-0000-4000-8000-000000000002';
 get diagnostics changed = row_count;
 if changed<>0 then raise exception 'resident_a_cross_property_read_marker_changed'; end if;
end $test$;
reset role;

do $test$
begin
 if (select read_at is null from public.notifications where id='17300000-0000-4000-8000-000000000001') then raise exception 'resident_a_read_marker_missing'; end if;
 if (select read_at is not null from public.notifications where id='17300000-0000-4000-8000-000000000002') then raise exception 'resident_b_read_marker_changed'; end if;
end $test$;

select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $test$
begin
 if (select count(*) from public.notifications where id in ('17300000-0000-4000-8000-000000000001','17300000-0000-4000-8000-000000000002'))<>1 then raise exception 'resident_b_notification_visibility'; end if;
 if not exists(select 1 from public.notifications where id='17300000-0000-4000-8000-000000000002') then raise exception 'resident_b_own_notification_missing'; end if;
 if exists(select 1 from public.notifications where id='17300000-0000-4000-8000-000000000001') then raise exception 'resident_b_cross_property_notification_visible'; end if;
end $test$;
reset role;

update public.property_members set status='suspended' where id='17200000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $test$
begin
 if exists(select 1 from public.notifications where id='17300000-0000-4000-8000-000000000001') then raise exception 'revoked_resident_notification_visible'; end if;
end $test$;
reset role;

select 'stage17_notifications_tenant_and_revocation_passed_rollback' as result;
rollback;
