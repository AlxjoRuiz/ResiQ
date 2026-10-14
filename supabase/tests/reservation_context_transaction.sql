-- Run after 20261014230000_reservation_context.sql. All fixtures and notices roll back.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
  ('21000000-0000-4000-8000-000000000001','reservation-context-admin@resiq.invalid','{}'),
  ('21000000-0000-4000-8000-000000000002','reservation-context-resident@resiq.invalid','{}'),
  ('21000000-0000-4000-8000-000000000003','reservation-context-concierge@resiq.invalid','{}');
insert into public.properties(id,name,slug,created_by) values
  ('21100000-0000-4000-8000-000000000001','Reservation context test','reservation-context-test','21000000-0000-4000-8000-000000000001');
insert into public.property_members(id,property_id,user_id,roles,created_by) values
  ('21200000-0000-4000-8000-000000000001','21100000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001',array['administrator'],'21000000-0000-4000-8000-000000000001'),
  ('21200000-0000-4000-8000-000000000002','21100000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000002',array['member'],'21000000-0000-4000-8000-000000000001'),
  ('21200000-0000-4000-8000-000000000003','21100000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000003',array['concierge'],'21000000-0000-4000-8000-000000000001');
insert into public.buildings(id,property_id,name,code) values
  ('21300000-0000-4000-8000-000000000001','21100000-0000-4000-8000-000000000001','Torre 1','T1');
insert into public.units(id,property_id,building_id,code) values
  ('21400000-0000-4000-8000-000000000001','21100000-0000-4000-8000-000000000001','21300000-0000-4000-8000-000000000001','101');
insert into public.unit_memberships(id,property_id,unit_id,member_id,relationship,finance_access,valid_from,created_by) values
  ('21500000-0000-4000-8000-000000000001','21100000-0000-4000-8000-000000000001','21400000-0000-4000-8000-000000000001','21200000-0000-4000-8000-000000000002','owner',true,now()-interval '1 day','21000000-0000-4000-8000-000000000001');
insert into public.amenities(id,property_id,name,capacity,requires_approval,slot_minutes,created_by) values
  ('21600000-0000-4000-8000-000000000001','21100000-0000-4000-8000-000000000001','Salón de prueba',10,true,600,'21000000-0000-4000-8000-000000000001');
insert into public.amenity_hours(property_id,amenity_id,weekday,opens_at,closes_at)
select '21100000-0000-4000-8000-000000000001','21600000-0000-4000-8000-000000000001',day,'08:00'::time,'20:00'::time
from generate_series(1,7) day;

select set_config('request.jwt.claims','{"sub":"21000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select set_config('reservation_context.id',public.create_reservation_with_purpose(
  '21100000-0000-4000-8000-000000000001','21600000-0000-4000-8000-000000000001','21400000-0000-4000-8000-000000000001',
  (current_date+10)::timestamp+interval '10 hours',(current_date+10)::timestamp+interval '12 hours',4,gen_random_uuid(),'Reunión familiar de prueba'
)::text,true);
reset role;

select set_config('request.jwt.claims','{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.decide_reservation(current_setting('reservation_context.id')::uuid,true,'Aprobada para la prueba');
reset role;

select set_config('request.jwt.claims','{"sub":"21000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $test$ begin
  if not exists (
    select 1 from public.list_operational_reservations_with_context(
      '21100000-0000-4000-8000-000000000001',now(),now()+interval '30 days') r
    where r.reservation_id=current_setting('reservation_context.id')::uuid
      and r.status='approved' and r.purpose='Reunión familiar de prueba'
      and r.review_message='Aprobada para la prueba' and r.attendee_count=4
  ) then raise exception 'concierge_context_missing'; end if;
  if not exists (
    select 1 from public.notifications n
    where n.target_id=current_setting('reservation_context.id')::uuid
      and n.recipient_member_id='21200000-0000-4000-8000-000000000003'
      and n.body like '%Reunión familiar de prueba%'
      and n.body like '%Aprobada para la prueba%'
  ) then raise exception 'concierge_approval_notice_incomplete'; end if;
end $test$;
reset role;

select set_config('request.jwt.claims','{"sub":"21000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select public.cancel_reservation(current_setting('reservation_context.id')::uuid,'Fin de prueba técnica');
reset role;

do $test$ begin
  if not exists (
    select 1 from public.reservations r where r.id=current_setting('reservation_context.id')::uuid
      and r.status='cancelled' and r.purpose='Reunión familiar de prueba'
      and r.review_message='Aprobada para la prueba' and r.decision_reason='Fin de prueba técnica'
  ) then raise exception 'cancellation_context_missing'; end if;
  if not exists (
    select 1 from public.notifications n where n.target_id=current_setting('reservation_context.id')::uuid
      and n.recipient_member_id='21200000-0000-4000-8000-000000000003'
      and n.type='reservation_cancelled' and n.body like '%Fin de prueba técnica%'
  ) then raise exception 'concierge_cancellation_reason_missing'; end if;
end $test$;

select 'reservation_context_passed_rollback' as result;
rollback;
