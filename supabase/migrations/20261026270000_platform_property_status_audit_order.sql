-- Corrige suspender un conjunto (26/10/2026): require_active_property_write (20261007171000) bloquea
-- escribir en audit_logs de un conjunto no activo, así que la auditoría escrita después de suspender
-- fallaba con property_inactive. Ahora se audita mientras el conjunto sigue activo: antes de
-- suspender y después de reactivar.
begin;

create or replace function public.platform_set_property_status(target_property_id uuid, target_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare previous_status text; details jsonb;
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  if target_status not in ('active','suspended') then raise exception 'invalid_status'; end if;
  select status into previous_status from public.properties where id = target_property_id for update;
  if not found or previous_status = 'archived' then raise exception 'invalid_property'; end if;
  if previous_status = target_status then return; end if;
  details := jsonb_build_object('previous_status', previous_status, 'status', target_status);
  if target_status = 'suspended' then
    perform private.write_property_audit(target_property_id, 'platform.property_status_changed', 'property', target_property_id, details);
  end if;
  update public.properties set status = target_status where id = target_property_id;
  if target_status = 'active' then
    perform private.write_property_audit(target_property_id, 'platform.property_status_changed', 'property', target_property_id, details);
  end if;
end;
$$;

commit;

select pg_get_functiondef('public.platform_set_property_status(uuid,text)'::regprocedure) like '%if target_status = ''suspended'' then%' as auditoria_antes_de_suspender;
