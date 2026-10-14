-- Read-only check for the overnight reservation of 15/10/2026 in Bosques.
-- Returns counts only; no names, email addresses, or notification bodies.
select
  r.id as reservation_id,
  r.status,
  to_char(r.starts_at at time zone p.timezone,'DD/MM/YYYY HH24:MI') as local_start,
  (select count(*) from public.property_members pm
   where pm.property_id=r.property_id and pm.status='active' and 'concierge'=any(pm.roles)) as active_concierges,
  (select count(*) from public.notifications n
   join public.property_members pm on pm.id=n.recipient_member_id and pm.property_id=n.property_id
   where n.property_id=r.property_id and n.target_type='reservation' and n.target_id=r.id
     and n.type='reservation_cancelled' and 'concierge'=any(pm.roles)) as concierge_cancel_notices,
  (select count(*) from public.notifications n
   where n.property_id=r.property_id and n.target_type='reservation' and n.target_id=r.id
     and n.type='reservation_cancelled') as total_cancel_notices,
  (select t.tgenabled from pg_trigger t
   where t.tgrelid='public.reservations'::regclass and t.tgname='reservations_notify_concierge_status') as concierge_trigger_enabled
from public.reservations r
join public.properties p on p.id=r.property_id
where r.property_id='1bde3475-3ed2-4f57-bd13-39784b12d2a6'
  and r.starts_at at time zone p.timezone >= timestamp '2026-10-15 00:00'
  and r.starts_at at time zone p.timezone < timestamp '2026-10-16 00:00'
order by r.created_at desc
limit 10;
