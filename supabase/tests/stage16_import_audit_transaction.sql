-- Disposable fixtures; every security regression ends in ROLLBACK.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001','admin@resiq.invalid','{"display_name":"Test admin"}'),
 ('10000000-0000-4000-8000-000000000002','member@resiq.invalid','{"display_name":"Test member"}'),
 ('10000000-0000-4000-8000-000000000003','representative@resiq.invalid','{"display_name":"Test representative"}');
insert into public.properties(id,name,slug,created_by) values('20000000-0000-4000-8000-000000000001','Security test','security-test','10000000-0000-4000-8000-000000000001');
insert into public.property_members(id,property_id,user_id,roles,created_by) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',array['administrator'],'10000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',array['member'],'10000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003',array['member'],'10000000-0000-4000-8000-000000000001');
insert into public.buildings(id,property_id,name,code) values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Test building','TEST');
insert into public.units(id,property_id,building_id,code) values
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','101'),
 ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','102');
insert into public.unit_memberships(id,property_id,unit_id,member_id,relationship,finance_access,valid_from,created_by) values
 ('60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','owner',true,now()-interval '1 day','10000000-0000-4000-8000-000000000001'),
 ('60000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','resident',false,now()-interval '1 day','10000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);

do $test$
declare p uuid:='20000000-0000-4000-8000-000000000001'; u uuid:='50000000-0000-4000-8000-000000000001'; admin uuid:='10000000-0000-4000-8000-000000000001'; resident uuid:='10000000-0000-4000-8000-000000000002'; batch uuid:=gen_random_uuid(); bad_batch uuid:=gen_random_uuid(); rows jsonb; row_value jsonb;
begin
 row_value:=jsonb_build_object('unit_id',u,'concept','Importación sintética','amount',100,'issued_on',current_date,'due_on',current_date,'external_reference','AUDIT-IMPORT-1','source','import'); rows:=jsonb_build_array(row_value);
 if public.import_receivables(p,batch,rows)<>1 then raise exception 'import_count_invalid'; end if;
 if not exists(select 1 from public.accounts_receivable where property_id=p and unit_id=u and import_batch_id=batch and amount=100 and recorded_by=admin) then raise exception 'import_binding_invalid'; end if;
 if not exists(select 1 from public.audit_logs where property_id=p and entity_id=batch and actor_id=admin and action='receivable.batch_imported' and metadata->>'batch_id'=batch::text and metadata->>'rows'='1') then raise exception 'import_audit_missing'; end if;
 begin perform public.import_receivables(p,gen_random_uuid(),rows); raise exception 'duplicate_import_allowed'; exception when others then if sqlerrm<>'duplicate_reference' then raise; end if; end;
 begin perform public.import_receivables(p,bad_batch,jsonb_build_array(row_value||jsonb_build_object('external_reference','AUDIT-IMPORT-2'),row_value||jsonb_build_object('external_reference','AUDIT-IMPORT-3','amount',-1))); raise exception 'invalid_row_allowed'; exception when others then if sqlerrm<>'invalid_import_row' then raise; end if; end;
 if exists(select 1 from public.accounts_receivable where import_batch_id=bad_batch) then raise exception 'partial_import_survived'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',resident,'role','authenticated')::text,true); perform set_config('request.jwt.claim.sub',resident::text,true);
 begin perform public.import_receivables(p,gen_random_uuid(),jsonb_build_array(row_value||jsonb_build_object('external_reference','AUDIT-IMPORT-4'))); raise exception 'resident_import_allowed'; exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 if (select count(*) from public.accounts_receivable where property_id=p)<>1 then raise exception 'failed_import_left_rows'; end if;
end; $test$;
rollback;
select 'import_authorization_atomicity_audit_passed_rollback' as result;
