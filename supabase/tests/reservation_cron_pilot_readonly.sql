-- Solo lectura. Ejecutar el lunes 19/10/2026 ANTES de abrir Reservas.
-- No llama refresh_reservations ni modifica el estado.
with test_reservation as (
  select r.id,r.status,r.hold_expires_at,r.created_at
  from public.reservations r
  where r.property_id='1bde3475-3ed2-4f57-bd13-39784b12d2a6'
    and r.purpose='PRUEBA CRON 16-10-2026'
  order by r.created_at desc
  limit 1
)
select
  r.status,
  r.created_at,
  r.hold_expires_at,
  (select count(*) from public.activity_events e
   where e.reservation_id=r.id and e.event_type='reservation_expired') as expiration_events,
  (select count(*) from public.notifications n
   where n.target_type='reservation' and n.target_id=r.id
     and n.type='reservation_expired') as expiration_notices,
  (select coalesce(bool_or(j.active),false) from cron.job j
   where j.jobname='refresh-reservation-states') as cron_enabled
from test_reservation r;
