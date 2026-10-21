-- Auto-registro de llegada por un convocado. No comprueba presencia fisica.
-- La respuesta RSVP y la asistencia efectiva siguen siendo datos separados.
begin;

create or replace function public.self_check_in_assembly(target_assembly_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  item public.assemblies%rowtype;
  attendee public.assembly_attendees%rowtype;
begin
  select * into item from public.assemblies where id = target_assembly_id for update;
  if not found or item.published_at is null or item.status <> 'in_progress' then
    raise exception 'assembly_not_in_progress';
  end if;

  select aa.* into attendee
  from public.assembly_attendees aa
  join public.property_members pm on pm.property_id = aa.property_id and pm.id = aa.member_id
  join public.unit_memberships um on um.property_id = aa.property_id
    and um.member_id = aa.member_id and um.unit_id = aa.unit_id
  where aa.property_id = item.property_id and aa.assembly_id = item.id
    and pm.user_id = auth.uid() and pm.status = 'active'
    and 'member' = any(pm.roles)
    and um.valid_from <= now() and (um.valid_to is null or um.valid_to > now())
    and exists(select 1 from public.properties p where p.id = item.property_id and p.status = 'active')
  for update of aa;
  if not found then raise exception 'not_invited_or_inactive'; end if;

  -- Reintentos de red o doble pulsacion no generan una segunda asistencia.
  if attendee.attendance_status = 'present' then return; end if;
  -- Una ausencia ya asentada solo puede corregirse por Administracion con motivo.
  if attendee.attendance_status <> 'pending' then raise exception 'attendance_already_recorded'; end if;

  update public.assembly_attendees set attendance_status = 'present',
    attendance_recorded_at = now(), attended_at = now(),
    attendance_recorded_by = auth.uid(), attendance_note = null
  where id = attendee.id;

  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,previous_state,new_state,description)
  values(item.property_id,item.id,auth.uid(),'assembly_attendance_recorded','pending','present','Asistencia autodeclarada por el convocado');
  perform private.write_property_audit(item.property_id,'assembly.attendance_self_recorded',
    'assembly_attendee',attendee.id,jsonb_build_object('source','self','attendee_id',attendee.id));
end;
$$;

revoke all on function public.self_check_in_assembly(uuid) from public, anon;
grant execute on function public.self_check_in_assembly(uuid) to authenticated;

commit;
select 'ASSEMBLY_SELF_CHECK_IN_SCHEMA_OK' as result;
