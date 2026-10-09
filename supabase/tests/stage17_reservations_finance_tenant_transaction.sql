-- Stage 17: reservations and finance cannot cross property boundaries.
-- Run the entire script in the ResiQ SQL Editor. All fixtures and queued notices roll back.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
 ('18000000-0000-4000-8000-000000000001','stage17-resfin-admin-a@resiq.invalid','{}'),
 ('18000000-0000-4000-8000-000000000002','stage17-resfin-admin-b@resiq.invalid','{}'),
 ('18000000-0000-4000-8000-000000000003','stage17-resfin-resident-a@resiq.invalid','{}'),
 ('18000000-0000-4000-8000-000000000004','stage17-resfin-resident-b@resiq.invalid','{}');
insert into public.properties(id,name,slug,created_by) values
 ('18100000-0000-4000-8000-000000000001','Stage 17 resfin A','stage17-resfin-a','18000000-0000-4000-8000-000000000001'),
 ('18100000-0000-4000-8000-000000000002','Stage 17 resfin B','stage17-resfin-b','18000000-0000-4000-8000-000000000002');
insert into public.property_members(id,property_id,user_id,roles,created_by) values
 ('18200000-0000-4000-8000-000000000001','18100000-0000-4000-8000-000000000001','18000000-0000-4000-8000-000000000001',array['administrator'],'18000000-0000-4000-8000-000000000001'),
 ('18200000-0000-4000-8000-000000000002','18100000-0000-4000-8000-000000000002','18000000-0000-4000-8000-000000000002',array['administrator'],'18000000-0000-4000-8000-000000000002'),
 ('18200000-0000-4000-8000-000000000003','18100000-0000-4000-8000-000000000001','18000000-0000-4000-8000-000000000003',array['member'],'18000000-0000-4000-8000-000000000001'),
 ('18200000-0000-4000-8000-000000000004','18100000-0000-4000-8000-000000000002','18000000-0000-4000-8000-000000000004',array['member'],'18000000-0000-4000-8000-000000000002');
insert into public.buildings(id,property_id,name,code) values
 ('18300000-0000-4000-8000-000000000001','18100000-0000-4000-8000-000000000001','Tower A','A'),
 ('18300000-0000-4000-8000-000000000002','18100000-0000-4000-8000-000000000002','Tower B','B');
insert into public.units(id,property_id,building_id,code) values
 ('18400000-0000-4000-8000-000000000001','18100000-0000-4000-8000-000000000001','18300000-0000-4000-8000-000000000001','101'),
 ('18400000-0000-4000-8000-000000000002','18100000-0000-4000-8000-000000000002','18300000-0000-4000-8000-000000000002','101');
insert into public.unit_memberships(id,property_id,unit_id,member_id,relationship,finance_access,valid_from,created_by) values
 ('18500000-0000-4000-8000-000000000001','18100000-0000-4000-8000-000000000001','18400000-0000-4000-8000-000000000001','18200000-0000-4000-8000-000000000003','owner',true,now()-interval '1 day','18000000-0000-4000-8000-000000000001'),
 ('18500000-0000-4000-8000-000000000002','18100000-0000-4000-8000-000000000002','18400000-0000-4000-8000-000000000002','18200000-0000-4000-8000-000000000004','owner',true,now()-interval '1 day','18000000-0000-4000-8000-000000000002');

insert into public.amenities(id,property_id,name,capacity,requires_approval,slot_minutes,created_by) values
 ('18600000-0000-4000-8000-000000000001','18100000-0000-4000-8000-000000000001','Stage 17 room A',10,true,60,'18000000-0000-4000-8000-000000000001'),
 ('18600000-0000-4000-8000-000000000002','18100000-0000-4000-8000-000000000002','Stage 17 room B',10,true,60,'18000000-0000-4000-8000-000000000002');
insert into public.amenity_hours(property_id,amenity_id,weekday,opens_at,closes_at)
select a.property_id,a.id,day,'08:00'::time,'18:00'::time
from public.amenities a cross join generate_series(1,7) day
where a.id in ('18600000-0000-4000-8000-000000000001','18600000-0000-4000-8000-000000000002');

select set_config('request.jwt.claims','{"sub":"18000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_config('stage17.debt_a',public.create_receivable('18100000-0000-4000-8000-000000000001','18400000-0000-4000-8000-000000000001','Stage 17 debt A',2000,current_date,current_date+20,null)::text,true);
reset role;
select set_config('request.jwt.claims','{"sub":"18000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select set_config('stage17.debt_b',public.create_receivable('18100000-0000-4000-8000-000000000002','18400000-0000-4000-8000-000000000002','Stage 17 debt B',2000,current_date,current_date+20,null)::text,true);
select set_config('stage17.payment_b',public.record_payment('18100000-0000-4000-8000-000000000002','18400000-0000-4000-8000-000000000002',500,current_date,'STAGE17-B',jsonb_build_array(jsonb_build_object('receivable_id',current_setting('stage17.debt_b')::uuid,'amount',500)),gen_random_uuid())::text,true);
reset role;

select set_config('request.jwt.claims','{"sub":"18000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select set_config('stage17.reservation_a',public.create_reservation('18100000-0000-4000-8000-000000000001','18600000-0000-4000-8000-000000000001','18400000-0000-4000-8000-000000000001',(current_date+10)::timestamp+interval '10 hours',(current_date+10)::timestamp+interval '11 hours',1,gen_random_uuid())::text,true);
reset role;
select set_config('request.jwt.claims','{"sub":"18000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000004',true);
set local role authenticated;
select set_config('stage17.reservation_b',public.create_reservation('18100000-0000-4000-8000-000000000002','18600000-0000-4000-8000-000000000002','18400000-0000-4000-8000-000000000002',(current_date+10)::timestamp+interval '10 hours',(current_date+10)::timestamp+interval '11 hours',1,gen_random_uuid())::text,true);
reset role;

-- Resident A sees its own account and reservation, not B's IDs or amenities.
select set_config('request.jwt.claims','{"sub":"18000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $test$
begin
 if not exists(select 1 from public.accounts_receivable where id=current_setting('stage17.debt_a')::uuid) then raise exception 'own_debt_hidden'; end if;
 if not exists(select 1 from public.reservations where id=current_setting('stage17.reservation_a')::uuid) then raise exception 'own_reservation_hidden'; end if;
 if exists(select 1 from public.accounts_receivable where id=current_setting('stage17.debt_b')::uuid) then raise exception 'foreign_debt_visible'; end if;
 if exists(select 1 from public.payments where id=current_setting('stage17.payment_b')::uuid) then raise exception 'foreign_payment_visible'; end if;
 if exists(select 1 from public.reservations where id=current_setting('stage17.reservation_b')::uuid) then raise exception 'foreign_reservation_visible'; end if;
 if exists(select 1 from public.amenities where id='18600000-0000-4000-8000-000000000002') then raise exception 'foreign_amenity_visible'; end if;
 begin
  perform public.create_reservation('18100000-0000-4000-8000-000000000002','18600000-0000-4000-8000-000000000002','18400000-0000-4000-8000-000000000002',(current_date+11)::timestamp+interval '10 hours',(current_date+11)::timestamp+interval '11 hours',1,gen_random_uuid());
  raise exception 'foreign_reservation_created';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

-- Admin A cannot operate B's records, even by their exact IDs.
select set_config('request.jwt.claims','{"sub":"18000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $test$
begin
 if exists(select 1 from public.accounts_receivable where id=current_setting('stage17.debt_b')::uuid) then raise exception 'admin_foreign_debt_visible'; end if;
 if exists(select 1 from public.reservations where id=current_setting('stage17.reservation_b')::uuid) then raise exception 'admin_foreign_reservation_visible'; end if;
 begin
  perform public.void_receivable(current_setting('stage17.debt_b')::uuid,'Unauthorized void');
  raise exception 'foreign_debt_voided';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 begin
  perform public.decide_reservation(current_setting('stage17.reservation_b')::uuid,true,'');
  raise exception 'foreign_reservation_decided';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 begin
  perform public.record_payment('18100000-0000-4000-8000-000000000002','18400000-0000-4000-8000-000000000002',100,current_date,'WRONG-PROPERTY','[]'::jsonb,gen_random_uuid());
  raise exception 'foreign_property_payment_recorded';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

-- Admin B cannot allocate a B payment to a debt from A.
select set_config('request.jwt.claims','{"sub":"18000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $test$
begin
 if not exists(select 1 from public.payments where id=current_setting('stage17.payment_b')::uuid) then raise exception 'own_payment_hidden'; end if;
 begin
  perform public.record_payment('18100000-0000-4000-8000-000000000002','18400000-0000-4000-8000-000000000002',100,current_date,'CROSS-DEBT',jsonb_build_array(jsonb_build_object('receivable_id',current_setting('stage17.debt_a')::uuid,'amount',100)),gen_random_uuid());
  raise exception 'foreign_debt_allocated';
 exception when others then if sqlerrm<>'invalid_receivable' then raise; end if; end;
end $test$;
reset role;

select 'stage17_reservations_finance_cross_property_passed_rollback' as result;
rollback;
