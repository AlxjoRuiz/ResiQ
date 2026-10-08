-- Refresh reservation states without waiting for a member to open the app.
-- pg_cron is already enabled for the email worker.
create index if not exists reservations_pending_expiry_idx
  on public.reservations(hold_expires_at, property_id)
  where status = 'pending';

create index if not exists reservations_approved_end_idx
  on public.reservations(ends_at, property_id)
  where status = 'approved';

select cron.schedule(
  'refresh-reservation-states',
  '* * * * *',
  $job$
    select private.refresh_reservation_states(due.property_id)
    from (
      select distinct property_id
      from public.reservations
      where (status = 'pending' and hold_expires_at <= now())
         or (status = 'approved' and ends_at <= now())
    ) as due;
  $job$
);
