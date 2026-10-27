-- Cartera › Estado por apartamento (27/10/2026): concepto de lo que debe cada apartamento. Devuelve,
-- por apartamento visible para la cuenta, los conceptos de sus obligaciones con saldo pendiente,
-- de la más antigua a la más reciente.
begin;

create or replace function public.list_unit_pending_concepts(target_property_id uuid)
returns table(unit_id uuid, concepts text[])
language sql stable security definer set search_path = '' as $$
  select ar.unit_id, array_agg(ar.concept order by ar.due_on, ar.created_at)
  from public.accounts_receivable ar
  where ar.property_id = target_property_id and ar.status = 'active'
    and private.can_access_unit_finance(ar.property_id, ar.unit_id)
    and private.receivable_outstanding(ar.id) > 0
  group by ar.unit_id;
$$;
revoke all on function public.list_unit_pending_concepts(uuid) from public, anon;
grant execute on function public.list_unit_pending_concepts(uuid) to authenticated;

commit;

select has_function_privilege('authenticated', 'public.list_unit_pending_concepts(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.list_unit_pending_concepts(uuid)', 'execute') as conceptos_disponibles;
