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
 -- Expiration is triggered on authorized access; test the release and audit exactly once.
 update public.reservations set hold_expires_at=now()-interval '1 minute' where id=reservation;
 perform public.refresh_reservations(p);
 if not exists(select 1 from public.reservations where id=reservation and status='expired' and blocks_slot=false and hold_expires_at is null) then raise exception 'expired_slot_not_released'; end if;
 if (select count(*) from public.activity_events where reservation_id=reservation and event_type='reservation_expired')<>1 then raise exception 'expiration_event_missing_or_duplicated'; end if;
 if (select count(*) from public.audit_logs where entity_id=reservation and action='reservation.expired' and property_id=p and actor_id is null)<>1 then raise exception 'expiration_audit_missing_or_duplicated'; end if;
 perform public.refresh_reservations(p);
 if (select count(*) from public.activity_events where reservation_id=reservation and event_type='reservation_expired')<>1 then raise exception 'expiration_not_idempotent'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',admin::text,true);
 begin
   perform public.decide_reservation(reservation,true,'Aprobación tardía');
   raise exception 'expired_reservation_approved';
 exception when others then if sqlerrm<>'invalid_transition' then raise; end if; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',resident,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',resident::text,true);
 if public.create_reservation(p,amenity,u,starts,starts+interval '1 hour',1,gen_random_uuid())=reservation then raise exception 'slot_not_reusable'; end if;
end; $test$;
rollback;
select 'reservation_expiration_slot_audit_passed_rollback' as result;
