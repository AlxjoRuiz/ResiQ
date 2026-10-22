-- Crea las invitaciones de los principales de un censo importado antes de la cola de
-- invitaciones (20261023140000_invitation_queue_test_mode.sql). Solo para apartamentos sin
-- residente vigente ni invitación pendiente. Aborta si el envío real está activo, para que
-- este relleno nunca dispare correos. Ejecutar completo en SQL Editor; cambiar la propiedad
-- si no es Edificio Mirador ResiQ.
do $backfill$
declare
  target_property constant uuid := 'df64a927-fa78-4dad-86fe-847b7f82307f';
  actor uuid;
begin
  if (select live from private.invitation_delivery) then raise exception 'envio_real_activo'; end if;
  select user_id into actor from public.property_members
  where property_id = target_property and status = 'active' and 'administrator' = any(roles)
  order by joined_at limit 1;
  if actor is null then raise exception 'sin_administrador_activo'; end if;

  perform private.enqueue_resident_invitation(target_property, r.unit_id, r.email_normalized, r.invitation_relationship, actor)
  from public.census_records r
  where r.property_id = target_property and r.invitation_primary
    and not exists (select 1 from public.unit_memberships um where um.property_id = r.property_id and um.unit_id = r.unit_id
                    and um.valid_from <= now() and (um.valid_to is null or um.valid_to > now()))
    and not exists (select 1 from public.invitations i where i.property_id = r.property_id and i.unit_id = r.unit_id and i.status = 'pending');
end;
$backfill$;

select j.status as estado_correo, count(*) as invitaciones
from public.email_jobs j join public.invitations i on i.id = j.invitation_id
where i.property_id = 'df64a927-fa78-4dad-86fe-847b7f82307f' and j.template_key = 'resident_invitation'
group by j.status;
