-- Requerimiento de pago con cuotas del acuerdo (09/11/2026, pedido de Alejandro): además de las deudas, la abogada
-- puede cobrar las cuotas pendientes o vencidas del acuerdo de pago vigente del apartamento. Cada cuota entra al
-- detalle del correo como «Acuerdo de pago · Cuota N de M» con lo que falta de esa cuota, calculado por
-- private.agreement_schedule (el mismo cálculo que ven el admin, el residente y la abogada).
-- * Una deuda que está en el acuerdo no se puede cobrar en el mismo requerimiento que sus cuotas: se cobraría dos veces.
-- * El correo no cambia: ya muestra cada línea con concepto, vencimiento y valor.
begin;

drop function public.legal_send_collection_notice(uuid, uuid, uuid[], text, text, text, jsonb);

create or replace function public.legal_send_collection_notice(target_property_id uuid, target_unit_id uuid, target_receivable_ids uuid[],
  target_recipient_email text, target_subject text, target_message text, target_attachments jsonb default '[]'::jsonb,
  target_installment_ids uuid[] default '{}'::uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.legal_staff_id(); recipient text := lower(trim(coalesce(target_recipient_email, '')));
  clean_subject text := trim(coalesce(target_subject, '')); clean_message text := trim(coalesce(target_message, ''));
  debt_ids uuid[] := coalesce(target_receivable_ids, '{}'::uuid[]); installment_ids uuid[] := coalesce(target_installment_ids, '{}'::uuid[]);
  recipient_label text; item_list jsonb := '[]'::jsonb; debt_items jsonb; installment_items jsonb; total_value numeric; notice_id uuid; live_value boolean;
  signer text; signer_email text; property_label text; unit_label text; active_agreement uuid; schedule jsonb;
begin
  if auth.uid() is null or me is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.units where property_id = target_property_id and id = target_unit_id) then raise exception 'unit_not_found'; end if;
  if char_length(clean_subject) not between 3 and 150 or char_length(clean_message) not between 10 and 5000 then raise exception 'invalid_message'; end if;
  if cardinality(debt_ids) + cardinality(installment_ids) = 0 or cardinality(debt_ids) > 200 or cardinality(installment_ids) > 120 then raise exception 'no_debts_selected'; end if;
  select r.name into recipient_label from private.legal_unit_recipients(target_property_id, target_unit_id) r where r.email = recipient;
  if not found then raise exception 'recipient_not_allowed'; end if;

  -- Deudas: activas, del apartamento y con saldo. El detalle se toma de la base de datos, no del navegador.
  if cardinality(debt_ids) > 0 then
    select jsonb_agg(jsonb_build_object('receivable_id', d.id, 'concept', d.concept, 'due_on', d.due_on, 'outstanding', d.owed) order by d.due_on, d.concept)
    into debt_items
    from (select ar.id, ar.concept, ar.due_on, private.receivable_outstanding(ar.id) as owed from public.accounts_receivable ar
          where ar.property_id = target_property_id and ar.unit_id = target_unit_id and ar.status = 'active' and ar.id = any(debt_ids)) d
    where d.owed > 0;
    if debt_items is null or jsonb_array_length(debt_items) <> (select count(distinct x) from unnest(debt_ids) x) then raise exception 'invalid_debts'; end if;
    item_list := item_list || debt_items;
  end if;

  -- Cuotas del acuerdo vigente del apartamento que todavía tienen saldo.
  if cardinality(installment_ids) > 0 then
    select g.id into active_agreement from public.payment_agreements g
    where g.property_id = target_property_id and g.unit_id = target_unit_id and g.status = 'active'
    order by g.created_at desc limit 1;
    if active_agreement is null then raise exception 'invalid_debts'; end if;
    if exists(select 1 from public.payment_agreement_debts d where d.agreement_id = active_agreement and d.receivable_id = any(debt_ids)) then
      raise exception 'agreement_debt_overlap';
    end if;
    schedule := private.agreement_schedule(active_agreement);
    select jsonb_agg(jsonb_build_object('installment_id', i.id, 'agreement_id', active_agreement,
        'concept', 'Acuerdo de pago · Cuota ' || i.number || ' de ' || jsonb_array_length(schedule -> 'installments'),
        'due_on', i.due_on, 'outstanding', i.due_amount) order by i.number)
    into installment_items
    from jsonb_to_recordset(schedule -> 'installments') as i(id uuid, number integer, due_on date, due_amount numeric, state text)
    where i.id = any(installment_ids) and i.state in ('late', 'pending') and i.due_amount > 0;
    if installment_items is null or jsonb_array_length(installment_items) <> (select count(distinct x) from unnest(installment_ids) x) then raise exception 'invalid_debts'; end if;
    item_list := item_list || installment_items;
  end if;

  select sum((x ->> 'outstanding')::numeric) into total_value from jsonb_array_elements(item_list) x;

  select coalesce(p.display_name, 'Abogada de cobros'), lower(u.email::text) into signer, signer_email from public.profiles p join auth.users u on u.id = p.id where p.id = auth.uid();
  select p.name into property_label from public.properties p where p.id = target_property_id;
  select b.name || ' · ' || u.code into unit_label from public.units u join public.buildings b on b.property_id = u.property_id and b.id = u.building_id where u.id = target_unit_id;

  insert into public.legal_collection_notices(property_id, unit_id, staff_id, sent_by, recipient_email, recipient_name, subject, message, items, total)
  values (target_property_id, target_unit_id, me, auth.uid(), recipient, recipient_label, clean_subject, clean_message, item_list, total_value)
  returning id into notice_id;
  -- Archivos que adjuntó la abogada (05/11/2026); viajan en el correo del requerimiento.
  perform private.legal_insert_attachments(notice_id, null, target_property_id, 'lawyer', target_attachments, auth.uid());

  select live into live_value from private.invitation_delivery;
  insert into public.email_jobs(property_id, legal_notice_id, recipient_email, template_key, template_data, dedupe_key, status)
  values (target_property_id, notice_id, recipient, 'legal_collection_notice',
    jsonb_build_object('subject', clean_subject, 'message', clean_message, 'items', item_list, 'total', total_value, 'currency', 'COP',
      'signer_name', signer, 'property_name', property_label, 'unit_label', unit_label, 'recipient_name', recipient_label,
      'reply_token', private.legal_new_reply_token(notice_id)),
    'legal_notice:' || notice_id, case when coalesce(live_value, false) then 'queued' else 'held' end);

  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (target_property_id, auth.uid(), 'property', 'legal.collection_notice_sent', 'unit', target_unit_id,
    jsonb_build_object('notice_id', notice_id, 'debts', coalesce(jsonb_array_length(debt_items), 0),
      'installments', coalesce(jsonb_array_length(installment_items), 0), 'total', total_value));
  return notice_id;
end;
$$;

revoke all on function public.legal_send_collection_notice(uuid, uuid, uuid[], text, text, text, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.legal_send_collection_notice(uuid, uuid, uuid[], text, text, text, jsonb, uuid[]) to authenticated;

commit;

-- Debe dar true.
select pg_get_functiondef('public.legal_send_collection_notice(uuid, uuid, uuid[], text, text, text, jsonb, uuid[])'::regprocedure) like '%target_installment_ids%' as cuotas_en_requerimiento;
