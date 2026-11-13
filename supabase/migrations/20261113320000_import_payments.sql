-- Importar pagos desde Excel (13/11/2026, pedido de Alejandro), igual que «Importar cartera».
-- * Cada fila es un pago de un apartamento con su fecha de pago, que se registra con public.record_payment: baja las
--   deudas del apartamento de la que vence primero a la última, avisa al residente («Pago registrado») y queda con su
--   fecha de pago para la abogada y el informe.
-- * Todo el archivo o nada: si una fila falla (por ejemplo, el pago es mayor que lo que debe el apartamento), no se
--   registra ninguna y el error dice la fila.
-- * Repetidos: si ya hay un pago vigente del mismo apartamento con la misma fecha, valor y referencia (o una fila igual
--   antes en el mismo archivo), se salta para no registrarlo dos veces.
begin;

create or replace function public.import_payments(target_property_id uuid, target_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item jsonb; line integer; unit_value uuid; amount_value numeric; paid_value date; reference_value text; imported integer := 0; skipped integer := 0;
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if target_rows is null or jsonb_typeof(target_rows) <> 'array' or jsonb_array_length(target_rows) not between 1 and 5000 then raise exception 'invalid_import'; end if;
  for item in select value from jsonb_array_elements(target_rows) loop
    line := (item ->> 'line')::integer;
    begin
      unit_value := (item ->> 'unit_id')::uuid; amount_value := (item ->> 'amount')::numeric; paid_value := (item ->> 'paid_on')::date;
      reference_value := nullif(trim(item ->> 'reference'), '');
      if amount_value is null or amount_value <= 0 or paid_value is null then raise exception 'invalid_import_row'; end if;
      if exists (select 1 from public.payments p where p.property_id = target_property_id and p.unit_id = unit_value and p.status = 'posted'
                 and p.paid_on = paid_value and p.amount = amount_value and coalesce(p.reference, '') = coalesce(reference_value, '')) then
        skipped := skipped + 1;
        continue;
      end if;
      perform public.record_payment(target_property_id, unit_value, amount_value, paid_value, reference_value, '[]'::jsonb, gen_random_uuid());
      imported := imported + 1;
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
select exists(select 1 from pg_proc where proname = 'import_payments') as importar_pagos;
