-- Corrige la validación SQL de notas obligatorias cuando el valor recibido es NULL.

create or replace function public.change_assembly_status(target_assembly_id uuid,target_status text,target_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare item public.assemblies%rowtype; clean_reason text:=nullif(trim(target_reason),''); event_name text;
begin
  select * into item from public.assemblies where id=target_assembly_id for update;
  if not found or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status='scheduled' and item.published_at is not null and target_status='in_progress' and now()>=item.starts_at-interval '2 hours' then event_name:='assembly_started';
  elsif item.status='in_progress' and target_status='finished' then event_name:='assembly_finished';
  elsif item.status='scheduled' and item.published_at is not null and target_status='cancelled' and clean_reason is not null and char_length(clean_reason) between 4 and 1000 then event_name:='assembly_cancelled';
  else raise exception 'invalid_transition'; end if;
  update public.assemblies set status=target_status,finished_at=case when target_status='finished' then now() else null end,
    cancelled_at=case when target_status='cancelled' then now() else null end,cancellation_reason=case when target_status='cancelled' then clean_reason else null end where id=item.id;
  if target_status='cancelled' then perform private.enqueue_assembly_message(item.id,'assembly_cancelled','Asamblea cancelada',clean_reason,'assembly_cancelled','cancelled'); end if;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,previous_state,new_state,description)
  values(item.property_id,item.id,auth.uid(),event_name,item.status,target_status,coalesce(clean_reason,'Estado actualizado'));
  perform private.write_property_audit(item.property_id,'assembly.status_changed','assembly',item.id,jsonb_build_object('previous_status',item.status,'status',target_status));
end;
$$;

create or replace function public.record_assembly_attendance(target_attendee_id uuid,target_attended boolean,target_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare attendee public.assembly_attendees%rowtype; item public.assemblies%rowtype; clean_note text:=nullif(trim(target_note),''); correcting boolean;
begin
  select * into attendee from public.assembly_attendees where id=target_attendee_id for update;
  select * into item from public.assemblies where id=attendee.assembly_id;
  if attendee.id is null or not private.is_active_member(attendee.property_id,'administrator') or item.status not in ('in_progress','finished') then raise exception 'not_authorized'; end if;
  correcting:=attendee.attendance_status<>'pending';
  if correcting and (clean_note is null or char_length(clean_note) not between 4 and 1000) then raise exception 'correction_note_required'; end if;
  update public.assembly_attendees set attendance_status=case when target_attended then 'present' else 'absent' end,
    attendance_recorded_at=now(),attended_at=case when target_attended then now() else null end,
    attendance_recorded_by=auth.uid(),attendance_note=clean_note where id=attendee.id;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,previous_state,new_state,description)
  values(item.property_id,item.id,auth.uid(),'assembly_attendance_recorded',attendee.attendance_status,case when target_attended then 'present' else 'absent' end,coalesce(clean_note,'Asistencia registrada'));
  perform private.write_property_audit(item.property_id,'assembly.attendance_recorded','assembly_attendee',attendee.id,jsonb_build_object('attended',target_attended,'correction',correcting));
end;
$$;

create or replace function public.review_assembly_representation(target_representation_id uuid,target_status text,target_note text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.assembly_representations%rowtype; clean_note text:=nullif(trim(target_note),'');
begin
  select * into item from public.assembly_representations where id=target_representation_id for update;
  if not found or not private.is_active_member(item.property_id,'administrator') or target_status not in ('validated','rejected','revoked')
    or clean_note is null or char_length(clean_note) not between 4 and 1000 or (target_status in ('validated','rejected') and item.status<>'submitted')
    or (target_status='revoked' and item.status<>'validated') then raise exception 'invalid_review'; end if;
  if target_status='validated' and not exists(select 1 from public.documents where assembly_representation_id=item.id and status='available') then raise exception 'evidence_required'; end if;
  update public.assembly_representations set status=target_status,review_note=clean_note,reviewed_by=auth.uid(),reviewed_at=now() where id=item.id;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,previous_state,new_state,description)
  values(item.property_id,item.assembly_id,auth.uid(),'assembly_representation_reviewed',item.status,target_status,clean_note);
  perform private.write_property_audit(item.property_id,'assembly.representation_reviewed','assembly_representation',item.id,jsonb_build_object('status',target_status));
end;
$$;

notify pgrst, 'reload schema';
