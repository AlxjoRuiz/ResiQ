begin;
select set_config('test.document_path',(select object_path from public.documents where id='2fee4d7e-4622-4244-afca-98b549fee35c'),true);
select set_config('request.jwt.claims','{"sub":"b5ce4454-e02c-47f2-b139-d94d6e79962b","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','b5ce4454-e02c-47f2-b139-d94d6e79962b',true);
set local role authenticated;
do $$ begin
if not exists(select 1 from public.documents where id='2fee4d7e-4622-4244-afca-98b549fee35c') then raise exception 'authorized_document_hidden'; end if;
if not exists(select 1 from storage.objects o where o.bucket_id='private-documents' and o.name=current_setting('test.document_path')) then raise exception 'authorized_blob_hidden'; end if;
end $$;
reset role;
update public.unit_memberships set valid_to=now() where property_id='1bde3475-3ed2-4f57-bd13-39784b12d2a6' and member_id in(select id from public.property_members where user_id='b5ce4454-e02c-47f2-b139-d94d6e79962b' and property_id='1bde3475-3ed2-4f57-bd13-39784b12d2a6');
set local role authenticated;
do $$ begin
if exists(select 1 from public.documents where id='2fee4d7e-4622-4244-afca-98b549fee35c') then raise exception 'revoked_document_visible'; end if;
if exists(select 1 from storage.objects o where o.bucket_id='private-documents' and o.name=current_setting('test.document_path')) then raise exception 'revoked_blob_visible'; end if;
end $$;
reset role;
select 'real_storage_revocation_passed' as result;
rollback;