-- Solo lectura. Compara el evento de vencimiento con la ejecución del cron más cercana.
-- No llama funciones de actualización ni modifica reservas.
with pilot as (
  select r.id, r.status, r.created_at, r.purpose
  from public.reservations r
  where r.property_id = '1bde3475-3ed2-4f57-bd13-39784b12d2a6'
    and r.created_at >= '2026-10-16 00:00:00+00'::timestamptz
    and r.created_at < '2026-10-17 00:00:00+00'::timestamptz
    and r.purpose ilike '%48 horas%'
  order by r.created_at desc
  limit 1
), expiration as (
  select e.reservation_id, e.occurred_at
  from public.activity_events e
  join pilot p on p.id = e.reservation_id
  where e.event_type = 'reservation_expired'
  order by e.occurred_at desc
  limit 1
)
select
  p.status,
  p.created_at,
  p.created_at + interval '48 hours' as expected_expiration_at,
  e.occurred_at as expiration_event_at,
  run.status as nearby_cron_status,
  run.start_time as nearby_cron_started_at,
  run.end_time as nearby_cron_finished_at,
  run.return_message as nearby_cron_message
from pilot p
left join expiration e on e.reservation_id = p.id
left join lateral (
  select d.status, d.start_time, d.end_time, d.return_message
  from cron.job_run_details d
  join cron.job j on j.jobid = d.jobid
  where j.jobname = 'refresh-reservation-states'
    and e.occurred_at is not null
    and d.start_time between e.occurred_at - interval '2 minutes'
                         and e.occurred_at + interval '2 minutes'
  order by abs(extract(epoch from (d.start_time - e.occurred_at)))
  limit 1
) run on true;
