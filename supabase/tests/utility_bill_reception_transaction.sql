-- Physical utility bill reception and resident notice. Run after 20261009180000_utility_bills_at_concierge.sql.
-- Entire script rolls back. Utility bills create in-app notices; mail waits for domain setup.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
 ('17b00000-0000-4000-8000-000000000001','utility-concierge@resiq.invalid','{}'),
 ('17b00000-0000-4000-8000-000000000002','utility-resident@resiq.invalid','{}'),
 ('17b00000-0000-4000-8000-000000000003','utility-outsider@resiq.invalid','{}');
insert into public.properties(id,name,slug,created_by) values
 ('17b10000-0000-4000-8000-000000000001','Utility bill fixture','utility-bill-fixture','17b00000-0000-4000-8000-000000000001');
insert into public.property_members(id,property_id,user_id,roles,created_by) values
 ('17b20000-0000-4000-8000-000000000001','17b10000-0000-4000-8000-000000000001','17b00000-0000-4000-8000-000000000001',array['concierge'],'17b00000-0000-4000-8000-000000000001'),
 ('17b20000-0000-4000-8000-000000000002','17b10000-0000-4000-8000-000000000001','17b00000-0000-4000-8000-000000000002',array['member'],'17b00000-0000-4000-8000-000000000001');
insert into public.buildings(id,property_id,name,code) values
 ('17b30000-0000-4000-8000-000000000001','17b10000-0000-4000-8000-000000000001','Tower 1','1');
insert into public.units(id,property_id,building_id,code) values
 ('17b40000-0000-4000-8000-000000000001','17b10000-0000-4000-8000-000000000001','17b30000-0000-4000-8000-000000000001','101');
insert into public.unit_memberships(id,property_id,unit_id,member_id,relationship,valid_from,created_by) values
 ('17b50000-0000-4000-8000-000000000001','17b10000-0000-4000-8000-000000000001','17b40000-0000-4000-8000-000000000001','17b20000-0000-4000-8000-000000000002','resident',now()-interval '1 day','17b00000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"17b00000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17b00000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_config('stage17.bill_water',public.register_utility_bill('17b10000-0000-4000-8000-000000000001','17b40000-0000-4000-8000-000000000001','17b20000-0000-4000-8000-000000000002','','water','Sobre físico')::text,true);
do $test$
begin
 if not exists(select 1 from public.packages where id=current_setting('stage17.bill_water')::uuid and kind='utility_bill' and utility_service='water' and recipient_member_id='17b20000-0000-4000-8000-000000000002' and status='received') then raise exception 'utility_bill_not_registered'; end if;
 if (select count(*) from public.notifications where target_type='package' and target_id=current_setting('stage17.bill_water')::uuid and recipient_member_id='17b20000-0000-4000-8000-000000000002' and subject='Recibo de agua en portería' and body like '%recibo de agua%')<>1 then raise exception 'resident_notice_missing_or_duplicated'; end if;
 begin
  perform public.register_utility_bill('17b10000-0000-4000-8000-000000000001','17b40000-0000-4000-8000-000000000001',null,'Resident','internet','');
  raise exception 'invalid_service_accepted';
 exception when others then if sqlerrm<>'invalid_service' then raise; end if; end;
end $test$;

-- A physical bill without an associated account stays private until Portería links one.
select set_config('stage17.bill_gas',public.register_utility_bill('17b10000-0000-4000-8000-000000000001','17b40000-0000-4000-8000-000000000001',null,'Test resident','gas','')::text,true);
do $test$
begin
 if exists(select 1 from public.notifications where target_id=current_setting('stage17.bill_gas')::uuid) then raise exception 'unassigned_bill_notified'; end if;
 perform public.assign_package_recipient(current_setting('stage17.bill_gas')::uuid,'17b20000-0000-4000-8000-000000000002');
 if (select count(*) from public.notifications where target_id=current_setting('stage17.bill_gas')::uuid and recipient_member_id='17b20000-0000-4000-8000-000000000002' and subject='Recibo de gas en portería')<>1 then raise exception 'late_assignment_notice_missing'; end if;
end $test$;
reset role;

-- The SQL Editor owner can inspect the private queue; clients cannot.
do $test$
begin
 if exists(select 1 from public.email_jobs ej join public.notifications n on n.id=ej.notification_id where n.target_id in (current_setting('stage17.bill_water')::uuid,current_setting('stage17.bill_gas')::uuid)) then raise exception 'utility_email_job_before_domain_setup'; end if;
end $test$;

select set_config('request.jwt.claims','{"sub":"17b00000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17b00000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $test$
begin
 if (select count(*) from public.packages where id in (current_setting('stage17.bill_water')::uuid,current_setting('stage17.bill_gas')::uuid))<>2 then raise exception 'resident_bills_hidden'; end if;
end $test$;
reset role;

select set_config('request.jwt.claims','{"sub":"17b00000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17b00000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $test$
begin
 if exists(select 1 from public.packages where id in (current_setting('stage17.bill_water')::uuid,current_setting('stage17.bill_gas')::uuid)) then raise exception 'outsider_can_read_bill'; end if;
end $test$;
reset role;

select 'utility_bill_reception_notice_passed_rollback' as result;
rollback;
