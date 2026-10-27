-- Plataforma › Métricas por mes (27/10/2026): uso por conjunto y correos del mes elegido (hora de
-- Colombia). Las cuentas activas siguen siendo de los últimos 7 y 30 días: Supabase solo guarda la
-- última entrada de cada cuenta, no el historial por mes.
begin;

create or replace function public.platform_usage_by_month(target_month date)
returns table(property_id uuid, property_name text, pqrs_count integer, package_count integer, visitor_count integer, reservation_count integer)
language plpgsql stable security definer set search_path = '' as $$
declare month_start timestamptz; month_end timestamptz;
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  month_start := date_trunc('month', target_month)::timestamp at time zone 'America/Bogota';
  month_end := (date_trunc('month', target_month) + interval '1 month')::timestamp at time zone 'America/Bogota';
  return query
  select p.id, p.name,
    (select count(*)::integer from public.pqrs x where x.property_id = p.id and x.created_at >= month_start and x.created_at < month_end),
    (select count(*)::integer from public.packages x where x.property_id = p.id and x.created_at >= month_start and x.created_at < month_end),
    (select count(*)::integer from public.visitors x where x.property_id = p.id and x.created_at >= month_start and x.created_at < month_end),
    (select count(*)::integer from public.reservations x where x.property_id = p.id and x.created_at >= month_start and x.created_at < month_end)
  from public.properties p order by p.name;
end;
$$;

create or replace function public.platform_email_metrics_by_month(target_month date)
returns table(emails_sent integer, emails_held integer, emails_failed integer, emails_pending integer)
language plpgsql stable security definer set search_path = '' as $$
declare month_start timestamptz; month_end timestamptz;
begin
  if auth.uid() is null or not private.is_active_platform_admin() then raise exception 'not_authorized'; end if;
  month_start := date_trunc('month', target_month)::timestamp at time zone 'America/Bogota';
  month_end := (date_trunc('month', target_month) + interval '1 month')::timestamp at time zone 'America/Bogota';
  return query
  select
    count(*) filter (where j.status = 'accepted')::integer,
    count(*) filter (where j.status = 'held')::integer,
    count(*) filter (where j.status = 'failed')::integer,
    count(*) filter (where j.status in ('queued','processing'))::integer
  from public.email_jobs j where j.created_at >= month_start and j.created_at < month_end;
end;
$$;

revoke all on function public.platform_usage_by_month(date), public.platform_email_metrics_by_month(date) from public, anon;
grant execute on function public.platform_usage_by_month(date), public.platform_email_metrics_by_month(date) to authenticated;

commit;

select has_function_privilege('authenticated', 'public.platform_usage_by_month(date)', 'execute')
  and has_function_privilege('authenticated', 'public.platform_email_metrics_by_month(date)', 'execute')
  and not has_function_privilege('anon', 'public.platform_usage_by_month(date)', 'execute') as metricas_por_mes;
