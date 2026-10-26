-- Asambleas sin tope de convocados (decisión de Alejandro, 25/10/2026): la convocatoria puede
-- llegar a todos los residentes de la comunidad, sin el máximo anterior de 500. Igual a
-- create_assembly de 20261005190000_assemblies.sql, solo cambia esa validación.
begin;

create or replace function public.create_assembly(
  target_property_id uuid,target_type text,target_title text,target_description text,target_starts_at timestamptz,
  target_location text,target_agenda jsonb,target_audience jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare created_id uuid; agenda_item jsonb; audience_item jsonb; agenda_position integer:=0; target_member_id uuid; target_unit_id uuid;
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if target_type not in ('ordinary','extraordinary') or char_length(trim(target_title)) not between 4 and 180
    or (nullif(trim(target_description),'') is not null and char_length(trim(target_description)) not between 4 and 5000)
    or target_starts_at<=now() or char_length(trim(target_location)) not between 3 and 240
    or jsonb_typeof(target_agenda)<>'array' or jsonb_array_length(target_agenda) not between 1 and 100
    or jsonb_typeof(target_audience)<>'array' or jsonb_array_length(target_audience)<1
  then raise exception 'invalid_input'; end if;
  insert into public.assemblies(property_id,type,title,description,starts_at,location,created_by)
  values(target_property_id,target_type,trim(target_title),nullif(trim(target_description),''),target_starts_at,trim(target_location),auth.uid()) returning id into created_id;
  for agenda_item in select value from jsonb_array_elements(target_agenda) loop
    agenda_position:=agenda_position+1;
    if char_length(trim(agenda_item->>'title')) not between 3 and 180 then raise exception 'invalid_agenda'; end if;
    insert into public.assembly_agenda(property_id,assembly_id,position,title,description)
    values(target_property_id,created_id,agenda_position,trim(agenda_item->>'title'),nullif(trim(agenda_item->>'description'),''));
  end loop;
  for audience_item in select value from jsonb_array_elements(target_audience) loop
    target_member_id:=(audience_item->>'member_id')::uuid; target_unit_id:=(audience_item->>'unit_id')::uuid;
    if not exists(
      select 1 from public.property_members pm join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id
      where pm.id=target_member_id and pm.property_id=target_property_id and pm.status='active' and 'member'=any(pm.roles)
        and um.unit_id=target_unit_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
    ) then raise exception 'invalid_attendee'; end if;
    insert into public.assembly_attendees(property_id,assembly_id,member_id,unit_id)
    values(target_property_id,created_id,target_member_id,target_unit_id);
  end loop;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,new_state,description)
  values(target_property_id,created_id,auth.uid(),'assembly_created','draft','Borrador de asamblea creado');
  perform private.write_property_audit(target_property_id,'assembly.created','assembly',created_id,jsonb_build_object('type',target_type,'attendee_count',jsonb_array_length(target_audience)));
  return created_id;
exception when unique_violation then raise exception 'duplicate_attendee';
end;
$$;

commit;

select pg_get_functiondef('public.create_assembly(uuid,text,text,text,timestamptz,text,jsonb,jsonb)'::regprocedure) not like '%between 1 and 500%' as convocados_sin_tope;
