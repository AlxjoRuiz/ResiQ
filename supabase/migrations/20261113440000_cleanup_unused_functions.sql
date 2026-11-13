-- Limpieza de funciones de la base sin uso (13/11/2026, pedido de Alejandro). Ninguna la llama la app, las funciones
-- Edge, otra función, un disparador ni un trabajo programado. Casi todas son versiones viejas que se reemplazaron:
-- * create_reservation → create_reservation_with_purpose; get_amenity_availability → get_amenity_availability_with_reason;
--   list_operational_reservations(_with_context) → list_operational_reservations_recent.
-- * accept_payment_evidence y mark_payment_evidence_received → record_evidence_payment.
-- * maintenance_monthly_report → maintenance_report. legal_property_report → legal_report_view.
-- * create_resident_invitation → queue_resident_invitation. get_platform_dashboard_metrics y platform_usage_by_property
--   → platform_activity_metrics y platform_usage_by_month.
-- * Quitadas de la pantalla: legal_save_report_note (conclusiones del informe), legal_unread_replies,
--   platform_set_property_plan, register_utility_bill, set_unit_finance_access, update_apartment_relationship,
--   create_unit_membership; create_building, create_unit y update_unit (la estructura sale del censo).
-- * Ya no se usan: process_delinquency_notifications (el aviso de mora lo hace el trabajo diario),
--   private.legal_close_due_months (sin cierre automático desde hoy) y funciones internas viejas.
-- Se conservan private.set_invitation_delivery (se usa a mano para encender los correos reales),
-- private.can_read_document_parent (la usa la regla de permisos de los documentos) y private.legal_insert_attachments y
-- private.legal_new_reply_token (las usa el envío de requerimientos de la abogada).
-- Si alguna todavía tuviera algo que depende de ella, la base no deja borrarla y no se borra nada (todo va en una transacción).
-- No borra tablas ni datos.
begin;

do $limpieza$
declare item record; dropped integer := 0;
begin
  for item in
    select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'public' and p.proname in (
        'create_building', 'create_unit', 'update_unit', 'create_unit_membership', 'get_platform_dashboard_metrics',
        'get_amenity_availability', 'list_operational_reservations', 'list_operational_reservations_with_context',
        'create_reservation', 'set_unit_finance_access', 'register_utility_bill', 'update_apartment_relationship',
        'create_resident_invitation', 'mark_payment_evidence_received', 'accept_payment_evidence', 'platform_set_property_plan',
        'platform_usage_by_property', 'maintenance_monthly_report', 'legal_unread_replies', 'legal_property_report',
        'legal_save_report_note', 'process_delinquency_notifications'))
       or (n.nspname = 'private' and p.proname in (
        'payment_agreement_paid', 'legal_close_due_months'))
  loop
    execute format('drop function %s', item.signature);
    dropped := dropped + 1;
  end loop;
  raise notice 'Funciones borradas: %', dropped;
end;
$limpieza$;

commit;

notify pgrst, 'reload schema';

-- Debe dar true: ya no queda ninguna, y se conservan las que sí se usan.
select not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname in ('public', 'private') and p.proname in ('create_reservation', 'legal_property_report', 'legal_close_due_months', 'process_delinquency_notifications'))
  and exists (select 1 from pg_proc where proname = 'create_reservation_with_purpose')
  and exists (select 1 from pg_proc where proname = 'set_invitation_delivery') as limpieza_de_funciones;
