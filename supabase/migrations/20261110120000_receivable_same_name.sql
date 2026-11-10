-- Obligaciones con el mismo nombre (10/11/2026, pedido de Alejandro).
-- * Se quita el bloqueo «Ya existe una obligación con una de esas referencias»: la referencia ya no tiene que ser
--   única en todo el conjunto.
-- * Nueva regla, por apartamento: no se puede registrar una obligación con el mismo nombre (concepto, sin importar
--   mayúsculas) o la misma referencia que otra del apartamento que todavía tenga saldo. Si la anterior ya está pagada
--   (o anulada), sí se puede.
-- * La importación desde Excel sigue saltando las filas que ya estaban cargadas, como antes.
begin;

drop index if exists public.accounts_receivable_external_ref_uidx;
create index if not exists accounts_receivable_external_ref_idx on public.accounts_receivable(property_id, source, external_reference) where external_reference is not null;

create or replace function public.create_receivable(target_property_id uuid,target_unit_id uuid,target_concept text,target_amount numeric,target_issued_on date,target_due_on date,target_external_reference text)
returns uuid language plpgsql security definer set search_path='' as $$
declare created_id uuid; clean_concept text:=trim(target_concept); clean_reference text:=nullif(trim(target_external_reference),'');
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if char_length(clean_concept) not between 2 and 180 or target_amount<=0 or target_due_on<target_issued_on then raise exception 'invalid_input'; end if;
  if not exists(select 1 from public.units where id=target_unit_id and property_id=target_property_id and status='active') then raise exception 'unit_not_found'; end if;
  perform private.lock_unit_finance(target_property_id,target_unit_id);
  -- Mismo nombre o misma referencia que una obligación del apartamento que todavía no está pagada: no se registra.
  if exists(select 1 from public.accounts_receivable ar
      where ar.property_id=target_property_id and ar.unit_id=target_unit_id and ar.status='active'
        and (lower(trim(ar.concept))=lower(clean_concept) or (clean_reference is not null and ar.external_reference=clean_reference))
        and private.receivable_outstanding(ar.id)>0) then
    raise exception 'unpaid_duplicate';
  end if;
  insert into public.accounts_receivable(property_id,unit_id,concept,amount,currency,issued_on,due_on,source,external_reference,recorded_by)
  values(target_property_id,target_unit_id,clean_concept,target_amount,'COP',target_issued_on,target_due_on,'manual',clean_reference,auth.uid()) returning id into created_id;
  insert into public.activity_events(property_id,receivable_id,actor_id,event_type,new_state,description) values(target_property_id,created_id,auth.uid(),'receivable_created','active','Obligación registrada');
  perform private.write_property_audit(target_property_id,'receivable.created','accounts_receivable',created_id,jsonb_build_object('unit_id',target_unit_id,'amount',target_amount));
  perform private.enqueue_finance_notification(target_property_id,target_unit_id,'receivable',created_id,'receivable_created','Nueva obligación registrada','La administración registró una obligación en tu cuenta.','receivable:'||created_id||':created',jsonb_build_object('receivable_id',created_id,'concept',clean_concept,'amount',target_amount,'currency','COP','due_on',target_due_on));
  return created_id;
end;
$$;

commit;

-- Debe dar true y false.
select pg_get_functiondef('public.create_receivable(uuid,uuid,text,numeric,date,date,text)'::regprocedure) like '%unpaid_duplicate%' as mismo_nombre_si_esta_pagada,
  exists(select 1 from pg_indexes where schemaname = 'public' and indexname = 'accounts_receivable_external_ref_uidx') as referencia_unica;
