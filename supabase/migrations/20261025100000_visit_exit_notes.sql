  -- La nota de salida ya no sobrescribe la de entrada: se guarda en exit_notes.
  -- Así el portero conserva, por ejemplo, «entraron 3 personas» al ingreso y su propia
  -- observación al registrar la salida. Las notas existentes no cambian.
  begin;
  
  alter table public.visitor_entries
    add column exit_notes text check (exit_notes is null or char_length(exit_notes) <= 1000);
  
  create or replace function public.register_visit_exit(target_visitor_id uuid,target_notes text)
  returns void language plpgsql security definer set search_path='' as $$
  declare v public.visitors%rowtype; entry_id uuid;
  begin
    select * into v from public.visitors where id=target_visitor_id for update;
    if not found or not private.is_active_member(v.property_id,'concierge') then raise exception 'not_authorized'; end if;
    if v.status<>'entered' then raise exception 'invalid_transition'; end if;
    select e.id into entry_id from public.visitor_entries e where e.property_id=v.property_id and e.visitor_id=v.id and e.exited_at is null for update;
    if entry_id is null then raise exception 'open_entry_not_found'; end if;
    update public.visitor_entries set exited_at=now(),exited_by=auth.uid(),exit_notes=nullif(trim(target_notes),'') where id=entry_id;
    update public.visitors set status='exited' where id=v.id;
    insert into public.activity_events(property_id,visitor_id,actor_id,event_type,previous_state,new_state,description) values(v.property_id,v.id,auth.uid(),'visit_exited','entered','exited','Salida registrada');
    perform private.write_property_audit(v.property_id,'visit.exited','visitor',v.id,jsonb_build_object('entry_id',entry_id));
    perform private.enqueue_visit_notification(v.id,'visit_exited','Tu visita salió','Portería registró la salida de tu visita.','exited');
  end;
  $$;
  
  commit;
  
  select exists (select 1 from information_schema.columns where table_name = 'visitor_entries' and column_name = 'exit_notes') as nota_salida_separada,
    pg_get_functiondef('public.register_visit_exit(uuid,text)'::regprocedure) like '%exit_notes=%' as salida_usa_campo_nuevo;
