\ir security_fixture.sql
select public.create_receivable('20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Security test charge',100,current_date,current_date,null);
insert into public.assemblies(id,property_id,type,title,starts_at,location,published_at,created_by) values('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','ordinary','Security assembly',now()+interval '1 day','Test room',now(),'10000000-0000-4000-8000-000000000001');
insert into public.assembly_representations(id,property_id,assembly_id,unit_id,grantor_member_id,representative_member_id) values('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003');
insert into public.documents(id,property_id,object_path,original_name,mime_type,size_bytes,uploaded_by,assembly_representation_id,document_kind) values('90000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','test/evidence.pdf','evidence.pdf','application/pdf',5,'10000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000001','representation_evidence');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.notifications where type='receivable_created')<>1 then raise exception 'authorized_notification_hidden'; end if;
 if not private.can_read_assembly_representation('80000000-0000-4000-8000-000000000001') then raise exception 'grantor_denied'; end if;
end $$;
reset role;
update public.unit_memberships set finance_access=false where id='60000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
 if exists(select 1 from public.notifications where type='receivable_created') then raise exception 'finance_revocation_leak'; end if;
end $$;
reset role;
update public.unit_memberships set valid_to=now() where id='60000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
 if private.can_read_assembly_representation('80000000-0000-4000-8000-000000000001') or private.can_read_assembly('70000000-0000-4000-8000-000000000001') then raise exception 'former_grantor_leak'; end if;
 if exists(select 1 from public.documents) then raise exception 'pending_owner_leak'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 if not private.can_read_assembly_representation('80000000-0000-4000-8000-000000000001') then raise exception 'legitimate_representative_denied'; end if;
end $$;
reset role;
rollback;
