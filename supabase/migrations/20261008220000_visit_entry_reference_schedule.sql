-- Approved: accepted visits may enter before or after their reference schedule.
begin;

create or replace function public.register_visit_entry(target_visitor_id uuid,target_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v public.visitors%rowtype; entry_id uuid; actual_entry timestamptz:=now(); timing text;
begin
  select * into v from public.visitors where id=target_visitor_id for update;
  if not found or not private.is_active_member(v.property_id,'concierge') then raise exception 'not_authorized'; end if;
  if v.status<>'authorized' then raise exception 'invalid_transition'; end if;
  timing:=case when actual_entry<v.scheduled_start then 'before_schedule' when actual_entry>v.scheduled_end then 'after_schedule' else 'within_schedule' end;
  insert into public.visitor_entries(property_id,visitor_id,entered_at,entered_by,notes)
  values(v.property_id,v.id,actual_entry,auth.uid(),nullif(trim(target_notes),'')) returning id into entry_id;
  update public.visitors set status='entered' where id=v.id;
  insert into public.activity_events(property_id,visitor_id,actor_id,event_type,previous_state,new_state,description)
  values(v.property_id,v.id,auth.uid(),'visit_entered','authorized','entered','Ingreso registrado');
  perform private.write_property_audit(v.property_id,'visit.entered','visitor',v.id,
    jsonb_build_object('entry_id',entry_id,'entered_at',actual_entry,'scheduled_start',v.scheduled_start,'scheduled_end',v.scheduled_end,'schedule_relation',timing));
  perform private.enqueue_visit_notification(v.id,'visit_entered','Tu visita ingresó','Portería registró el ingreso de tu visita.','entered');
  return entry_id;
end;
$$;

revoke all on function public.register_visit_entry(uuid,text) from public,anon;
grant execute on function public.register_visit_entry(uuid,text) to authenticated;
commit;
