-- Stage 17: PQRS, attention calls and assemblies remain inside their property.
-- Run the entire script in the ResiQ SQL Editor. All fixtures and queued notices roll back.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
 ('19000000-0000-4000-8000-000000000001','stage17-cases-admin-a@resiq.invalid','{}'),
 ('19000000-0000-4000-8000-000000000002','stage17-cases-admin-b@resiq.invalid','{}'),
 ('19000000-0000-4000-8000-000000000003','stage17-cases-resident-a@resiq.invalid','{}'),
 ('19000000-0000-4000-8000-000000000004','stage17-cases-resident-b@resiq.invalid','{}');
insert into public.properties(id,name,slug,created_by) values
 ('19100000-0000-4000-8000-000000000001','Stage 17 cases A','stage17-cases-a','19000000-0000-4000-8000-000000000001'),
 ('19100000-0000-4000-8000-000000000002','Stage 17 cases B','stage17-cases-b','19000000-0000-4000-8000-000000000002');
insert into public.property_members(id,property_id,user_id,roles,created_by) values
 ('19200000-0000-4000-8000-000000000001','19100000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000001',array['administrator'],'19000000-0000-4000-8000-000000000001'),
 ('19200000-0000-4000-8000-000000000002','19100000-0000-4000-8000-000000000002','19000000-0000-4000-8000-000000000002',array['administrator'],'19000000-0000-4000-8000-000000000002'),
 ('19200000-0000-4000-8000-000000000003','19100000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000003',array['member'],'19000000-0000-4000-8000-000000000001'),
 ('19200000-0000-4000-8000-000000000004','19100000-0000-4000-8000-000000000002','19000000-0000-4000-8000-000000000004',array['member'],'19000000-0000-4000-8000-000000000002');
insert into public.buildings(id,property_id,name,code) values
 ('19300000-0000-4000-8000-000000000001','19100000-0000-4000-8000-000000000001','Tower A','A'),
 ('19300000-0000-4000-8000-000000000002','19100000-0000-4000-8000-000000000002','Tower B','B');
insert into public.units(id,property_id,building_id,code) values
 ('19400000-0000-4000-8000-000000000001','19100000-0000-4000-8000-000000000001','19300000-0000-4000-8000-000000000001','101'),
 ('19400000-0000-4000-8000-000000000002','19100000-0000-4000-8000-000000000002','19300000-0000-4000-8000-000000000002','101');
insert into public.unit_memberships(id,property_id,unit_id,member_id,relationship,finance_access,valid_from,created_by) values
 ('19500000-0000-4000-8000-000000000001','19100000-0000-4000-8000-000000000001','19400000-0000-4000-8000-000000000001','19200000-0000-4000-8000-000000000003','resident',false,now()-interval '1 day','19000000-0000-4000-8000-000000000001'),
 ('19500000-0000-4000-8000-000000000002','19100000-0000-4000-8000-000000000002','19400000-0000-4000-8000-000000000002','19200000-0000-4000-8000-000000000004','resident',false,now()-interval '1 day','19000000-0000-4000-8000-000000000002');

select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select set_config('stage17.pqrs_a',public.create_pqrs('19100000-0000-4000-8000-000000000001','19400000-0000-4000-8000-000000000001','cleaning','request','Stage 17 PQRS A','Description for the synthetic PQRS A.')::text,true);
reset role;
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000004',true);
set local role authenticated;
select set_config('stage17.pqrs_b',public.create_pqrs('19100000-0000-4000-8000-000000000002','19400000-0000-4000-8000-000000000002','cleaning','request','Stage 17 PQRS B','Description for the synthetic PQRS B.')::text,true);
reset role;

select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_config('stage17.call_a',public.create_attention_call('19100000-0000-4000-8000-000000000001','19400000-0000-4000-8000-000000000001','noise','Stage 17 reason A','Description for synthetic attention call A.',current_date,array['19200000-0000-4000-8000-000000000003']::uuid[])::text,true);
select set_config('stage17.assembly_a',public.create_assembly('19100000-0000-4000-8000-000000000001','ordinary','Stage 17 assembly A','Synthetic assembly.',now()+interval '10 days','Room A',jsonb_build_array(jsonb_build_object('title','Test agenda A')),jsonb_build_array(jsonb_build_object('member_id','19200000-0000-4000-8000-000000000003','unit_id','19400000-0000-4000-8000-000000000001')))::text,true);
select public.publish_assembly(current_setting('stage17.assembly_a')::uuid);
reset role;

select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select set_config('stage17.call_b',public.create_attention_call('19100000-0000-4000-8000-000000000002','19400000-0000-4000-8000-000000000002','noise','Stage 17 reason B','Description for synthetic attention call B.',current_date,array['19200000-0000-4000-8000-000000000004']::uuid[])::text,true);
select set_config('stage17.assembly_b',public.create_assembly('19100000-0000-4000-8000-000000000002','ordinary','Stage 17 assembly B','Synthetic assembly.',now()+interval '10 days','Room B',jsonb_build_array(jsonb_build_object('title','Test agenda B')),jsonb_build_array(jsonb_build_object('member_id','19200000-0000-4000-8000-000000000004','unit_id','19400000-0000-4000-8000-000000000002')))::text,true);
select public.publish_assembly(current_setting('stage17.assembly_b')::uuid);
reset role;

-- Resident A can read its cases but not B's, and cannot create or mark a B case.
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $test$
begin
 if not exists(select 1 from public.pqrs where id=current_setting('stage17.pqrs_a')::uuid) then raise exception 'own_pqrs_hidden'; end if;
 if not exists(select 1 from public.attention_calls where id=current_setting('stage17.call_a')::uuid) then raise exception 'own_attention_call_hidden'; end if;
 if not exists(select 1 from public.assemblies where id=current_setting('stage17.assembly_a')::uuid) then raise exception 'own_assembly_hidden'; end if;
 if exists(select 1 from public.pqrs where id=current_setting('stage17.pqrs_b')::uuid) then raise exception 'foreign_pqrs_visible'; end if;
 if exists(select 1 from public.attention_calls where id=current_setting('stage17.call_b')::uuid) then raise exception 'foreign_attention_call_visible'; end if;
 if exists(select 1 from public.assemblies where id=current_setting('stage17.assembly_b')::uuid) then raise exception 'foreign_assembly_visible'; end if;
 begin
  perform public.create_pqrs('19100000-0000-4000-8000-000000000002','19400000-0000-4000-8000-000000000002','cleaning','request','Wrong property','Unauthorized synthetic PQRS request.');
  raise exception 'foreign_pqrs_created';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 begin
  perform public.mark_attention_call_read(current_setting('stage17.call_b')::uuid);
  raise exception 'foreign_attention_call_marked_read';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 begin
  perform public.set_assembly_rsvp(current_setting('stage17.assembly_b')::uuid,'yes');
  raise exception 'foreign_assembly_rsvp_saved';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

-- Administrator A cannot read or change B's cases, even using exact IDs.
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $test$
begin
 if exists(select 1 from public.pqrs where id=current_setting('stage17.pqrs_b')::uuid) then raise exception 'admin_foreign_pqrs_visible'; end if;
 if exists(select 1 from public.attention_calls where id=current_setting('stage17.call_b')::uuid) then raise exception 'admin_foreign_attention_call_visible'; end if;
 if exists(select 1 from public.assemblies where id=current_setting('stage17.assembly_b')::uuid) then raise exception 'admin_foreign_assembly_visible'; end if;
 begin
  perform public.change_pqrs_status(current_setting('stage17.pqrs_b')::uuid,'in_review');
  raise exception 'foreign_pqrs_changed';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 begin
  perform public.change_attention_call_status(current_setting('stage17.call_b')::uuid,'in_review','Unauthorized note');
  raise exception 'foreign_attention_call_changed';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 begin
  perform public.create_attention_call('19100000-0000-4000-8000-000000000002','19400000-0000-4000-8000-000000000002','noise','Wrong property','Unauthorized synthetic attention call.',current_date,array['19200000-0000-4000-8000-000000000004']::uuid[]);
  raise exception 'foreign_attention_call_created';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 begin
  perform public.publish_assembly(current_setting('stage17.assembly_b')::uuid);
  raise exception 'foreign_assembly_published';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

select 'stage17_pqrs_calls_assemblies_cross_property_passed_rollback' as result;
rollback;
