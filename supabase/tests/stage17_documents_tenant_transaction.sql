-- Stage 17: document metadata and upload preparation respect role and property.
-- Run the entire script in the ResiQ SQL Editor. All synthetic rows roll back.
-- This does not upload bytes to Storage or validate the HTTP download routes.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
 ('1d000000-0000-4000-8000-000000000001','stage17-docs-admin-a@resiq.invalid','{}'),
 ('1d000000-0000-4000-8000-000000000002','stage17-docs-admin-b@resiq.invalid','{}'),
 ('1d000000-0000-4000-8000-000000000003','stage17-docs-resident-a@resiq.invalid','{}'),
 ('1d000000-0000-4000-8000-000000000004','stage17-docs-concierge-a@resiq.invalid','{}');
insert into public.properties(id,name,slug,created_by) values
 ('1d100000-0000-4000-8000-000000000001','Stage 17 docs A','stage17-docs-a','1d000000-0000-4000-8000-000000000001'),
 ('1d100000-0000-4000-8000-000000000002','Stage 17 docs B','stage17-docs-b','1d000000-0000-4000-8000-000000000002');
insert into public.property_members(id,property_id,user_id,roles,created_by) values
 ('1d200000-0000-4000-8000-000000000001','1d100000-0000-4000-8000-000000000001','1d000000-0000-4000-8000-000000000001',array['administrator'],'1d000000-0000-4000-8000-000000000001'),
 ('1d200000-0000-4000-8000-000000000002','1d100000-0000-4000-8000-000000000002','1d000000-0000-4000-8000-000000000002',array['administrator'],'1d000000-0000-4000-8000-000000000002'),
 ('1d200000-0000-4000-8000-000000000003','1d100000-0000-4000-8000-000000000001','1d000000-0000-4000-8000-000000000003',array['member'],'1d000000-0000-4000-8000-000000000001'),
 ('1d200000-0000-4000-8000-000000000004','1d100000-0000-4000-8000-000000000001','1d000000-0000-4000-8000-000000000004',array['concierge'],'1d000000-0000-4000-8000-000000000001');
insert into public.buildings(id,property_id,name,code) values
 ('1d300000-0000-4000-8000-000000000001','1d100000-0000-4000-8000-000000000001','Tower A','A');
insert into public.units(id,property_id,building_id,code) values
 ('1d400000-0000-4000-8000-000000000001','1d100000-0000-4000-8000-000000000001','1d300000-0000-4000-8000-000000000001','101');
insert into public.unit_memberships(id,property_id,unit_id,member_id,relationship,finance_access,valid_from,created_by) values
 ('1d500000-0000-4000-8000-000000000001','1d100000-0000-4000-8000-000000000001','1d400000-0000-4000-8000-000000000001','1d200000-0000-4000-8000-000000000003','resident',false,now()-interval '1 day','1d000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"1d000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','1d000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select set_config('stage17.docs_pqrs',public.create_pqrs('1d100000-0000-4000-8000-000000000001','1d400000-0000-4000-8000-000000000001','cleaning','request','Stage 17 documents PQRS','Synthetic document access case.')::text,true);
reset role;

select set_config('request.jwt.claims','{"sub":"1d000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','1d000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_config('stage17.docs_call',public.create_attention_call('1d100000-0000-4000-8000-000000000001','1d400000-0000-4000-8000-000000000001','noise','Stage 17 documents call','Synthetic document access case.',current_date,array['1d200000-0000-4000-8000-000000000003']::uuid[])::text,true);
select set_config('stage17.docs_assembly',public.create_assembly('1d100000-0000-4000-8000-000000000001','ordinary','Stage 17 documents assembly','Synthetic assembly.',now()+interval '10 days','Room A',jsonb_build_array(jsonb_build_object('title','Test agenda')),jsonb_build_array(jsonb_build_object('member_id','1d200000-0000-4000-8000-000000000003','unit_id','1d400000-0000-4000-8000-000000000001')))::text,true);
select public.publish_assembly(current_setting('stage17.docs_assembly')::uuid);
reset role;

-- Metadata fixtures only: no Storage objects or signed URLs are created.
insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,status,pqrs_id) values
 ('1d600000-0000-4000-8000-000000000001','1d100000-0000-4000-8000-000000000001','stage17-docs-a/pqrs-test.png','pqrs-test.png','image/png',68,'1d000000-0000-4000-8000-000000000003','available',current_setting('stage17.docs_pqrs')::uuid);
insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,status,attention_call_id) values
 ('1d600000-0000-4000-8000-000000000002','1d100000-0000-4000-8000-000000000001','stage17-docs-a/call-test.png','call-test.png','image/png',68,'1d000000-0000-4000-8000-000000000001','available',current_setting('stage17.docs_call')::uuid);
insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,status,assembly_id,document_kind) values
 ('1d600000-0000-4000-8000-000000000003','1d100000-0000-4000-8000-000000000001','stage17-docs-a/assembly-test.png','assembly-test.png','image/png',68,'1d000000-0000-4000-8000-000000000001','available',current_setting('stage17.docs_assembly')::uuid,'support');

-- Administrator A sees all three; administrator B sees none and cannot prepare uploads in A.
select set_config('request.jwt.claims','{"sub":"1d000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','1d000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $test$ begin
 if (select count(*) from public.documents where id in ('1d600000-0000-4000-8000-000000000001','1d600000-0000-4000-8000-000000000002','1d600000-0000-4000-8000-000000000003'))<>3 then raise exception 'admin_a_documents_hidden'; end if;
 perform public.prepare_attention_call_document(current_setting('stage17.docs_call')::uuid,'admin-call-upload.png','image/png',68);
 perform public.prepare_assembly_document(current_setting('stage17.docs_assembly')::uuid,null,'support','admin-assembly-upload.png','image/png',68);
 if (select count(*) from public.documents where uploaded_by=auth.uid() and status='pending' and original_name in ('admin-call-upload.png','admin-assembly-upload.png'))<>2 then raise exception 'admin_a_upload_preparation_failed'; end if;
end $test$;
reset role;

select set_config('request.jwt.claims','{"sub":"1d000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','1d000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $test$ begin
 if exists(select 1 from public.documents where id in ('1d600000-0000-4000-8000-000000000001','1d600000-0000-4000-8000-000000000002','1d600000-0000-4000-8000-000000000003')) then raise exception 'admin_b_cross_property_documents_visible'; end if;
 begin
  perform public.prepare_pqrs_document(current_setting('stage17.docs_pqrs')::uuid,null,'wrong-property.png','image/png',68);
  raise exception 'admin_b_pqrs_upload_allowed';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 begin
  perform public.prepare_attention_call_document(current_setting('stage17.docs_call')::uuid,'wrong-property.png','image/png',68);
  raise exception 'admin_b_call_upload_allowed';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 begin
  perform public.prepare_assembly_document(current_setting('stage17.docs_assembly')::uuid,null,'support','wrong-property.png','image/png',68);
  raise exception 'admin_b_assembly_upload_allowed';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

-- Resident A can read all three relevant documents, but cannot prepare administrator uploads.
select set_config('request.jwt.claims','{"sub":"1d000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','1d000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $test$ begin
 if (select count(*) from public.documents where id in ('1d600000-0000-4000-8000-000000000001','1d600000-0000-4000-8000-000000000002','1d600000-0000-4000-8000-000000000003'))<>3 then raise exception 'resident_a_documents_hidden'; end if;
 perform public.prepare_pqrs_document(current_setting('stage17.docs_pqrs')::uuid,null,'resident-pqrs-upload.png','image/png',68);
 if not exists(select 1 from public.documents where uploaded_by=auth.uid() and status='pending' and original_name='resident-pqrs-upload.png') then raise exception 'resident_a_pqrs_upload_preparation_failed'; end if;
 begin
  perform public.prepare_attention_call_document(current_setting('stage17.docs_call')::uuid,'resident-cannot-upload.png','image/png',68);
  raise exception 'resident_call_upload_allowed';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 begin
  perform public.prepare_assembly_document(current_setting('stage17.docs_assembly')::uuid,null,'support','resident-cannot-upload.png','image/png',68);
  raise exception 'resident_assembly_upload_allowed';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

-- Concierge A has property access, but not private case documents or upload preparation.
select set_config('request.jwt.claims','{"sub":"1d000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','1d000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $test$ begin
 if exists(select 1 from public.documents where id in ('1d600000-0000-4000-8000-000000000001','1d600000-0000-4000-8000-000000000002','1d600000-0000-4000-8000-000000000003')) then raise exception 'concierge_private_documents_visible'; end if;
 begin
  perform public.prepare_pqrs_document(current_setting('stage17.docs_pqrs')::uuid,null,'concierge-cannot-upload.png','image/png',68);
  raise exception 'concierge_pqrs_upload_allowed';
 exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
end $test$;
reset role;

select 'stage17_documents_tenant_passed_rollback' as result;
rollback;
