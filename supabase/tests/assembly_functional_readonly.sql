-- Verificacion de solo lectura de la convocatoria funcional del 2026-10-06.
-- Ejecutar en SQL Editor de Supabase. No modifica datos ni reenvia correos.
select a.title, a.status, aa.rsvp, aa.responded_at,
       aa.attendance_status, aa.attended_at
from public.assemblies a
join public.assembly_attendees aa on aa.assembly_id = a.id
where a.id = '25777224-2bc0-4892-89ef-06b19b65b933'
  and a.property_id = '1bde3475-3ed2-4f57-bd13-39784b12d2a6';
-- Esperado tras Asistire: rsvp=yes, responded_at con fecha.
-- Confirmar no equivale a asistir: attendance_status=pending, attended_at=NULL.

select j.template_key, j.status as queue_status, j.attempt_count,
       j.next_attempt_at, j.last_error_code,
       l.status as provider_status, l.provider_message_id, l.error_code,
       l.attempted_at, l.delivered_at
from public.email_jobs j
join public.notifications n on n.id = j.notification_id
left join public.email_logs l on l.email_job_id = j.id
where n.target_type = 'assembly'
  and n.target_id = '25777224-2bc0-4892-89ef-06b19b65b933'
  and j.recipient_email = 'alejoruizm11@gmail.com'
order by j.created_at, l.attempt_number;
-- accepted acredita aceptacion del proveedor, no recepcion en la bandeja.
-- Los recordatorios futuros pueden permanecer queued; no son fallos.
