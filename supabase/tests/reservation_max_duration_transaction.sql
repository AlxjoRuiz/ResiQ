-- Run the complete script in the ResiQ SQL Editor after the max-duration migration.
-- Synthetic users, zones, reservations, and notices are rolled back.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
  ('19000000-0000-4000-8000-000000000001','reservation-max-admin@resiq.invalid','{}'),
  ('19000000-0000-4000-8000-000000000002','reservation-max-resident@resiq.invalid','{}');
insert into public.properties(id,name,slug,created_by) values
  ('19100000-0000-4000-8000-000000000001','Reservation max test','reservation-max-test','19000000-0000-4000-8000-000000000001');
insert into public.property_members(id,property_id,user_id,roles,created_by) values
  ('19200000-0000-4000-8000-000000000001','19100000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000001',array['administrator'],'19000000-0000-4000-8000-000000000001'),
  ('19200000-0000-4000-8000-000000000002','19100000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000002',array['member'],'19000000-0000-4000-8000-000000000001');
insert into public.buildings(id,property_id,name,code) values
  ('19300000-0000-4000-8000-000000000001','19100000-0000-4000-8000-000000000001','Test tower','A');
insert into public.units(id,property_id,building_id,code) values
  ('19400000-0000-4000-8000-000000000001','19100000-0000-4000-8000-000000000001','19300000-0000-4000-8000-000000000001','101');
insert into public.unit_memberships(id,property_id,unit_id,member_id,relationship,finance_access,valid_from,created_by) values
  ('19500000-0000-4000-8000-000000000001','19100000-0000-4000-8000-000000000001','19400000-0000-4000-8000-000000000001','19200000-0000-4000-8000-000000000002','owner',true,now()-interval '1 day','19000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_config('reservation_max.amenity',public.save_amenity(
  '19100000-0000-4000-8000-000000000001',null,'Test room','',10,true,'',600,'active',
  (select jsonb_agg(jsonb_build_object('weekday',day,'opens_at','08:00','closes_at','13:00')) from generate_series(1,7) day)
)::text,true);
reset role;

select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $test$
declare zone_id uuid:=current_setting('reservation_max.amenity')::uuid; day_one timestamp:=(current_date+10)::timestamp;
begin
  perform public.create_reservation('19100000-0000-4000-8000-000000000001',zone_id,'19400000-0000-4000-8000-000000000001',day_one+interval '10 hours',day_one+interval '12 hours',1,gen_random_uuid());
  perform public.create_reservation('19100000-0000-4000-8000-000000000001',zone_id,'19400000-0000-4000-8000-000000000001',day_one+interval '1 day 8 hours',day_one+interval '1 day 13 hours',1,gen_random_uuid());
  begin
    perform public.create_reservation('19100000-0000-4000-8000-000000000001',zone_id,'19400000-0000-4000-8000-000000000001',day_one+interval '2 days 8 hours',day_one+interval '2 days 19 hours',1,gen_random_uuid());
    raise exception 'long_reservation_accepted';
  exception when others then if sqlerrm<>'reservation_too_long' then raise; end if; end;
  begin
    perform public.create_reservation('19100000-0000-4000-8000-000000000001',zone_id,'19400000-0000-4000-8000-000000000001',day_one+interval '2 days 10 hours',day_one+interval '2 days 14 hours',1,gen_random_uuid());
    raise exception 'outside_hours_accepted';
  exception when others then if sqlerrm<>'outside_amenity_hours' then raise; end if; end;
end $test$;
reset role;

select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.save_amenity('19100000-0000-4000-8000-000000000001',current_setting('reservation_max.amenity')::uuid,'Test room','',10,true,'',600,'active',
  (select jsonb_agg(jsonb_build_object('weekday',day,'opens_at','17:00','closes_at','03:00')) from generate_series(1,7) day));
reset role;

select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $test$
declare day_one timestamp:=(current_date+20)::timestamp;
begin
  perform public.create_reservation('19100000-0000-4000-8000-000000000001',current_setting('reservation_max.amenity')::uuid,'19400000-0000-4000-8000-000000000001',day_one+interval '20 hours',day_one+interval '1 day 1 hour',1,gen_random_uuid());
end $test$;
reset role;

select 'reservation_max_duration_passed_rollback' as result;
rollback;
