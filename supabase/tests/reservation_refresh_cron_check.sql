-- Read-only check after applying 20261008230000_schedule_reservation_refresh.sql.
-- The job should be active and have a successful run within a few minutes.
select jobid, jobname, schedule, active, command
from cron.job
where jobname = 'refresh-reservation-states';

select status, start_time, end_time, return_message
from cron.job_run_details
where jobid = (
  select jobid from cron.job where jobname = 'refresh-reservation-states'
)
order by start_time desc
limit 5;
