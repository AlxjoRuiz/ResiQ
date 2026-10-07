\ir security_fixture.sql
insert into public.pqrs(id,property_id,unit_id,author_member_id,category,subject,description) values('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','security','Security test','Security regression description');
insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,pqrs_id) values('90000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','test/validation.pdf','evidence.pdf','application/pdf',9,'10000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001');
do $$ begin
 if has_function_privilege('authenticated','public.complete_pqrs_document(uuid)','EXECUTE') or has_function_privilege('authenticated','public.complete_attention_call_document(uuid)','EXECUTE') or has_function_privilege('authenticated','public.complete_assembly_document(uuid)','EXECUTE') or has_function_privilege('authenticated','public.complete_verified_document(uuid,uuid,bigint,text)','EXECUTE') then raise exception 'client_can_finalize'; end if;
end $$;
set local role service_role;
do $$ declare rejected boolean:=false; begin
 begin perform public.complete_verified_document('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',9,'application/pdf');
 exception when others then rejected:=sqlerrm like '%file_missing%'; end;
 if not rejected then raise exception 'phantom_file_accepted'; end if;
end $$;
reset role;
insert into storage.objects(bucket_id,name) values('private-documents','test/validation.pdf');
set local role service_role;
do $$ declare rejected boolean:=false; begin
 begin perform public.complete_verified_document('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',8,'application/pdf');
 exception when others then rejected:=sqlerrm like '%invalid_validated_document%'; end;
 if not rejected then raise exception 'size_mismatch_accepted'; end if;
end $$;
select public.complete_verified_document('90000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',9,'application/pdf');
reset role;
do $$ begin
 if (select status from public.documents where id='90000000-0000-4000-8000-000000000001')<>'available' then raise exception 'valid_file_not_published'; end if;
 if auth.uid()<>'10000000-0000-4000-8000-000000000001'::uuid then raise exception 'actor_context_not_restored'; end if;
end $$;
rollback;
