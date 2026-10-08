\ir security_fixture.sql
insert into public.pqrs(id,property_id,unit_id,author_member_id,category,subject,description) values('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','security','Quota regression','Synthetic quota regression only');
insert into public.pqrs_messages(id,property_id,pqrs_id,author_member_id,body) values('70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','Synthetic reply');
insert into public.documents(property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,status,pqrs_id,pqrs_message_id)
select '20000000-0000-4000-8000-000000000001', 'quota-test/'||s,'test.png','image/png',68,'10000000-0000-4000-8000-000000000002',s,case when s<>'pending' then '70000000-0000-4000-8000-000000000001'::uuid end,case when s='pending' then '70000000-0000-4000-8000-000000000002'::uuid end from unnest(array['pending','available','rejected','deleted']) s;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 if public.pqrs_attachment_slots_used('70000000-0000-4000-8000-000000000001')<>3 then raise exception 'quota_must_include_pending_rejected_and_messages'; end if;
 if exists(select 1 from public.documents where status='rejected') then raise exception 'rejected_document_exposed'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare denied boolean:=false; begin
 begin perform public.pqrs_attachment_slots_used('70000000-0000-4000-8000-000000000001'); exception when others then denied:=sqlerrm='not_authorized'; end;
 if not denied then raise exception 'unrelated_member_can_count'; end if;
end $$;
reset role;
select 'pqrs_attachment_slots_passed' as result;
rollback;