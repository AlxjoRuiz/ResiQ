-- Importar pagos con concepto (13/11/2026, pedido de Alejandro). Columna opcional «concepto» en el Excel de pagos para
-- decir a qué deuda pertenece el pago (por ejemplo «Cuota de administración marzo 2026»).
-- * Con concepto: el pago va primero a la deuda del apartamento con ese concepto (se compara sin mayúsculas, tildes ni
--   espacios de más). Si hay varias con el mismo concepto, a la más antigua que tenga saldo. Lo que sobre después baja
--   las demás deudas, de la más antigua a la más nueva (como record_payment).
-- * Sin concepto: como antes, de la más antigua a la más nueva.
-- * Si el apartamento no tiene una deuda con ese concepto, o ya está pagada, la fila da error y no se carga nada.
-- Igual que 20261113320000 salvo el concepto.
begin;

create or replace function private.concept_key(value text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(lower(translate(trim(coalesce(value, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '\s+', ' ', 'g');
$$;
revoke all on function private.concept_key(text) from public, anon, authenticated;

create or replace function public.import_payments(target_property_id uuid, target_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item jsonb; line integer; unit_value uuid; amount_value numeric; paid_value date; reference_value text; concept_value text;
  target_receivable uuid; target_outstanding numeric; allocations jsonb; imported integer := 0; skipped integer := 0;
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if target_rows is null or jsonb_typeof(target_rows) <> 'array' or jsonb_array_length(target_rows) not between 1 and 5000 then raise exception 'invalid_import'; end if;
  for item in select value from jsonb_array_elements(target_rows) loop
    line := (item ->> 'line')::integer;
    begin
      unit_value := (item ->> 'unit_id')::uuid; amount_value := (item ->> 'amount')::numeric; paid_value := (item ->> 'paid_on')::date;
      reference_value := nullif(trim(item ->> 'reference'), ''); concept_value := nullif(trim(item ->> 'concept'), '');
      if amount_value is null or amount_value <= 0 or paid_value is null then raise exception 'invalid_import_row'; end if;
      if exists (select 1 from public.payments p where p.property_id = target_property_id and p.unit_id = unit_value and p.status = 'posted'
                 and p.paid_on = paid_value and p.amount = amount_value and coalesce(p.reference, '') = coalesce(reference_value, '')) then
        skipped := skipped + 1;
        continue;
      end if;
      allocations := '[]'::jsonb;
      if concept_value is not null then
        select ar.id, private.receivable_outstanding(ar.id) into target_receivable, target_outstanding
        from public.accounts_receivable ar
        where ar.property_id = target_property_id and ar.unit_id = unit_value and ar.status = 'active'
          and private.concept_key(ar.concept) = private.concept_key(concept_value)
        order by (private.receivable_outstanding(ar.id) > 0) desc, ar.due_on, ar.issued_on, ar.created_at limit 1;
        if target_receivable is null then raise exception 'concept_not_found'; end if;
        if target_outstanding <= 0 then raise exception 'concept_already_paid'; end if;
        allocations := jsonb_build_array(jsonb_build_object('receivable_id', target_receivable, 'amount', least(amount_value, target_outstanding)));
      end if;
      perform public.record_payment(target_property_id, unit_value, amount_value, paid_value, reference_value, allocations, gen_random_uuid());
      imported := imported + 1;
      target_receivable := null; target_outstanding := null;
    exception when others then
      raise exception 'fila %: %', line, sqlerrm;
    end;
  end loop;
  if imported > 0 then
    perform private.write_property_audit(target_property_id, 'payment.batch_imported', 'payment', null, jsonb_build_object('rows', imported, 'skipped', skipped));
  end if;
  return jsonb_build_object('imported', imported, 'skipped', skipped);
end;
$$;
revoke all on function public.import_payments(uuid, jsonb) from public, anon;
grant execute on function public.import_payments(uuid, jsonb) to authenticated;

commit;

-- Debe dar true.
select pg_get_functiondef('public.import_payments(uuid,jsonb)'::regprocedure) like '%concept_not_found%' as pagos_con_concepto;
