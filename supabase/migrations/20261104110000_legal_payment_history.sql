-- Módulo jurídico (04/11/2026, pedido de Alejandro): historial de pagos del apartamento para la abogada.
-- * Cada pago trae la fecha de pago, lo que pagó (conceptos), el comprobante que lo respaldó (la abogada lo
--   puede abrir) y, si se anuló, el motivo y la fecha de anulación.
-- * «Corregido»: un pago anulado cuyo comprobante se volvió a enviar para la misma deuda o cuota y ese nuevo
--   pago quedó registrado. El pago nuevo dice que corrige el anulado.
-- * legal_evidence_file: la abogada abre un comprobante solo si es de un conjunto asignado; queda en auditoría.
begin;

-- Pago registrado (vigente) que reemplazó a un pago anulado: el comprobante siguiente para la misma deuda o cuota.
create or replace function private.legal_payment_correction(target_property_id uuid, target_payment_id uuid)
returns table(corrected_by uuid, corrected_on date) language sql stable security definer set search_path = '' as $$
  select p2.id, p2.paid_on
  from public.finance_payment_evidence e
  join public.finance_payment_evidence e2 on e2.property_id = e.property_id and e2.unit_id = e.unit_id and e2.created_at > e.created_at and e2.payment_id is not null
    and ((e.agreement_installment_id is not null and e2.agreement_installment_id = e.agreement_installment_id)
      or (e.agreement_installment_id is null and e2.agreement_installment_id is null and e2.receivable_id = e.receivable_id))
  join public.payments p2 on p2.property_id = e2.property_id and p2.id = e2.payment_id and p2.status = 'posted'
  where e.property_id = target_property_id and e.voided_payment_id = target_payment_id
  order by e2.created_at limit 1;
$$;
revoke all on function private.legal_payment_correction(uuid, uuid) from public, anon, authenticated;

-- Abogada: detalle de un apartamento en solo lectura. Igual que antes; los pagos traen además lo pagado,
-- el comprobante, la anulación y si fue corregido. Cada consulta queda en auditoría.
create or replace function public.legal_unit_detail(target_property_id uuid, target_unit_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; today date;
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.units where property_id = target_property_id and id = target_unit_id) then raise exception 'unit_not_found'; end if;
  select (now() at time zone p.timezone)::date into today from public.properties p where p.id = target_property_id;
  select jsonb_build_object(
    'unit', (select jsonb_build_object('building', b.name, 'code', u.code, 'floor', u.floor) from public.units u join public.buildings b on b.property_id = u.property_id and b.id = u.building_id where u.id = target_unit_id),
    'property', (select p.name from public.properties p where p.id = target_property_id),
    'overdue_days', private.property_overdue_days(target_property_id),
    'today', today,
    'signer', (select p.display_name from public.profiles p where p.id = auth.uid()),
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('name', c.full_name, 'type', c.user_type, 'email', c.email_normalized, 'phone', c.phone, 'primary', c.invitation_primary) order by c.invitation_primary desc, c.source_row)
      from public.census_records c where c.property_id = target_property_id and c.unit_id = target_unit_id), '[]'::jsonb),
    'receivables', coalesce((select jsonb_agg(jsonb_build_object('id', ar.id, 'concept', ar.concept, 'amount', ar.amount, 'outstanding', private.receivable_outstanding(ar.id), 'issued_on', ar.issued_on, 'due_on', ar.due_on, 'status', ar.status, 'source', ar.source) order by ar.due_on desc, ar.created_at desc)
      from public.accounts_receivable ar where ar.property_id = target_property_id and ar.unit_id = target_unit_id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'amount', p.amount, 'paid_on', p.paid_on, 'reference', p.reference, 'status', p.status,
        'voided_at', p.voided_at, 'void_reason', p.void_reason, 'recorded_at', p.created_at,
        'concepts', private.legal_payment_concepts(p.property_id, p.id),
        'evidence_id', ev.id, 'evidence_name', ev.original_name,
        'corrected_on', (select c.corrected_on from private.legal_payment_correction(p.property_id, p.id) c),
        'corrects', exists(select 1 from public.finance_payment_evidence v where v.property_id = p.property_id and v.voided_payment_id is not null
          and (select c.corrected_by from private.legal_payment_correction(v.property_id, v.voided_payment_id) c) = p.id)
      ) order by p.paid_on desc, p.created_at desc)
      from public.payments p
      left join lateral (select e.id, e.original_name from public.finance_payment_evidence e
        where e.property_id = p.property_id and (e.payment_id = p.id or e.voided_payment_id = p.id) order by e.created_at desc limit 1) ev on true
      where p.property_id = target_property_id and p.unit_id = target_unit_id), '[]'::jsonb),
    'agreements', coalesce((select jsonb_agg(jsonb_build_object('total', g.total_amount, 'status', g.status, 'notes', g.notes, 'created_at', g.created_at,
        'installments', coalesce((select jsonb_agg(jsonb_build_object('amount', i.amount, 'due_on', i.due_on) order by i.due_on) from public.payment_agreement_installments i where i.property_id = g.property_id and i.agreement_id = g.id), '[]'::jsonb)) order by g.created_at desc)
      from public.payment_agreements g where g.property_id = target_property_id and g.unit_id = target_unit_id), '[]'::jsonb)
  ) into result;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (target_property_id, auth.uid(), 'property', 'legal.unit_viewed', 'unit', target_unit_id, '{}'::jsonb);
  return result;
end;
$$;

-- Abogada: archivo de un comprobante de un conjunto asignado (el servidor lo abre con un enlace temporal).
create or replace function public.legal_evidence_file(target_evidence_id uuid)
returns table(bucket text, object_path text) language plpgsql security definer set search_path = '' as $$
declare e public.finance_payment_evidence%rowtype;
begin
  select * into e from public.finance_payment_evidence where id = target_evidence_id;
  if auth.uid() is null or not found or private.legal_staff_id() is null or not private.legal_can_view(e.property_id) then raise exception 'not_authorized'; end if;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (e.property_id, auth.uid(), 'property', 'legal.evidence_viewed', 'finance_payment_evidence', e.id, jsonb_build_object('unit_id', e.unit_id));
  return query select e.bucket, e.object_path;
end;
$$;
revoke all on function public.legal_evidence_file(uuid) from public, anon;
grant execute on function public.legal_evidence_file(uuid) to authenticated;

commit;

-- Debe dar true.
select has_function_privilege('authenticated', 'public.legal_evidence_file(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.legal_evidence_file(uuid)', 'execute') as historial_de_pagos;
