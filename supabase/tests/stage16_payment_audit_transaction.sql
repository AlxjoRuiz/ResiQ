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
declare p uuid:='20000000-0000-4000-8000-000000000001'; u uuid:='50000000-0000-4000-8000-000000000001'; admin uuid:='10000000-0000-4000-8000-000000000001'; resident uuid:='10000000-0000-4000-8000-000000000002'; debt uuid; payment uuid; key uuid:=gen_random_uuid();
begin
 debt:=public.create_receivable(p,u,'Deuda sintética',200000,current_date,current_date,null);
 payment:=public.record_payment(p,u,80000,current_date,'PRUEBA',jsonb_build_array(jsonb_build_object('receivable_id',debt,'amount',80000)),key);
 if private.receivable_outstanding(debt)<>120000 then raise exception 'partial_payment_balance_invalid'; end if;
 begin perform public.record_payment(p,u,80000,current_date,'PRUEBA',jsonb_build_array(jsonb_build_object('receivable_id',debt,'amount',80000)),key); raise exception 'duplicate_payment_allowed'; exception when others then if sqlerrm<>'duplicate_payment' then raise; end if; end;
 begin perform public.record_payment(p,u,10000,current_date,null,jsonb_build_array(jsonb_build_object('receivable_id',debt,'amount',20000)),gen_random_uuid()); raise exception 'payment_overallocation_allowed'; exception when others then if sqlerrm<>'payment_overallocated' then raise; end if; end;
 begin perform public.record_payment(p,u,150000,current_date,null,jsonb_build_array(jsonb_build_object('receivable_id',debt,'amount',150000)),gen_random_uuid()); raise exception 'debt_overallocation_allowed'; exception when others then if sqlerrm<>'receivable_overallocated' then raise; end if; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',resident,'role','authenticated')::text,true); perform set_config('request.jwt.claim.sub',resident::text,true);
 begin perform public.void_payment(payment,'Intento inválido'); raise exception 'resident_void_payment_allowed'; exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true); perform set_config('request.jwt.claim.sub',admin::text,true);
 perform public.void_payment(payment,'Anulación sintética');
 if private.receivable_outstanding(debt)<>200000 then raise exception 'void_payment_balance_invalid'; end if;
 if not exists(select 1 from public.audit_logs where entity_id=payment and property_id=p and actor_id=admin and action='payment.recorded' and (metadata->>'amount')::numeric=80000 and (metadata->>'allocated')::numeric=80000) then raise exception 'payment_record_audit_missing'; end if;
 if not exists(select 1 from public.audit_logs where entity_id=payment and property_id=p and actor_id=admin and action='payment.voided' and metadata->>'reason'='Anulación sintética') then raise exception 'payment_void_audit_missing'; end if;
 if (select count(*) from public.payments where property_id=p)<>1 or (select count(*) from public.audit_logs where entity_id=payment)<>2 then raise exception 'failed_attempt_persisted'; end if;
end; $test$;
rollback;
select 'payment_balance_permissions_audit_passed_rollback' as result;
