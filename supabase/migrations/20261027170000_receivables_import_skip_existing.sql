-- Cartera sin columna «referencia» (decisión de Alejandro, 27/10/2026). La app identifica cada fila
-- por apartamento, concepto, emisión y valor (referencia automática). Las obligaciones que ya estaban
-- cargadas se saltan en vez de rechazar todo el lote, para poder descargar la cartera, agregar los
-- cobros nuevos y volver a importarla. Igual a 20261025240000; solo cambia el manejo de repetidas.
begin;

create or replace function public.import_receivables(target_property_id uuid,target_batch_id uuid,target_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare item jsonb; created_id uuid; imported integer:=0; unit_id_value uuid; amount_value numeric; issued_value date; due_value date; source_value text; reference_value text; concept_value text; touched_units uuid[]:='{}';
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if target_batch_id is null or target_rows is null or jsonb_typeof(target_rows)<>'array' or jsonb_array_length(target_rows)<1 then raise exception 'invalid_import'; end if;
  for item in select value from jsonb_array_elements(target_rows) loop
    unit_id_value:=(item->>'unit_id')::uuid; amount_value:=(item->>'amount')::numeric; issued_value:=(item->>'issued_on')::date; due_value:=(item->>'due_on')::date;
    source_value:=coalesce(nullif(item->>'source',''),'import'); reference_value:=nullif(trim(item->>'external_reference'),''); concept_value:=trim(item->>'concept');
    if source_value not in ('import','opening_balance') or reference_value is null or char_length(reference_value)>120 or char_length(concept_value) not between 2 and 180 or amount_value<=0 or due_value<issued_value then raise exception 'invalid_import_row'; end if;
    if not exists(select 1 from public.units where id=unit_id_value and property_id=target_property_id and status='active') then raise exception 'unit_not_found'; end if;
    -- Ya cargada (en otra importación o repetida en este archivo): se salta.
    continue when exists(select 1 from public.accounts_receivable ar where ar.property_id=target_property_id and ar.source=source_value and ar.external_reference=reference_value);
    perform private.lock_unit_finance(target_property_id,unit_id_value);
    insert into public.accounts_receivable(property_id,unit_id,concept,amount,currency,issued_on,due_on,source,external_reference,import_batch_id,recorded_by)
    values(target_property_id,unit_id_value,concept_value,amount_value,'COP',issued_value,due_value,source_value,reference_value,target_batch_id,auth.uid()) returning id into created_id;
    insert into public.activity_events(property_id,receivable_id,actor_id,event_type,new_state,description) values(target_property_id,created_id,auth.uid(),'receivable_created','active','Obligación importada');
    imported:=imported+1;
    if not unit_id_value = any(touched_units) then touched_units:=array_append(touched_units,unit_id_value); end if;
  end loop;
  -- Solo se avisa a los apartamentos que recibieron obligaciones nuevas.
  foreach unit_id_value in array touched_units loop
    perform private.enqueue_finance_notification(target_property_id,unit_id_value,'receivable',target_batch_id,'receivable_created','Cartera actualizada','La administración importó nuevas obligaciones en tu cuenta.','receivable-batch:'||target_batch_id||':'||unit_id_value,jsonb_build_object('batch_id',target_batch_id));
  end loop;
  if imported>0 then
    perform private.write_property_audit(target_property_id,'receivable.batch_imported','accounts_receivable',target_batch_id,jsonb_build_object('rows',imported,'batch_id',target_batch_id));
  end if;
  return imported;
end;
$$;

commit;

select pg_get_functiondef('public.import_receivables(uuid,uuid,jsonb)'::regprocedure) like '%continue when exists%' as salta_repetidas;
