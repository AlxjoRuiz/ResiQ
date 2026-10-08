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
declare p uuid:='20000000-0000-4000-8000-000000000001'; admin uuid:='10000000-0000-4000-8000-000000000001'; resident uuid:='10000000-0000-4000-8000-000000000002'; u uuid:='50000000-0000-4000-8000-000000000001'; amenity uuid; reservation uuid; hours jsonb; starts timestamp;
begin
 select jsonb_agg(jsonb_build_object('weekday',day,'opens_at','08:00','closes_at','18:00')) into hours from generate_series(1,7) day;
 amenity:=public.save_amenity(p,null,'Zona sintética auditoría','Solo prueba',10,true,'Prueba',60,'active',hours);
 starts:=(current_date+10)::timestamp+interval '10 hours';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',resident,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',resident::text,true);
 reservation:=public.create_reservation(p,amenity,u,starts,starts+interval '1 hour',1,gen_random_uuid());
 begin perform public.decide_reservation(reservation,true,'Prueba'); raise exception 'resident_decision_allowed'; exception when others then if sqlerrm<>'not_authorized' then raise; end if; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',admin::text,true);
 perform public.decide_reservation(reservation,true,'Aprobación sintética');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',resident,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',resident::text,true);
 perform public.cancel_reservation(reservation,'Cancelación sintética');
 if not exists(select 1 from public.audit_logs where entity_id=reservation and property_id=p and actor_id=resident and action='reservation.created' and metadata->>'status'='pending') then raise exception 'reservation_creation_audit_missing'; end if;
 if not exists(select 1 from public.audit_logs where entity_id=reservation and property_id=p and actor_id=admin and action='reservation.approved') then raise exception 'reservation_decision_audit_missing'; end if;
 if not exists(select 1 from public.audit_logs where entity_id=reservation and property_id=p and actor_id=resident and action='reservation.cancelled' and metadata->>'reason'='Cancelación sintética') then raise exception 'reservation_cancellation_audit_missing'; end if;
 if (select count(*) from public.audit_logs where entity_id=reservation)<>3 then raise exception 'reservation_audit_count_invalid'; end if;
end; $test$;
rollback;
select 'reservation_audit_passed_rollback' as result;
