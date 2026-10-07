begin;
-- Solicitudes de visita: residente solicita, administración decide, portería registra movimientos.
alter table public.visitors drop constraint visitors_status_check;
alter table public.visitors add constraint visitors_status_check check (status in ('pending','authorized','rejected','entered','exited','cancelled'));
alter table public.visitors alter column status set default 'pending';


alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice','attention_call_created','assembly_published','assembly_updated','assembly_cancelled','visit_requested','visit_rejected'));


alter table public.email_jobs drop constraint email_jobs_template_key_check;
alter table public.email_jobs add constraint email_jobs_template_key_check check (template_key in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice','attention_call_created','assembly_published','assembly_reminder','assembly_updated','assembly_cancelled','visit_requested','visit_rejected'));


alter table public.activity_events drop constraint activity_events_event_type_check;
alter table public.activity_events add constraint activity_events_event_type_check check (event_type in ('created','message_added','status_changed','attachment_added','package_received','package_recipient_assigned','package_notified','package_delivered','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','reservation_completed','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice','attention_call_created','attention_call_notified','attention_call_review_started','attention_call_read','attention_call_closed','attention_call_attachment_added','assembly_created','assembly_published','assembly_updated','assembly_rsvp_changed','assembly_attendance_recorded','assembly_representation_submitted','assembly_representation_reviewed','assembly_document_added','assembly_started','assembly_finished','assembly_cancelled','visit_requested','visit_rejected'));


create or replace function public.create_visit(
  target_property_id uuid,target_unit_id uuid,target_host_member_id uuid,target_visitor_name text,target_document_last_digits text,
  target_kind text,target_company text,target_service_type text,target_scheduled_start timestamptz,target_scheduled_end timestamptz,
  target_people_count integer,target_notes text,target_authorization_note text
) returns uuid language plpgsql security definer set search_path='' as $$
declare caller_member_id uuid; resolved_host_id uuid; created_id uuid; source text; clean_auth_note text:=nullif(trim(target_authorization_note),''); is_admin boolean; is_concierge boolean;
begin
  select pm.id into caller_member_id from public.property_members pm where pm.property_id=target_property_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles) limit 1;
  is_admin:=private.is_active_member(target_property_id,'administrator');
  is_concierge:=private.is_active_member(target_property_id,'concierge');
  if caller_member_id is null or is_admin or is_concierge then raise exception 'not_authorized'; end if;
  resolved_host_id:=caller_member_id;
  if target_host_member_id is not null and target_host_member_id<>caller_member_id then raise exception 'not_authorized'; end if;
  source:='resident_self'; clean_auth_note:=null;
  if not exists(select 1 from public.units u where u.id=target_unit_id and u.property_id=target_property_id and u.status='active') then raise exception 'invalid_unit'; end if;
  if not exists(select 1 from public.property_members pm join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id where pm.id=resolved_host_id and pm.property_id=target_property_id and pm.status='active' and 'member'=any(pm.roles) and um.unit_id=target_unit_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())) then raise exception 'invalid_host'; end if;
  if char_length(trim(target_visitor_name)) not between 2 and 120 or target_kind not in ('personal','maintenance') or target_people_count not between 1 and 20 then raise exception 'invalid_input'; end if;
  if target_document_last_digits is not null and nullif(trim(target_document_last_digits),'') is not null and trim(target_document_last_digits) !~ '^[0-9]{2,6}$' then raise exception 'invalid_document'; end if;
  if target_kind='maintenance' and (nullif(trim(target_service_type),'') is null or char_length(trim(target_service_type))>120) then raise exception 'service_required'; end if;
  if target_scheduled_start<now()-interval '15 minutes' or target_scheduled_end<=target_scheduled_start or target_scheduled_end>target_scheduled_start+interval '24 hours' then raise exception 'invalid_window'; end if;
  insert into public.visitors(property_id,unit_id,host_member_id,visitor_name,document_last_digits,kind,company,service_type,scheduled_start,scheduled_end,people_count,notes,authorization_source,authorization_note,created_by)
  values(target_property_id,target_unit_id,resolved_host_id,trim(target_visitor_name),nullif(trim(target_document_last_digits),''),target_kind,nullif(trim(target_company),''),case when target_kind='maintenance' then nullif(trim(target_service_type),'') else null end,target_scheduled_start,target_scheduled_end,target_people_count,nullif(trim(target_notes),''),source,clean_auth_note,auth.uid()) returning id into created_id;
  insert into public.activity_events(property_id,visitor_id,actor_id,event_type,new_state,description) values(target_property_id,created_id,auth.uid(),'visit_requested','pending','Solicitud de visita creada');
  perform private.write_property_audit(target_property_id,'visit.requested','visitor',created_id,jsonb_build_object('unit_id',target_unit_id,'authorization_source',source));
  perform private.enqueue_visit_notification(created_id,'visit_requested','Solicitud de visita registrada','Tu solicitud está pendiente de revisión por administración.','requested');
  return created_id;
end;
$$;

create or replace function public.cancel_visit(target_visitor_id uuid,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v public.visitors%rowtype; reason text:=trim(target_reason); caller_host boolean;
begin
  select * into v from public.visitors where id=target_visitor_id for update;
  if not found then raise exception 'visitor_not_found'; end if;
  caller_host:=exists(select 1 from public.property_members pm join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id and um.unit_id=v.unit_id where pm.id=v.host_member_id and pm.user_id=auth.uid() and pm.status='active' and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now()));
  if not caller_host or private.is_active_member(v.property_id,'administrator') or private.is_active_member(v.property_id,'concierge') then raise exception 'not_authorized'; end if;
  if v.status not in ('pending','authorized') or char_length(reason) not between 3 and 500 then raise exception 'invalid_transition'; end if;
  update public.visitors set status='cancelled' where id=v.id;
  insert into public.activity_events(property_id,visitor_id,actor_id,event_type,previous_state,new_state,description) values(v.property_id,v.id,auth.uid(),'visit_cancelled',v.status,'cancelled','Cancelada: '||reason);
  perform private.write_property_audit(v.property_id,'visit.cancelled','visitor',v.id,jsonb_build_object('reason',reason));
  perform private.enqueue_visit_notification(v.id,'visit_cancelled','Visita cancelada','La autorización de visita fue cancelada.','cancelled');
end;
$$;

create or replace function public.register_visit_entry(target_visitor_id uuid,target_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.visitors%rowtype; entry_id uuid;
begin
  select * into v from public.visitors where id=target_visitor_id for update;
  if not found or not private.is_active_member(v.property_id,'concierge') then raise exception 'not_authorized'; end if;
  if v.status<>'authorized' then raise exception 'invalid_transition'; end if;
  if now()<v.scheduled_start or now()>v.scheduled_end then raise exception 'outside_authorized_window'; end if;
  insert into public.visitor_entries(property_id,visitor_id,entered_by,notes) values(v.property_id,v.id,auth.uid(),nullif(trim(target_notes),'')) returning id into entry_id;
  update public.visitors set status='entered' where id=v.id;
  insert into public.activity_events(property_id,visitor_id,actor_id,event_type,previous_state,new_state,description) values(v.property_id,v.id,auth.uid(),'visit_entered','authorized','entered','Ingreso registrado');
  perform private.write_property_audit(v.property_id,'visit.entered','visitor',v.id,jsonb_build_object('entry_id',entry_id));
  perform private.enqueue_visit_notification(v.id,'visit_entered','Tu visita ingresó','Portería registró el ingreso de tu visita.','entered');
  return entry_id;
end;
$$;

create or replace function public.register_visit_exit(target_visitor_id uuid,target_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare v public.visitors%rowtype; entry_id uuid;
begin
  select * into v from public.visitors where id=target_visitor_id for update;
  if not found or not private.is_active_member(v.property_id,'concierge') then raise exception 'not_authorized'; end if;
  if v.status<>'entered' then raise exception 'invalid_transition'; end if;
  select e.id into entry_id from public.visitor_entries e where e.property_id=v.property_id and e.visitor_id=v.id and e.exited_at is null for update;
  if entry_id is null then raise exception 'open_entry_not_found'; end if;
  update public.visitor_entries set exited_at=now(),exited_by=auth.uid(),notes=coalesce(nullif(trim(target_notes),''),notes) where id=entry_id;
  update public.visitors set status='exited' where id=v.id;
  insert into public.activity_events(property_id,visitor_id,actor_id,event_type,previous_state,new_state,description) values(v.property_id,v.id,auth.uid(),'visit_exited','entered','exited','Salida registrada');
  perform private.write_property_audit(v.property_id,'visit.exited','visitor',v.id,jsonb_build_object('entry_id',entry_id));
  perform private.enqueue_visit_notification(v.id,'visit_exited','Tu visita salió','Portería registró la salida de tu visita.','exited');
end;
$$;

create or replace function public.review_visit(target_visitor_id uuid,target_approved boolean,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v public.visitors%rowtype; reason text:=nullif(trim(target_reason),''); next_status text;
begin
  select * into v from public.visitors where id=target_visitor_id for update;
  if not found or not private.is_active_member(v.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if v.status<>'pending' then raise exception 'invalid_transition'; end if;
  if target_approved is null or (not target_approved and (reason is null or char_length(reason) not between 3 and 500)) or char_length(reason)>500 then raise exception 'invalid_input'; end if;
  if target_approved and v.scheduled_end<=now() then raise exception 'invalid_window'; end if;
  next_status:=case when target_approved then 'authorized' else 'rejected' end;
  update public.visitors set status=next_status where id=v.id;
  insert into public.activity_events(property_id,visitor_id,actor_id,event_type,previous_state,new_state,description)
  values(v.property_id,v.id,auth.uid(),case when target_approved then 'visit_authorized' else 'visit_rejected' end,'pending',next_status,case when target_approved then 'Solicitud aceptada' else 'Solicitud rechazada: '||reason end);
  perform private.write_property_audit(v.property_id,'visit.'||next_status,'visitor',v.id,jsonb_build_object('reason',reason));
  perform private.enqueue_visit_notification(v.id,case when target_approved then 'visit_authorized' else 'visit_rejected' end,case when target_approved then 'Visita aceptada' else 'Visita rechazada' end,case when target_approved then 'Administración aceptó tu solicitud de visita.' else 'Administración rechazó tu solicitud: '||reason end,next_status);
end;
$$;
revoke all on function public.review_visit(uuid,boolean,text) from public,anon;
grant execute on function public.review_visit(uuid,boolean,text) to authenticated;

commit;
