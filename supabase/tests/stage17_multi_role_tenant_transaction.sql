-- Stage 17: one identity with different roles in separate properties.
-- Run the whole script in the ResiQ SQL Editor. Fixtures, package and notices roll back.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
 ('17a00000-0000-4000-8000-000000000001','stage17-multi-role@resiq.invalid','{}');

insert into public.properties(id,name,slug,created_by) values
 ('17a10000-0000-4000-8000-000000000001','Stage 17 multi-role admin','stage17-multi-role-admin','17a00000-0000-4000-8000-000000000001'),
 ('17a10000-0000-4000-8000-000000000002','Stage 17 multi-role concierge','stage17-multi-role-concierge','17a00000-0000-4000-8000-000000000001'),
 ('17a10000-0000-4000-8000-000000000003','Stage 17 multi-role unrelated','stage17-multi-role-unrelated','17a00000-0000-4000-8000-000000000001');

insert into public.property_members(id,property_id,user_id,roles,created_by) values
 ('17a20000-0000-4000-8000-000000000001','17a10000-0000-4000-8000-000000000001','17a00000-0000-4000-8000-000000000001',array['administrator'],'17a00000-0000-4000-8000-000000000001'),
 ('17a20000-0000-4000-8000-000000000002','17a10000-0000-4000-8000-000000000002','17a00000-0000-4000-8000-000000000001',array['member','concierge'],'17a00000-0000-4000-8000-000000000001');

insert into public.buildings(id,property_id,name,code) values
 ('17a30000-0000-4000-8000-000000000002','17a10000-0000-4000-8000-000000000002','Tower B','B');
insert into public.units(id,property_id,building_id,code) values
 ('17a40000-0000-4000-8000-000000000002','17a10000-0000-4000-8000-000000000002','17a30000-0000-4000-8000-000000000002','101');
insert into public.unit_memberships(id,property_id,unit_id,member_id,relationship,valid_from,created_by) values
 ('17a50000-0000-4000-8000-000000000002','17a10000-0000-4000-8000-000000000002','17a40000-0000-4000-8000-000000000002','17a20000-0000-4000-8000-000000000002','resident',now()-interval '1 day','17a00000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"17a00000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','17a00000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $test$
begin
 if not private.is_active_member('17a10000-0000-4000-8000-000000000001','administrator') then raise exception 'admin_a_missing'; end if;
 if private.is_active_member('17a10000-0000-4000-8000-000000000001','member') then raise exception 'member_role_leaked_into_a'; end if;
 if not private.is_active_member('17a10000-0000-4000-8000-000000000002','member') or not private.is_active_member('17a10000-0000-4000-8000-000000000002','concierge') then raise exception 'b_roles_missing'; end if;
 if private.is_active_member('17a10000-0000-4000-8000-000000000002','administrator') then raise exception 'admin_role_leaked_into_b'; end if;
 if private.is_active_member('17a10000-0000-4000-8000-000000000003') then raise exception 'unrelated_property_authorized'; end if;
 if (select count(*) from public.properties where id in ('17a10000-0000-4000-8000-000000000001','17a10000-0000-4000-8000-000000000002','17a10000-0000-4000-8000-000000000003')) <> 2 then raise exception 'property_rls_mismatch'; end if;
end $test$;

-- Administrative permission works in A but does not transfer to B.
do $test$
begin
 if public.create_invitation('17a10000-0000-4000-8000-000000000001','stage17-invite@resiq.invalid',array['member']) is null then raise exception 'admin_a_invitation_failed'; end if;
 begin
  perform public.create_invitation('17a10000-0000-4000-8000-000000000002','stage17-invite@resiq.invalid',array['member']);
  raise exception 'admin_permission_leaked_into_b';
 exception when others then if sqlerrm <> 'not_authorized' then raise; end if; end;
end $test$;

-- The B concierge role can register a package, but it cannot create a resident visit.
select set_config('stage17.multi_role_package',public.register_package('17a10000-0000-4000-8000-000000000002','17a40000-0000-4000-8000-000000000002',null,'Test recipient',null,null,null,null,'Stage 17 multi-role package',null)::text,true);
do $test$
begin
 if not exists(select 1 from public.packages where id=current_setting('stage17.multi_role_package')::uuid) then raise exception 'concierge_package_hidden'; end if;
 begin
  perform public.create_visit('17a10000-0000-4000-8000-000000000002','17a40000-0000-4000-8000-000000000002',null,'Test visitor','2020','personal','','',now()+interval '1 hour',now()+interval '2 hours',1,'','');
  raise exception 'concierge_member_created_visit';
 exception when others then if sqlerrm <> 'not_authorized' then raise; end if; end;
end $test$;
reset role;

-- Revoking only B immediately hides its property and package, without removing A.
update public.property_members set status='revoked',revoked_at=now()
where id='17a20000-0000-4000-8000-000000000002';
set local role authenticated;
do $test$
begin
 if not private.is_active_member('17a10000-0000-4000-8000-000000000001','administrator') then raise exception 'admin_a_lost_after_b_revocation'; end if;
 if private.is_active_member('17a10000-0000-4000-8000-000000000002') then raise exception 'b_still_active_after_revocation'; end if;
 if exists(select 1 from public.properties where id='17a10000-0000-4000-8000-000000000002') then raise exception 'revoked_property_visible'; end if;
 if exists(select 1 from public.packages where id=current_setting('stage17.multi_role_package')::uuid) then raise exception 'revoked_package_visible'; end if;
 if not exists(select 1 from public.properties where id='17a10000-0000-4000-8000-000000000001') then raise exception 'admin_property_hidden'; end if;
end $test$;
reset role;

select 'stage17_multi_role_tenant_passed_rollback' as result;
rollback;
