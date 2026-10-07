\ir security_fixture.sql
insert into public.pqrs(id,property_id,unit_id,author_member_id,category,subject,description) values('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','security','Security test','Security regression description');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare prepared record; rejected_id uuid; blocked boolean:=false; begin
 for i in 1..5 loop
  select * into prepared from public.prepare_pqrs_document('70000000-0000-4000-8000-000000000001',null,'evidence.pdf','application/pdf',9);
  rejected_id:=prepared.document_id;
 end loop;
 perform public.reject_pqrs_document(rejected_id,'test_rejection');
 begin perform public.prepare_pqrs_document('70000000-0000-4000-8000-000000000001',null,'extra.pdf','application/pdf',9);
 exception when others then blocked:=sqlerrm like '%file_limit%'; end;
 if not blocked then raise exception 'rejection_freed_quota_early'; end if;
end $$;
reset role;
create temp table cleanup_target as select id,bucket,object_path from public.documents where status='rejected';
insert into storage.objects(bucket_id,name) select bucket,object_path from cleanup_target;
set local role service_role;
do $$ begin
 if exists(select 1 from public.list_rejected_document_cleanup()) then raise exception 'active_upload_token_cleanup'; end if;
end $$;
reset role;
update public.documents set upload_rejected_at=now()-interval '3 hours' where status='rejected';
set local role service_role;
do $$ declare blocked boolean:=false; begin
 begin perform public.complete_rejected_document_cleanup((select document_id from public.list_rejected_document_cleanup() limit 1));
 exception when others then blocked:=sqlerrm like '%storage_object_not_removed%'; end;
 if not blocked then raise exception 'quota_freed_with_blob_remaining'; end if;
end $$;
reset role;
-- Local Storage fixture only; production cleanup uses Storage API instead.
delete from storage.objects where name in(select object_path from cleanup_target);
set local role service_role;
select public.complete_rejected_document_cleanup(document_id) from public.list_rejected_document_cleanup();
reset role;
set local role authenticated;
select * from public.prepare_pqrs_document('70000000-0000-4000-8000-000000000001',null,'replacement.pdf','application/pdf',9);
reset role;
rollback;
