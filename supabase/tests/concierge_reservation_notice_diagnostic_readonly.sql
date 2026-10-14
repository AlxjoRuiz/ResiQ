-- Read-only check for the overnight reservation of 15/10/2026 in Bosques.
-- Returns counts only; no names, email addresses, or notification bodies.
select concat(
  'porteros_activos=',
  (select count(*) from public.property_members pm
   where pm.property_id=r.property_id and pm.status='active' and 'concierge'=any(pm.roles)),
  ' | avisos_porteria=',
  (select count(*) from public.notifications n
   join public.property_members pm on pm.id=n.recipient_member_id and pm.property_id=n.property_id
   where n.property_id=r.property_id and n.target_type='reservation' and n.target_id=r.id
     and n.type='reservation_cancelled' and 'concierge'=any(pm.roles)),
  ' | avisos_totales=',
  (select count(*) from public.notifications n
   where n.property_id=r.property_id and n.target_type='reservation' and n.target_id=r.id
     and n.type='reservation_cancelled'),
  ' | disparador=',
  coalesce((select t.tgenabled::text from pg_trigger t
   where t.tgrelid='public.reservations'::regclass and t.tgname='reservations_notify_concierge_status'),'no existe')
) as resultado
from public.reservations r
join public.properties p on p.id=r.property_id
where r.property_id='1bde3475-3ed2-4f57-bd13-39784b12d2a6'
  and r.status='cancelled'
  and to_char(r.starts_at at time zone p.timezone,'YYYY-MM-DD HH24:MI')='2026-10-15 22:00'
order by r.created_at desc
limit 1;
