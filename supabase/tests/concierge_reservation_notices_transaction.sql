-- Run the complete script after 20261014220000_concierge_reservation_notices.sql.
-- All users, reservations, and notifications are rolled back.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
  ('20000000-0000-4000-8000-000000000001','reservation-notice-admin@resiq.invalid','{}'),
  ('20000000-0000-4000-8000-000000000002','reservation-notice-resident@resiq.invalid','{}'),
  ('20000000-0000-4000-8000-000000000003','reservation-notice-concierge@resiq.invalid','{}'),
  ('20000000-0000-4000-8000-000000000004','reservation-notice-suspended@resiq.invalid','{}'),
  ('20000000-0000-4000-8000-000000000005','reservation-notice-other@resiq.invalid','{}');
insert into public.properties(id,name,slug,created_by) values
  ('20100000-0000-4000-8000-000000000001','Reservation notice A','reservation-notice-a','20000000-0000-4000-8000-000000000001'),
  ('20100000-0000-4000-8000-000000000002','Reservation notice B','reservation-notice-b','20000000-0000-4000-8000-000000000005');
insert into public.property_members(id,property_id,user_id,roles,status,created_by) values
  ('20200000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',array['administrator'],'active','20000000-0000-4000-8000-000000000001'),
  ('20200000-0000-4000-8000-000000000002','20100000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',array['member'],'active','20000000-0000-4000-8000-000000000001'),
  ('20200000-0000-4000-8000-000000000003','20100000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003',array['concierge'],'active','20000000-0000-4000-8000-000000000001'),
  ('20200000-0000-4000-8000-000000000004','20100000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',array['concierge'],'suspended','20000000-0000-4000-8000-000000000001'),
  ('20200000-0000-4000-8000-000000000005','20100000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000005',array['concierge'],'active','20000000-0000-4000-8000-000000000005');
insert into public.buildings(id,property_id,name,code) values
  ('20300000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000001','Torre 1','T1');
insert into public.units(id,property_id,building_id,code) values
  ('20400000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000001','20300000-0000-4000-8000-000000000001','101');
insert into public.amenities(id,property_id,name,capacity,requires_approval,slot_minutes,created_by) values
  ('20500000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000001','Salón de prueba',10,true,600,'20000000-0000-4000-8000-000000000001');

insert into public.reservations(id,property_id,amenity_id,unit_id,requester_member_id,starts_at,ends_at,attendee_count,status,blocks_slot,hold_expires_at,idempotency_key)
values ('20600000-0000-4000-8000-000000000001','20100000-0000-4000-8000-000000000001','20500000-0000-4000-8000-000000000001','20400000-0000-4000-8000-000000000001','20200000-0000-4000-8000-000000000002',now()+interval '10 days',now()+interval '10 days 5 hours',4,'pending',true,now()+interval '1 day',gen_random_uuid());

do $test$ begin
  if exists(select 1 from public.notifications where target_id='20600000-0000-4000-8000-000000000001') then raise exception 'pending_notified_concierge'; end if;
end $test$;

update public.reservations set status='approved',hold_expires_at=null where id='20600000-0000-4000-8000-000000000001';
update public.reservations set status='approved' where id='20600000-0000-4000-8000-000000000001';

do $test$ begin
  if (select count(*) from public.notifications where target_id='20600000-0000-4000-8000-000000000001')<>1 then raise exception 'approval_notice_count'; end if;
  if not exists(select 1 from public.notifications where target_id='20600000-0000-4000-8000-000000000001' and recipient_member_id='20200000-0000-4000-8000-000000000003' and type='reservation_approved' and body like '%4 personas%' and body like '%Salón de prueba%' and body like '%Torre 1 · 101%') then raise exception 'approval_notice_details'; end if;
end $test$;

update public.reservations set status='cancelled',blocks_slot=false,cancelled_at=now(),decision_reason='Fin de prueba' where id='20600000-0000-4000-8000-000000000001';
do $test$ begin
  if (select count(*) from public.notifications where target_id='20600000-0000-4000-8000-000000000001')<>2 then raise exception 'cancellation_notice_count'; end if;
  if not exists(select 1 from public.notifications where target_id='20600000-0000-4000-8000-000000000001' and recipient_member_id='20200000-0000-4000-8000-000000000003' and type='reservation_cancelled') then raise exception 'cancellation_notice_missing'; end if;
end $test$;

insert into public.reservations(id,property_id,amenity_id,unit_id,requester_member_id,starts_at,ends_at,attendee_count,status,blocks_slot,idempotency_key)
values ('20600000-0000-4000-8000-000000000002','20100000-0000-4000-8000-000000000001','20500000-0000-4000-8000-000000000001','20400000-0000-4000-8000-000000000001','20200000-0000-4000-8000-000000000002',now()+interval '11 days',now()+interval '11 days 2 hours',1,'approved',true,gen_random_uuid());
do $test$ begin
  if (select count(*) from public.notifications where target_id='20600000-0000-4000-8000-000000000002')<>1 then raise exception 'automatic_approval_notice_count'; end if;
  if not exists(select 1 from public.notifications where target_id='20600000-0000-4000-8000-000000000002' and body like '%1 persona%') then raise exception 'singular_attendee_count'; end if;
end $test$;

select 'concierge_reservation_notices_passed_rollback' as result;
rollback;
