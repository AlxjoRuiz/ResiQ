-- Stage 17: package and visit reads/actions must stay inside their property.
-- Run the entire script in the ResiQ SQL Editor. All fixtures and queued notices roll back.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
 ('17400000-0000-4000-8000-000000000001','stage17-admin-a@resiq.invalid','{}'),
 ('17400000-0000-4000-8000-000000000002','stage17-admin-b@resiq.invalid','{}'),
 ('17400000-0000-4000-8000-000000000003','stage17-concierge-a@resiq.invalid','{}'),
 ('17400000-0000-4000-8000-000000000004','stage17-resident-a2@resiq.invalid','{}'),
 ('17400000-0000-4000-8000-000000000005','stage17-resident-b2@resiq.invalid','{}');

insert into public.properties(id,name,slug,created_by) values
 ('17500000-0000-4000-8000-000000000001','Stage 17 packages A','stage17-packages-visits-a','17400000-0000-4000-8000-000000000001'),
 ('17500000-0000-4000-8000-000000000002','Stage 17 packages B','stage17-packages-visits-b','17400000-0000-4000-8000-000000000002');

insert into public.property_members(id,property_id,user_id,roles,created_by) values
 ('17600000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000001','17400000-0000-4000-8000-000000000001',array['administrator'],'17400000-0000-4000-8000-000000000001'),
 ('17600000-0000-4000-8000-000000000002','17500000-0000-4000-8000-000000000002','17400000-0000-4000-8000-000000000002',array['administrator'],'17400000-0000-4000-8000-000000000002'),
 ('17600000-0000-4000-8000-000000000003','17500000-0000-4000-8000-000000000001','17400000-0000-4000-8000-000000000003',array['concierge'],'17400000-0000-4000-8000-000000000001'),
 ('17600000-0000-4000-8000-000000000004','17500000-0000-4000-8000-000000000001','17400000-0000-4000-8000-000000000004',array['member'],'17400000-0000-4000-8000-000000000001'),
 ('17600000-0000-4000-8000-000000000005','17500000-0000-4000-8000-000000000002','17400000-0000-4000-8000-000000000005',array['member'],'17400000-0000-4000-8000-000000000002');

insert into public.buildings(id,property_id,name,code) values
 ('17700000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000001','Tower A','A'),
 ('17700000-0000-4000-8000-000000000002','17500000-0000-4000-8000-000000000002','Tower B','B');
insert into public.units(id,property_id,building_id,code) values
 ('17800000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000001','17700000-0000-4000-8000-000000000001','101'),
 ('17800000-0000-4000-8000-000000000002','17500000-0000-4000-8000-000000000002','17700000-0000-4000-8000-000000000002','101');
insert into public.unit_memberships(id,property_id,unit_id,member_id,relationship,finance_access,valid_from,created_by) values
 ('17900000-0000-4000-8000-000000000001','17500000-0000-4000-8000-000000000001','17800000-0000-4000-8000-000000000001','17600000-0000-4000-8000-000000000004','resident',false,now()-interval '1 day','17400000-0000-4000-8000-000000000001'),
 ('17900000-0000-4000-8000-000000000002','17500000-0000-4000-8000-000000000002','17800000-0000-4000-8000-000000000002','17600000-0000-4000-8000-000000000005','resident',false,now()-interval '1 day','17400000-0000-4000-8000-000000000002');

select set_config('request.jwt.claims','{"sub":"17400000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17400000-0000-4000-8000-000000000003',true);
set local role authenticated;
select set_config('stage17.package_a',public.register_package('17500000-0000-4000-8000-000000000001','17800000-0000-4000-8000-000000000001',null,'Test resident',null,null,null,null,'Stage 17 package A',null)::text,true);
reset role;

select set_config('request.jwt.claims','{"sub":"17400000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17400000-0000-4000-8000-000000000002',true);
set local role authenticated;
select set_config('stage17.package_b',public.register_package('17500000-0000-4000-8000-000000000002','17800000-0000-4000-8000-000000000002',null,'Test resident',null,null,null,null,'Stage 17 package B',null)::text,true);
reset role;

select set_config('request.jwt.claims','{"sub":"17400000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17400000-0000-4000-8000-000000000004',true);
set local role authenticated;
select set_config('stage17.visit_a',public.create_visit('17500000-0000-4000-8000-000000000001','17800000-0000-4000-8000-000000000001',null,'Visitor A','2020','personal','','',now()+interval '1 hour',now()+interval '2 hours',1,'Stage 17 visit A','')::text,true);
reset role;

select set_config('request.jwt.claims','{"sub":"17400000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17400000-0000-4000-8000-000000000005',true);
set local role authenticated;
select set_config('stage17.visit_b',public.create_visit('17500000-0000-4000-8000-000000000002','17800000-0000-4000-8000-000000000002',null,'Visitor B','2020','personal','','',now()+interval '1 hour',now()+interval '2 hours',1,'Stage 17 visit B','')::text,true);
reset role;

-- Concierge A can read its package, but neither package nor visit from B.
select set_config('request.jwt.claims','{"sub":"17400000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17400000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $test$
begin
 if not exists(select 1 from public.packages where id=current_setting('stage17.package_a')::uuid) then raise exception 'concierge_own_package_hidden'; end if;
 if exists(select 1 from public.packages where id=current_setting('stage17.package_b')::uuid) then raise exception 'concierge_foreign_package_visible'; end if;
 if exists(select 1 from public.visitors where id=current_setting('stage17.visit_b')::uuid) then raise exception 'concierge_foreign_visit_visible'; end if;
 begin
  perform public.register_package('17500000-0000-4000-8000-000000000002','17800000-0000-4000-8000-000000000002',null,'Wrong property',null,null,null,null,'Unauthorized package',null);
  raise exception 'cross_property_package_registered';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 begin
  perform public.register_visit_entry(current_setting('stage17.visit_b')::uuid,'');
  raise exception 'cross_property_visit_entry_registered';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

-- Administrator A cannot deliver B's package or decide B's visit.
select set_config('request.jwt.claims','{"sub":"17400000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17400000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $test$
begin
 if exists(select 1 from public.packages where id=current_setting('stage17.package_b')::uuid) then raise exception 'admin_foreign_package_visible'; end if;
 if exists(select 1 from public.visitors where id=current_setting('stage17.visit_b')::uuid) then raise exception 'admin_foreign_visit_visible'; end if;
 begin
  perform public.deliver_package(current_setting('stage17.package_b')::uuid,'Wrong collector');
  raise exception 'cross_property_package_delivered';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 begin
  perform public.review_visit(current_setting('stage17.visit_b')::uuid,true,'');
  raise exception 'cross_property_visit_reviewed';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

-- Resident A cannot create a visit using B's property, unit or host.
select set_config('request.jwt.claims','{"sub":"17400000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17400000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $test$
begin
 if not exists(select 1 from public.visitors where id=current_setting('stage17.visit_a')::uuid) then raise exception 'resident_own_visit_hidden'; end if;
 if exists(select 1 from public.visitors where id=current_setting('stage17.visit_b')::uuid) then raise exception 'resident_foreign_visit_visible'; end if;
 begin
  perform public.create_visit('17500000-0000-4000-8000-000000000002','17800000-0000-4000-8000-000000000002',null,'Wrong visitor','2020','personal','','',now()+interval '1 hour',now()+interval '2 hours',1,'','');
  raise exception 'cross_property_visit_created';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

select 'stage17_packages_visits_cross_property_passed_rollback' as result;
rollback;
