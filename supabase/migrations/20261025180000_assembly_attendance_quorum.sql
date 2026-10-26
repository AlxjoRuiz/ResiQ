-- Asambleas: primero convocatoria, luego aprobación (decisión de Alejandro, 25/10/2026).
-- Cada convocado responde Asistiré / No asistiré. Administración solo puede aprobar la asamblea
-- cuando más del 50% de los apartamentos convocados tiene al menos un «Asistiré». Sin
-- aprobación no se puede iniciar. Las asambleas que ya existían quedan como estaban.
-- Es una regla operativa de ResiQ, no un cálculo de quórum legal por coeficientes (Ley 675 de
-- 2001): validar con asesor legal.
begin;

-- Las filas existentes quedan en false; las nuevas asambleas nacen con la regla activa.
alter table public.assemblies add column requires_attendance_quorum boolean not null default false;
alter table public.assemblies alter column requires_attendance_quorum set default true;
alter table public.assemblies add column attendance_approved_at timestamptz;
alter table public.assemblies add column attendance_approved_by uuid references public.profiles(id) on delete restrict;
alter table public.assemblies add constraint assemblies_attendance_approval_check
  check ((attendance_approved_at is null)=(attendance_approved_by is null));

create or replace function public.approve_assembly_convocation(target_assembly_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare item public.assemblies%rowtype; total_units integer; yes_units integer;
begin
  select * into item from public.assemblies where id=target_assembly_id for update;
  if not found or auth.uid() is null or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status<>'scheduled' or item.published_at is null or not item.requires_attendance_quorum or item.attendance_approved_at is not null then raise exception 'invalid_transition'; end if;
  -- Un apartamento cuenta como «asistirá» si al menos uno de sus convocados respondió que sí.
  select count(distinct unit_id), count(distinct unit_id) filter (where rsvp='yes') into total_units, yes_units
  from public.assembly_attendees where assembly_id=item.id;
  if total_units=0 or yes_units*2<=total_units then raise exception 'quorum_not_reached'; end if;
  update public.assemblies set attendance_approved_at=now(),attendance_approved_by=auth.uid() where id=item.id;
  insert into public.activity_events(property_id,assembly_id,actor_id,event_type,previous_state,new_state,description)
  values(item.property_id,item.id,auth.uid(),'assembly_updated','convocation','approved',
    format('Asamblea aprobada: %s de %s apartamentos confirmaron asistencia',yes_units,total_units));
  perform private.write_property_audit(item.property_id,'assembly.convocation_approved','assembly',item.id,
    jsonb_build_object('yes_units',yes_units,'total_units',total_units));
end;
$$;
revoke all on function public.approve_assembly_convocation(uuid) from public,anon;
grant execute on function public.approve_assembly_convocation(uuid) to authenticated;

-- Igual a 20261005200000_fix_assembly_required_notes.sql, más el bloqueo de inicio sin aprobación.
create or replace function public.change_assembly_status(target_assembly_id uuid,target_status text,target_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare item public.assemblies%rowtype; clean_reason text:=nullif(trim(target_reason),''); event_name text;
begin
  select * into item from public.assemblies where id=target_assembly_id for update;
  if not found or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status='scheduled' and target_status='in_progress' and item.requires_attendance_quorum and item.attendance_approved_at is null then raise exception 'convocation_not_approved'; end if;
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

commit;

select
  (select count(*) from public.assemblies where requires_attendance_quorum)=0 as existentes_sin_cambio,
  (select column_default from information_schema.columns where table_schema='public' and table_name='assemblies' and column_name='requires_attendance_quorum')='true' as nuevas_con_regla,
  has_function_privilege('authenticated','public.approve_assembly_convocation(uuid)','execute') as aprobar_disponible,
  pg_get_functiondef('public.change_assembly_status(uuid,text,text)'::regprocedure) like '%convocation_not_approved%' as inicio_bloqueado_sin_aprobar;
