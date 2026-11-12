-- Aviso de mora automático (12/11/2026, pedido de Alejandro; pendiente C10 de la lista del 31/10).
-- Antes el aviso «Aviso de mora» solo se generaba cuando el administrador abría Cartera
-- (public.process_delinquency_notifications). Ahora también corre solo todos los días a las 8:00 a. m. de Colombia:
-- * Cada obligación con saldo que llega a los días de mora del conjunto (Cartera › Días de mora; 30 si no se ha
--   configurado) genera un aviso al apartamento: aviso dentro de ResiQ y correo (firmado por el conjunto).
-- * Solo las que cruzaron el umbral en los últimos 7 días: así no se envía de golpe un aviso por cada deuda vieja
--   el primer día, y si el trabajo no corrió algún día, se pone al día.
-- * Nunca se repite: el mismo aviso (obligación + umbral) solo se envía una vez, sea automático o al abrir Cartera.
-- * El correo externo sigue las reglas de siempre (modo de prueba, dominio verificado, correo de facturas del censo).
begin;

-- Lógica común, sin revisar permisos (la llaman la función del administrador y el trabajo diario).
-- recent_days null = todas las que superan el umbral (comportamiento de siempre al abrir Cartera).
create or replace function private.enqueue_delinquency_notices(target_property_id uuid, recent_days integer default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare item record; processed integer := 0; threshold integer;
begin
  select coalesce((select pp.minimum_overdue_days from public.property_policies pp where pp.property_id = target_property_id), 30) into threshold;
  for item in
    select ar.*, private.receivable_outstanding(ar.id) outstanding, p.timezone, (now() at time zone p.timezone)::date - ar.due_on overdue_days
    from public.accounts_receivable ar join public.properties p on p.id = ar.property_id
    where ar.property_id = target_property_id and ar.status = 'active'
      and (now() at time zone p.timezone)::date - ar.due_on >= threshold
      and (recent_days is null or (now() at time zone p.timezone)::date - ar.due_on < threshold + recent_days)
      and private.receivable_outstanding(ar.id) > 0
  loop
    perform private.enqueue_finance_notification(item.property_id, item.unit_id, 'receivable', item.id, 'delinquency_notice', 'Aviso de mora',
      'Tu cuenta presenta una obligación que alcanzó el umbral de mora.', 'receivable:' || item.id || ':delinquency:' || threshold,
      jsonb_build_object('receivable_id', item.id, 'concept', item.concept, 'amount', item.outstanding, 'currency', item.currency, 'due_on', item.due_on, 'overdue_days', item.overdue_days));
    processed := processed + 1;
  end loop;
  return processed;
end;
$$;
revoke all on function private.enqueue_delinquency_notices(uuid, integer) from public, anon, authenticated;

-- La del administrador (al abrir Cartera) queda igual por fuera, ahora usando la lógica común.
create or replace function public.process_delinquency_notifications(target_property_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  return private.enqueue_delinquency_notices(target_property_id, null);
end;
$$;

-- Trabajo diario: todos los conjuntos con cartera activa. Un conjunto con error no detiene a los demás.
create or replace function private.process_all_delinquency_notices()
returns integer language plpgsql security definer set search_path = '' as $$
declare target uuid; total integer := 0;
begin
  for target in select distinct ar.property_id from public.accounts_receivable ar where ar.status = 'active' loop
    begin
      total := total + private.enqueue_delinquency_notices(target, 7);
    exception when others then
      raise warning 'aviso de mora automático falló para %: %', target, sqlerrm;
    end;
  end loop;
  return total;
end;
$$;
revoke all on function private.process_all_delinquency_notices() from public, anon, authenticated;

-- 13:00 UTC = 8:00 a. m. en Colombia.
select cron.unschedule(jobid) from cron.job where jobname = 'delinquency-notices-daily';
select cron.schedule('delinquency-notices-daily', '0 13 * * *', $job$ select private.process_all_delinquency_notices(); $job$);

commit;

-- Debe dar true.
select exists(select 1 from cron.job where jobname = 'delinquency-notices-daily') as aviso_de_mora_automatico;
