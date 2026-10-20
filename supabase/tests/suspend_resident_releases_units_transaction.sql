-- Datos sintéticos; termina en ROLLBACK y no modifica residentes reales.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
  ('23000000-0000-4000-8000-000000000001','suspend-admin@resiq.invalid','{}'),
  ('23000000-0000-4000-8000-000000000002','suspend-resident@resiq.invalid','{}'),
  ('23000000-0000-4000-8000-000000000003','suspend-outsider@resiq.invalid','{}');
insert into public.properties(id,name,slug,created_by) values
  ('23100000-0000-4000-8000-000000000001','Suspension test','suspension-test','23000000-0000-4000-8000-000000000001');
insert into public.property_members(id,property_id,user_id,roles,created_by) values
  ('23200000-0000-4000-8000-000000000001','23100000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001',array['administrator'],'23000000-0000-4000-8000-000000000001'),
  ('23200000-0000-4000-8000-000000000002','23100000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000002',array['member'],'23000000-0000-4000-8000-000000000001');
insert into public.buildings(id,property_id,name,code) values
  ('23300000-0000-4000-8000-000000000001','23100000-0000-4000-8000-000000000001','Torre A','A');
insert into public.units(id,property_id,building_id,code) values
  ('23400000-0000-4000-8000-000000000001','23100000-0000-4000-8000-000000000001','23300000-0000-4000-8000-000000000001','101');
insert into public.unit_memberships(id,property_id,unit_id,member_id,relationship,finance_access,created_by) values
  ('23500000-0000-4000-8000-000000000001','23100000-0000-4000-8000-000000000001','23400000-0000-4000-8000-000000000001','23200000-0000-4000-8000-000000000002','resident',true,'23000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"23000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $test$ begin
  begin
    perform public.manage_property_member('23100000-0000-4000-8000-000000000001','23200000-0000-4000-8000-000000000002',array['member'],'suspended');
    raise exception 'outsider_changed_resident';
  exception when others then if sqlerrm <> 'not_authorized' then raise; end if; end;
end $test$;
reset role;

select set_config('request.jwt.claims','{"sub":"23000000-0000-4000-8000-000000000001","email":"suspend-admin@resiq.invalid","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.manage_property_member('23100000-0000-4000-8000-000000000001','23200000-0000-4000-8000-000000000002',array['member'],'suspended');
do $test$ begin
  if (select status from public.property_members where id='23200000-0000-4000-8000-000000000002') <> 'suspended' then raise exception 'resident_not_suspended'; end if;
  if exists(select 1 from public.unit_memberships where member_id='23200000-0000-4000-8000-000000000002' and valid_to is null) then raise exception 'apartment_not_released'; end if;
  if (select count(*) from public.unit_memberships where member_id='23200000-0000-4000-8000-000000000002' and valid_to is not null) <> 1 then raise exception 'history_lost'; end if;
  begin
    perform public.manage_property_member('23100000-0000-4000-8000-000000000001','23200000-0000-4000-8000-000000000002',array['member'],'active');
    raise exception 'direct_reactivation_accepted';
  exception when others then if sqlerrm <> 'resident_requires_invitation' then raise; end if; end;
  perform set_config('suspend_test.token',public.create_resident_invitation('23100000-0000-4000-8000-000000000001','23300000-0000-4000-8000-000000000001','23400000-0000-4000-8000-000000000001','suspend-resident@resiq.invalid','resident'),true);
end $test$;
reset role;

select set_config('request.jwt.claims','{"sub":"23000000-0000-4000-8000-000000000002","email":"suspend-resident@resiq.invalid","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $test$ begin
  if exists(select 1 from public.units where id='23400000-0000-4000-8000-000000000001') then raise exception 'suspended_resident_can_read_unit'; end if;
end $test$;
select public.accept_invitation(current_setting('suspend_test.token'));
do $test$ begin
  if not exists(select 1 from public.units where id='23400000-0000-4000-8000-000000000001') then raise exception 'reactivated_resident_cannot_read_unit'; end if;
end $test$;
reset role;

do $test$ begin
  if (select status from public.property_members where id='23200000-0000-4000-8000-000000000002') <> 'active' then raise exception 'invitation_did_not_reactivate'; end if;
  if (select count(*) from public.unit_memberships where member_id='23200000-0000-4000-8000-000000000002' and valid_to is null) <> 1 then raise exception 'reactivation_link_count_wrong'; end if;
  if (select count(*) from public.unit_memberships where member_id='23200000-0000-4000-8000-000000000002') <> 2 then raise exception 'historical_link_missing'; end if;
end $test$;

select 'suspend_resident_releases_units_passed_rollback' as result;
rollback;
