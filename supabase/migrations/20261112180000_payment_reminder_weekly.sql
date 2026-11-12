-- Recordatorio de pago semanal (12/11/2026, pedido de Alejandro; pendiente C11 de la lista del 31/10).
-- Todos los lunes a las 8:00 a. m. de Colombia, cada apartamento en mora recibe un recordatorio mientras siga
-- debiendo: aviso dentro de ResiQ y correo (firmado por el conjunto), con el total vencido.
-- * En mora = tiene alguna deuda con saldo que ya llegó a los días de mora del conjunto (Cartera › Días de mora;
--   30 si no se ha configurado). Es el mismo criterio del aviso de mora automático.
-- * Un solo recordatorio por apartamento por semana (no uno por cada deuda).
-- * No se envía a apartamentos con un acuerdo de pago activo: ya están pagando por cuotas.
-- * El aviso queda enlazado a la deuda más antigua del apartamento.
-- * Usa el mismo tipo de aviso de cartera («delinquency_notice»), así que el correo sale con las reglas de siempre
--   (modo de prueba, dominio verificado, correo de facturas del censo).
begin;

create or replace function private.enqueue_payment_reminders(target_property_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare item record; processed integer := 0; threshold integer; zone text; today date; week text;
begin
  select coalesce((select pp.minimum_overdue_days from public.property_policies pp where pp.property_id = target_property_id), 30) into threshold;
  select p.timezone into zone from public.properties p where p.id = target_property_id;
  today := (now() at time zone zone)::date;
  week := to_char(today, 'IYYY-"S"IW');
  for item in
    with debts as (
      select ar.id, ar.unit_id, ar.due_on, ar.currency, private.receivable_outstanding(ar.id) outstanding
      from public.accounts_receivable ar
      where ar.property_id = target_property_id and ar.status = 'active' and ar.due_on < today
    )
    select d.unit_id, (array_agg(d.id order by d.due_on))[1] oldest_id, sum(d.outstanding) total, count(*) debts_count, min(d.due_on) oldest_due, max(d.currency) currency
    from debts d
    where d.outstanding > 0
    group by d.unit_id
    having today - min(d.due_on) >= threshold
      and not exists (select 1 from public.payment_agreements pa where pa.property_id = target_property_id and pa.unit_id = d.unit_id and pa.status = 'active')
  loop
    perform private.enqueue_finance_notification(target_property_id, item.unit_id, 'receivable', item.oldest_id, 'delinquency_notice', 'Recordatorio de pago',
      'Tu apartamento tiene saldo vencido. Te recordamos ponerte al día con la administración.', 'unit:' || item.unit_id || ':reminder:' || week,
      jsonb_build_object('heading', 'Recordatorio de pago', 'concept', 'Saldo vencido (' || item.debts_count || case when item.debts_count = 1 then ' obligación)' else ' obligaciones)' end,
        'amount', item.total, 'currency', item.currency, 'due_on', item.oldest_due, 'overdue_days', today - item.oldest_due));
    processed := processed + 1;
  end loop;
  return processed;
end;
$$;
revoke all on function private.enqueue_payment_reminders(uuid) from public, anon, authenticated;

create or replace function private.process_all_payment_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare target uuid; total integer := 0;
begin
  for target in select distinct ar.property_id from public.accounts_receivable ar where ar.status = 'active' loop
    begin
      total := total + private.enqueue_payment_reminders(target);
    exception when others then
      raise warning 'recordatorio de pago falló para %: %', target, sqlerrm;
    end;
  end loop;
  return total;
end;
$$;
revoke all on function private.process_all_payment_reminders() from public, anon, authenticated;

-- Lunes 13:00 UTC = lunes 8:00 a. m. en Colombia.
select cron.unschedule(jobid) from cron.job where jobname = 'payment-reminders-weekly';
select cron.schedule('payment-reminders-weekly', '0 13 * * 1', $job$ select private.process_all_payment_reminders(); $job$);

commit;

-- Debe dar true.
select exists(select 1 from cron.job where jobname = 'payment-reminders-weekly') as recordatorio_semanal;
