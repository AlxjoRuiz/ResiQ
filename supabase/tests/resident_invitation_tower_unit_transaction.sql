-- Ejecutar después de 20261019220000_resident_invitation_tower_unit.sql.
-- Prueba sintética completa; ROLLBACK no deja datos ni invitaciones.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
  ('22000000-0000-4000-8000-000000000001','tower-invite-admin@resiq.invalid','{}'),
  ('22000000-0000-4000-8000-000000000002','tower-invite-existing@resiq.invalid','{}'),
  ('22000000-0000-4000-8000-000000000003','tower-invite-new@resiq.invalid','{}'),
  ('22000000-0000-4000-8000-000000000004','tower-invite-outsider@resiq.invalid','{}');
insert into public.properties(id,name,slug,created_by) values
  ('22100000-0000-4000-8000-000000000001','Tower invitation test','tower-invitation-test','22000000-0000-4000-8000-000000000001');
insert into public.property_members(id,property_id,user_id,roles,status,created_by) values
  ('22200000-0000-4000-8000-000000000001','22100000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001',array['administrator'],'active','22000000-0000-4000-8000-000000000001'),
  ('22200000-0000-4000-8000-000000000002','22100000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000002',array['member'],'suspended','22000000-0000-4000-8000-000000000001');
insert into public.buildings(id,property_id,name,code) values
  ('22300000-0000-4000-8000-000000000001','22100000-0000-4000-8000-000000000001','Torre A','A'),
  ('22300000-0000-4000-8000-000000000002','22100000-0000-4000-8000-000000000001','Torre B','B');
insert into public.units(id,property_id,building_id,code) values
  ('22400000-0000-4000-8000-000000000001','22100000-0000-4000-8000-000000000001','22300000-0000-4000-8000-000000000001','101'),
  ('22400000-0000-4000-8000-000000000002','22100000-0000-4000-8000-000000000001','22300000-0000-4000-8000-000000000002','201');

select set_config('request.jwt.claims','{"sub":"22000000-0000-4000-8000-000000000001","email":"tower-invite-admin@resiq.invalid","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $test$ begin
  begin
    perform public.create_resident_invitation('22100000-0000-4000-8000-000000000001','22300000-0000-4000-8000-000000000001','22400000-0000-4000-8000-000000000002','tower-invite-existing@resiq.invalid','resident');
    raise exception 'cross_tower_invitation_accepted';
  exception when others then if sqlerrm<>'unit_not_in_building' then raise; end if; end;
  begin
    perform public.create_resident_invitation('22100000-0000-4000-8000-000000000001','22300000-0000-4000-8000-000000000001',null,'tower-invite-existing@resiq.invalid','resident');
    raise exception 'missing_apartment_accepted';
  exception when others then if sqlerrm<>'unit_not_in_building' then raise; end if; end;
  perform set_config('tower_invite.existing_token',public.create_resident_invitation('22100000-0000-4000-8000-000000000001','22300000-0000-4000-8000-000000000001','22400000-0000-4000-8000-000000000001','tower-invite-existing@resiq.invalid','owner'),true);
  perform set_config('tower_invite.new_token',public.create_resident_invitation('22100000-0000-4000-8000-000000000001','22300000-0000-4000-8000-000000000002','22400000-0000-4000-8000-000000000002','tower-invite-new@resiq.invalid','resident'),true);
end $test$;
reset role;

select set_config('request.jwt.claims','{"sub":"22000000-0000-4000-8000-000000000002","email":"tower-invite-existing@resiq.invalid","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select public.accept_invitation(current_setting('tower_invite.existing_token'));
reset role;

select set_config('request.jwt.claims','{"sub":"22000000-0000-4000-8000-000000000003","email":"tower-invite-new@resiq.invalid","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.accept_invitation(current_setting('tower_invite.new_token'));
reset role;

select set_config('request.jwt.claims','{"sub":"22000000-0000-4000-8000-000000000001","email":"tower-invite-admin@resiq.invalid","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $test$ begin
  begin
    perform public.create_resident_invitation('22100000-0000-4000-8000-000000000001','22300000-0000-4000-8000-000000000001','22400000-0000-4000-8000-000000000001','tower-invite-existing@resiq.invalid','owner');
    raise exception 'duplicate_assignment_accepted';
  exception when others then if sqlerrm<>'already_assigned' then raise; end if; end;
end $test$;
reset role;

select set_config('request.jwt.claims','{"sub":"22000000-0000-4000-8000-000000000004","email":"tower-invite-outsider@resiq.invalid","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $test$ begin
  begin
    perform public.create_resident_invitation('22100000-0000-4000-8000-000000000001','22300000-0000-4000-8000-000000000001','22400000-0000-4000-8000-000000000001','tower-invite-outsider@resiq.invalid','resident');
    raise exception 'unauthorized_invitation_accepted';
  exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

do $test$ begin
  if (select status from public.property_members where id='22200000-0000-4000-8000-000000000002') <> 'active' then raise exception 'existing_resident_not_reactivated'; end if;
  if (select count(*) from public.unit_memberships where property_id='22100000-0000-4000-8000-000000000001' and valid_to is null) <> 2 then raise exception 'missing_or_duplicate_links'; end if;
  if (select count(*) from public.unit_memberships where unit_id='22400000-0000-4000-8000-000000000001' and relationship='owner') <> 1 then raise exception 'owner_relationship_missing'; end if;
  if has_function_privilege('authenticated','public.create_unit_membership(uuid,uuid,uuid,text)','execute') then raise exception 'direct_assignment_still_allowed'; end if;
end $test$;

select 'resident_invitation_tower_unit_passed_rollback' as result;
rollback;
