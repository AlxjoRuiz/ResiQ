-- Módulo jurídico (04/11/2026, decisión de Alejandro): el expediente prejurídico se quita de la pantalla y
-- queda en pausa para más adelante (tablas legal_cases, legal_case_actions y legal_case_commitments y sus
-- funciones se conservan). Para que no se sigan abriendo expedientes ocultos, se quitan los disparadores que
-- los abrían al enviar un requerimiento y anotaban las respuestas.
-- La etiqueta «En cobro jurídico» del admin ahora sale cuando la abogada envió un requerimiento de pago al
-- apartamento y este sigue en mora (alguna deuda vencida sin pagar); se quita sola cuando queda al día.
begin;

drop trigger if exists legal_collection_notices_to_case on public.legal_collection_notices;
drop trigger if exists legal_notice_messages_to_case on public.legal_notice_messages;

create or replace function public.property_legal_units(target_property_id uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct n.unit_id), '{}') from public.legal_collection_notices n
  where n.property_id = target_property_id and private.is_active_member(target_property_id, 'administrator')
    and exists(select 1 from public.accounts_receivable ar
      where ar.property_id = n.property_id and ar.unit_id = n.unit_id and ar.status = 'active'
        and ar.due_on < private.property_today(n.property_id) and private.receivable_outstanding(ar.id) > 0);
$$;

commit;

-- Debe dar true.
select not exists(select 1 from pg_trigger where tgname in ('legal_collection_notices_to_case', 'legal_notice_messages_to_case'))
  and pg_get_functiondef('public.property_legal_units(uuid)'::regprocedure) like '%legal_collection_notices%' as etiqueta_por_requerimiento;
