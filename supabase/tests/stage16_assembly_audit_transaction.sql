-- Ejecutar en SQL Editor. Toda la prueba termina en ROLLBACK.
begin;

create temp table assembly_test_context as
select p.id property_id,admin_pm.user_id admin_user_id,member_pm.user_id member_user_id,
  member_pm.id member_id,um.unit_id
from public.properties p
join public.property_members admin_pm on admin_pm.property_id=p.id and admin_pm.status='active' and 'administrator'=any(admin_pm.roles)
join public.property_members member_pm on member_pm.property_id=p.id and member_pm.status='active' and 'member'=any(member_pm.roles)
join public.unit_memberships um on um.property_id=p.id and um.member_id=member_pm.id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
where p.id='1bde3475-3ed2-4f57-bd13-39784b12d2a6' and p.status='active'
limit 1;
grant select on assembly_test_context to authenticated;

do $$ begin
  if not exists(select 1 from assembly_test_context) then raise exception 'missing_test_context'; end if;
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',admin_user_id,'role','authenticated')::text,true) from assembly_test_context;
set local role authenticated;

create temp table created_assembly(id uuid);
insert into created_assembly
select public.create_assembly(
  c.property_id,'ordinary','Asamblea transaccional de prueba','Se revierte al finalizar.',now()+interval '10 days',
  'Salón de pruebas',jsonb_build_array(jsonb_build_object('title','Verificación del orden del día')),
  jsonb_build_array(jsonb_build_object('member_id',c.member_id,'unit_id',c.unit_id))
) from assembly_test_context c;

select public.publish_assembly(id) from created_assembly;

reset role;
do $$ declare assembly_uuid uuid; begin
  select id into assembly_uuid from created_assembly;
  if (select count(*) from public.notifications n where n.target_type='assembly' and n.target_id=assembly_uuid)<>1 then raise exception 'publication_notification_failed'; end if;
  if (select count(*) from public.email_jobs ej where ej.template_data->>'assembly_id'=assembly_uuid::text)<>3 then raise exception 'publication_and_reminders_failed'; end if;
end $$;

select set_config('request.jwt.claims',jsonb_build_object('sub',member_user_id,'role','authenticated')::text,true) from assembly_test_context;
set local role authenticated;
select public.set_assembly_rsvp(id,'yes') from created_assembly;
create temp table created_representation(id uuid);
insert into created_representation
select public.submit_assembly_representation(a.id,c.unit_id,null,'Representante externo de prueba') from created_assembly a cross join assembly_test_context c;

do $$ declare assembly_uuid uuid; begin
  select id into assembly_uuid from created_assembly;
  if (select count(*) from public.assemblies a where a.id=assembly_uuid)<>1 then raise exception 'invitee_cannot_read'; end if;
  if (select aa.rsvp from public.assembly_attendees aa where aa.assembly_id=assembly_uuid)<>'yes' then raise exception 'rsvp_failed'; end if;
end $$;

reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',admin_user_id,'role','authenticated')::text,true) from assembly_test_context;
set local role authenticated;

do $$ declare evidence_rejected boolean:=false; begin
  begin
    perform public.review_assembly_representation((select id from created_representation),'validated','Documento revisado');
  exception when others then evidence_rejected:=sqlerrm like '%evidence_required%'; end;
  if not evidence_rejected then raise exception 'representation_without_evidence_was_validated'; end if;
end $$;

reset role;
update public.assemblies set starts_at=now()-interval '5 minutes' where id=(select id from created_assembly);
select set_config('request.jwt.claims',jsonb_build_object('sub',admin_user_id,'role','authenticated')::text,true) from assembly_test_context;
set local role authenticated;
select public.change_assembly_status(id,'in_progress',null) from created_assembly;
select public.record_assembly_attendance(aa.id,true,null) from public.assembly_attendees aa join created_assembly ca on ca.id=aa.assembly_id;

do $$ declare correction_rejected boolean:=false; begin
  begin
    perform public.record_assembly_attendance((select aa.id from public.assembly_attendees aa join created_assembly ca on ca.id=aa.assembly_id),false,null);
  exception when others then correction_rejected:=sqlerrm like '%correction_note_required%'; end;
  if not correction_rejected then raise exception 'attendance_correction_without_note_succeeded'; end if;
end $$;

select public.record_assembly_attendance(aa.id,false,'Corrección transaccional de prueba') from public.assembly_attendees aa join created_assembly ca on ca.id=aa.assembly_id;
select public.change_assembly_status(id,'finished',null) from created_assembly;

reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare assembly_uuid uuid; begin
  select id into assembly_uuid from created_assembly;
  if (select count(*) from public.assemblies a where a.id=assembly_uuid)<>0 then raise exception 'rls_isolation_failed'; end if;
end $$;

reset role;
do $audit$
declare a uuid; p uuid; admin uuid; resident uuid;
begin
 select id into a from created_assembly;
 select property_id,admin_user_id,member_user_id into p,admin,resident from assembly_test_context;
 if not exists(select 1 from public.audit_logs where entity_id=a and property_id=p and actor_id=admin and action='assembly.created') then raise exception 'assembly_creation_audit_missing'; end if;
 if not exists(select 1 from public.audit_logs where entity_id=a and property_id=p and actor_id=admin and action='assembly.published') then raise exception 'assembly_publish_audit_missing'; end if;
 if not exists(select 1 from public.audit_logs where entity_id=a and property_id=p and actor_id=resident and action='assembly.rsvp_changed' and metadata->>'rsvp'='yes') then raise exception 'assembly_rsvp_audit_missing'; end if;
 if (select count(*) from public.audit_logs where entity_id=a and action='assembly.status_changed' and actor_id=admin)<>2 then raise exception 'assembly_status_audit_count_invalid'; end if;
 if (select count(*) from public.audit_logs where entity_id in(select id from public.assembly_attendees where assembly_id=a) and action='assembly.attendance_recorded' and actor_id=admin)<>2 then raise exception 'assembly_attendance_audit_count_invalid'; end if;
 if not exists(select 1 from public.audit_logs where entity_id in(select id from public.assembly_attendees where assembly_id=a) and action='assembly.attendance_recorded' and metadata->>'correction'='true') then raise exception 'assembly_correction_audit_missing'; end if;
end; $audit$;
select 'assembly_audit_passed_rollback' result;
rollback;

