-- Ejecutar tras 20261019210000_apartment_resident_management.sql.
-- Datos sintéticos; la transacción completa termina en ROLLBACK.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
  ('21000000-0000-4000-8000-000000000001','apartment-admin@resiq.invalid','{}'),
  ('21000000-0000-4000-8000-000000000002','apartment-resident@resiq.invalid','{}'),
  ('21000000-0000-4000-8000-000000000003','apartment-outsider@resiq.invalid','{}');
insert into public.properties(id,name,slug,created_by) values
  ('21100000-0000-4000-8000-000000000001','Apartment resident test','apartment-resident-test','21000000-0000-4000-8000-000000000001');
insert into public.property_members(id,property_id,user_id,roles,created_by) values
  ('21200000-0000-4000-8000-000000000001','21100000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001',array['administrator'],'21000000-0000-4000-8000-000000000001'),
  ('21200000-0000-4000-8000-000000000002','21100000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000002',array['member'],'21000000-0000-4000-8000-000000000001');
insert into public.buildings(id,property_id,name,code) values
  ('21300000-0000-4000-8000-000000000001','21100000-0000-4000-8000-000000000001','Torre A','A');
insert into public.units(id,property_id,building_id,code,floor) values
  ('21400000-0000-4000-8000-000000000001','21100000-0000-4000-8000-000000000001','21300000-0000-4000-8000-000000000001','101','1'),
  ('21400000-0000-4000-8000-000000000002','21100000-0000-4000-8000-000000000001','21300000-0000-4000-8000-000000000001','102','1');
insert into public.unit_memberships(id,property_id,unit_id,member_id,relationship,created_by) values
  ('21500000-0000-4000-8000-000000000001','21100000-0000-4000-8000-000000000001','21400000-0000-4000-8000-000000000001','21200000-0000-4000-8000-000000000002','resident','21000000-0000-4000-8000-000000000001'),
  ('21500000-0000-4000-8000-000000000002','21100000-0000-4000-8000-000000000001','21400000-0000-4000-8000-000000000002','21200000-0000-4000-8000-000000000002','resident','21000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"21000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $test$ begin
  begin
    perform public.end_unit_membership('21100000-0000-4000-8000-000000000001','21500000-0000-4000-8000-000000000001');
    raise exception 'unauthorized_change_accepted';
  exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

select set_config('request.jwt.claims','{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.update_apartment_relationship('21100000-0000-4000-8000-000000000001','21500000-0000-4000-8000-000000000001','owner');
do $test$ begin
  if (select relationship from public.unit_memberships where id='21500000-0000-4000-8000-000000000001') <> 'owner' then raise exception 'relationship_not_updated'; end if;
end $test$;
select public.end_unit_membership('21100000-0000-4000-8000-000000000001','21500000-0000-4000-8000-000000000001');
do $test$ begin
  if (select status from public.property_members where id='21200000-0000-4000-8000-000000000002') <> 'active' then raise exception 'other_apartment_access_lost'; end if;
end $test$;
select public.end_unit_membership('21100000-0000-4000-8000-000000000001','21500000-0000-4000-8000-000000000002');
do $test$ begin
  if (select status from public.property_members where id='21200000-0000-4000-8000-000000000002') <> 'suspended' then raise exception 'former_resident_still_active'; end if;
  if (select count(*) from public.unit_memberships where member_id='21200000-0000-4000-8000-000000000002' and valid_to is not null) <> 2 then raise exception 'history_was_removed'; end if;
end $test$;
reset role;

select set_config('request.jwt.claims','{"sub":"21000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $test$ begin
  if exists(select 1 from public.units where id='21400000-0000-4000-8000-000000000001') then raise exception 'inactive_resident_can_read_unit'; end if;
end $test$;
reset role;

select set_config('request.jwt.claims','{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','21000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.assign_apartment_resident('21100000-0000-4000-8000-000000000001','21400000-0000-4000-8000-000000000001','apartment-resident@resiq.invalid','resident');
do $test$ begin
  if length(public.assign_apartment_resident('21100000-0000-4000-8000-000000000001','21400000-0000-4000-8000-000000000002','new-apartment-resident@resiq.invalid','owner')) < 32 then raise exception 'new_resident_not_invited'; end if;
end $test$;
do $test$ begin
  if (select status from public.property_members where id='21200000-0000-4000-8000-000000000002') <> 'active' then raise exception 'resident_not_reactivated'; end if;
  if (select count(*) from public.unit_memberships where unit_id='21400000-0000-4000-8000-000000000001' and valid_to is null) <> 1 then raise exception 'resident_not_reassigned'; end if;
end $test$;
reset role;

-- La tabla de invitaciones no es legible por authenticated; inspección interna del test.
do $test$ begin
  if (select count(*) from public.invitations where property_id='21100000-0000-4000-8000-000000000001' and email_normalized='new-apartment-resident@resiq.invalid' and status='pending') <> 1 then raise exception 'invitation_not_recorded'; end if;
end $test$;

select 'apartment_resident_management_passed_rollback' as result;
rollback;
