-- Módulo jurídico (05/11/2026, pedido de Alejandro): en la cartera del apartamento la abogada ve las anulaciones.
-- * Cobros anulados (administración, multas, otras deudas): motivo, fecha y quién lo anuló.
-- * Acuerdos de pago cancelados: motivo, fecha y quién lo canceló.
-- Lo demás de legal_unit_detail queda igual (incluye quién pagó y quién anuló cada pago).
begin;

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
    'receivables', coalesce((select jsonb_agg(jsonb_build_object('id', ar.id, 'concept', ar.concept, 'amount', ar.amount, 'outstanding', private.receivable_outstanding(ar.id), 'issued_on', ar.issued_on, 'due_on', ar.due_on, 'status', ar.status, 'source', ar.source,
        'void_reason', ar.void_reason, 'voided_at', ar.voided_at, 'voided_by_name', (select pr.display_name from public.profiles pr where pr.id = ar.voided_by)) order by ar.due_on desc, ar.created_at desc)
      from public.accounts_receivable ar where ar.property_id = target_property_id and ar.unit_id = target_unit_id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'amount', p.amount, 'paid_on', p.paid_on, 'reference', p.reference, 'status', p.status,
        'voided_at', p.voided_at, 'void_reason', p.void_reason, 'recorded_at', p.created_at,
        'concepts', private.legal_payment_concepts(p.property_id, p.id),
        'evidence_id', ev.id, 'evidence_name', ev.original_name,
        'payer_name', (select pr.display_name from public.profiles pr where pr.id = ev.uploaded_by),
        'recorded_by_name', (select pr.display_name from public.profiles pr where pr.id = p.recorded_by),
        'voided_by_name', (select pr.display_name from public.profiles pr where pr.id = p.voided_by),
        'corrected_on', (select c.corrected_on from private.legal_payment_correction(p.property_id, p.id) c),
        'corrects', exists(select 1 from public.finance_payment_evidence v where v.property_id = p.property_id and v.voided_payment_id is not null
          and (select c.corrected_by from private.legal_payment_correction(v.property_id, v.voided_payment_id) c) = p.id)
      ) order by p.paid_on desc, p.created_at desc)
      from public.payments p
      left join lateral (select e.id, e.original_name, e.uploaded_by from public.finance_payment_evidence e
        where e.property_id = p.property_id and (e.payment_id = p.id or e.voided_payment_id = p.id) order by e.created_at desc limit 1) ev on true
      where p.property_id = target_property_id and p.unit_id = target_unit_id), '[]'::jsonb),
    'agreements', coalesce((select jsonb_agg(jsonb_build_object('total', g.total_amount, 'status', g.status, 'notes', g.notes, 'created_at', g.created_at,
        'cancel_reason', g.cancel_reason, 'cancelled_at', g.cancelled_at, 'cancelled_by_name', (select pr.display_name from public.profiles pr where pr.id = g.cancelled_by),
        'installments', coalesce((select jsonb_agg(jsonb_build_object('amount', i.amount, 'due_on', i.due_on) order by i.due_on) from public.payment_agreement_installments i where i.property_id = g.property_id and i.agreement_id = g.id), '[]'::jsonb)) order by g.created_at desc)
      from public.payment_agreements g where g.property_id = target_property_id and g.unit_id = target_unit_id), '[]'::jsonb)
  ) into result;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (target_property_id, auth.uid(), 'property', 'legal.unit_viewed', 'unit', target_unit_id, '{}'::jsonb);
  return result;
end;
$$;

commit;

-- Debe dar true.
select pg_get_functiondef('public.legal_unit_detail(uuid,uuid)'::regprocedure) like '%cancelled_by_name%' as anulaciones;
