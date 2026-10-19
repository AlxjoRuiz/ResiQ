-- Solo lectura. Ejecutar antes de abrir Reservas o llamar funciones que refresquen estados.
-- La consulta inicial por motivo exacto no devolvió filas el 19/10/2026.
-- Buscar las solicitudes recientes de Bosques sin depender del texto exacto del motivo.
select
  r.id as reservation_id,
  r.purpose,
  r.status,
  r.created_at,
  r.hold_expires_at,
  (select count(*) from public.activity_events e
   where e.reservation_id = r.id and e.event_type = 'reservation_expired') as expiration_events,
  (select count(*) from public.notifications n
   where n.target_type = 'reservation' and n.target_id = r.id
     and n.type = 'reservation_expired') as expiration_notices,
  (select coalesce(bool_or(j.active), false) from cron.job j
   where j.jobname = 'refresh-reservation-states') as cron_enabled
from public.reservations r
where r.property_id = '1bde3475-3ed2-4f57-bd13-39784b12d2a6'
  and r.created_at >= '2026-10-15 00:00:00+00'::timestamptz
  and r.created_at < '2026-10-20 00:00:00+00'::timestamptz
order by r.created_at desc
limit 20;
