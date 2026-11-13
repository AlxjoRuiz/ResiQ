-- Origen de los pagos en el historial (13/11/2026, pedido de Alejandro). Para que las tarjetas del historial digan de
-- dónde salió cada pago, se guarda cuándo un pago se subió en Excel («Importar pagos»). Los demás orígenes ya se saben:
-- comprobante del residente (finance_payment_evidence.payment_id), saldo a favor (payments.credit_id) y, si no es
-- ninguno, registrado a mano por la administración.
-- Los pagos que ya se importaron antes de hoy no se pueden distinguir y salen como «registrado a mano».
begin;

alter table public.payments add column if not exists origin text check (origin is null or origin in ('excel'));

-- Igual que 20261113340000, y marca cada pago importado con origin = 'excel'.
create or replace function public.import_payments(target_property_id uuid, target_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item jsonb; line integer; unit_value uuid; amount_value numeric; paid_value date; reference_value text; concept_value text;
  target_receivable uuid; target_outstanding numeric; allocations jsonb; imported integer := 0; skipped integer := 0; created_payment uuid;
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
      created_payment := public.record_payment(target_property_id, unit_value, amount_value, paid_value, reference_value, allocations, gen_random_uuid());
      -- Origen del pago: subido por la administración en Excel.
      update public.payments set origin = 'excel' where id = created_payment;
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

notify pgrst, 'reload schema';

-- Debe dar true.
select exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'payments' and column_name = 'origin')
  and pg_get_functiondef('public.import_payments(uuid,jsonb)'::regprocedure) like '%origin = ''excel''%' as origen_de_pagos;
