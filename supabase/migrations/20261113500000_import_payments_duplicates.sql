-- Importar pagos: pagos iguales se distinguen por la referencia (13/11/2026, pedido de Alejandro). Un residente puede
-- hacer dos transferencias del mismo valor el mismo día, así que «mismo apartamento, fecha y valor» no basta para saber
-- si un pago ya estaba registrado.
-- * Con referencia: si ya hay un pago vigente del apartamento con la misma fecha, valor y REFERENCIA, es la misma
--   transferencia subida otra vez y se salta. Con otra referencia es otro pago y se registra.
-- * Sin referencia: si ya hay un pago vigente del apartamento con la misma fecha y valor, la fila da error
--   (possible_duplicate_no_reference) para que escriban la referencia que lo distinga; no se salta en silencio.
-- * En el mismo archivo, dos filas del mismo apartamento, fecha y valor con la misma referencia o sin referencia dan error
--   (duplicate_in_file).
-- * La respuesta trae las filas que se saltaron (skipped_lines) para decirlas en el mensaje.
-- * Sin la columna concepto (13/11/2026): cada pago baja la deuda del apartamento de la más antigua a la más nueva.
-- Todo el archivo o nada, como antes; los pagos quedan con origin = 'excel'.
begin;

create or replace function public.import_payments(target_property_id uuid, target_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item jsonb; line integer; unit_value uuid; amount_value numeric; paid_value date; reference_value text; row_key text;
  seen text[] := '{}'; skipped_lines integer[] := '{}'; imported integer := 0; created_payment uuid;
begin
  if not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if target_rows is null or jsonb_typeof(target_rows) <> 'array' or jsonb_array_length(target_rows) not between 1 and 5000 then raise exception 'invalid_import'; end if;
  for item in select value from jsonb_array_elements(target_rows) loop
    line := (item ->> 'line')::integer;
    begin
      unit_value := (item ->> 'unit_id')::uuid; amount_value := (item ->> 'amount')::numeric; paid_value := (item ->> 'paid_on')::date;
      reference_value := nullif(trim(item ->> 'reference'), '');
      if amount_value is null or amount_value <= 0 or paid_value is null then raise exception 'invalid_import_row'; end if;
      -- Repetido dentro del mismo archivo.
      row_key := unit_value::text || '|' || paid_value::text || '|' || amount_value::text || '|' || lower(coalesce(reference_value, ''));
      if row_key = any(seen) then raise exception 'duplicate_in_file'; end if;
      seen := array_append(seen, row_key);
      -- Ya registrado antes.
      if reference_value is not null then
        if exists (select 1 from public.payments p where p.property_id = target_property_id and p.unit_id = unit_value and p.status = 'posted'
                   and p.paid_on = paid_value and p.amount = amount_value and lower(coalesce(p.reference, '')) = lower(reference_value)) then
          skipped_lines := array_append(skipped_lines, line);
          continue;
        end if;
      elsif exists (select 1 from public.payments p where p.property_id = target_property_id and p.unit_id = unit_value and p.status = 'posted'
                    and p.paid_on = paid_value and p.amount = amount_value) then
        raise exception 'possible_duplicate_no_reference';
      end if;
      created_payment := public.record_payment(target_property_id, unit_value, amount_value, paid_value, reference_value, '[]'::jsonb, gen_random_uuid());
      update public.payments set origin = 'excel' where id = created_payment;
      imported := imported + 1;
    exception when others then
      raise exception 'fila %: %', line, sqlerrm;
    end;
  end loop;
  if imported > 0 then
    perform private.write_property_audit(target_property_id, 'payment.batch_imported', 'payment', null,
      jsonb_build_object('rows', imported, 'skipped', coalesce(array_length(skipped_lines, 1), 0)));
  end if;
  return jsonb_build_object('imported', imported, 'skipped', coalesce(array_length(skipped_lines, 1), 0), 'skipped_lines', to_jsonb(skipped_lines));
end;
$$;
revoke all on function public.import_payments(uuid, jsonb) from public, anon;
grant execute on function public.import_payments(uuid, jsonb) to authenticated;

commit;

-- Debe dar true.
select pg_get_functiondef('public.import_payments(uuid,jsonb)'::regprocedure) like '%possible_duplicate_no_reference%' as pagos_iguales_por_referencia;
