-- Comprobantes de pago: el residente indica qué mes paga y puede dejar un comentario; la
-- administración recibe un aviso interno con el mes como título y el comentario (decisión de
-- Alejandro, 26/10/2026). Sin correo: solo aviso dentro de ResiQ.
begin;

alter table public.finance_payment_evidence add column paid_period date
  check (paid_period is null or extract(day from paid_period) = 1);
alter table public.finance_payment_evidence add column comment text
  check (comment is null or char_length(trim(comment)) between 1 and 500);

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled',
  'reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired',
  'receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice',
  'attention_call_created','assembly_published','assembly_updated','assembly_cancelled','visit_requested','visit_rejected',
  'announcement_published','payment_evidence_submitted'
));

-- Un aviso por cada administrador activo de la propiedad al recibir un comprobante nuevo.
create or replace function private.notify_payment_evidence_submitted()
returns trigger language plpgsql security definer set search_path='' as $$
declare unit_label text; month_label text; recipient record;
  months constant text[] := array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
begin
  select b.name||' · '||u.code into unit_label from public.units u join public.buildings b on b.id=u.building_id
  where u.id=new.unit_id and u.property_id=new.property_id;
  month_label:=case when new.paid_period is null then null
    else months[extract(month from new.paid_period)::integer]||' de '||extract(year from new.paid_period)::integer end;
  for recipient in select pm.id from public.property_members pm
    where pm.property_id=new.property_id and pm.status='active' and 'administrator'=any(pm.roles) loop
    insert into public.notifications(property_id,recipient_member_id,type,subject,body,target_type,target_id,payload,dedupe_key)
    values(new.property_id,recipient.id,'payment_evidence_submitted',
      'Pago de '||coalesce(month_label,'mes sin indicar')||' · '||coalesce(unit_label,'Apartamento'),
      coalesce(nullif(trim(new.comment),''),'El residente subió un comprobante de pago sin comentario.'),
      'receivable',new.receivable_id,
      jsonb_build_object('unit_id',new.unit_id,'evidence_id',new.id,'paid_period',new.paid_period,'comment',new.comment),
      'payment-evidence:'||new.id||':'||recipient.id)
    on conflict(property_id,recipient_member_id,dedupe_key) do nothing;
  end loop;
  return new;
end;
$$;
revoke all on function private.notify_payment_evidence_submitted() from public,anon,authenticated;
create trigger finance_payment_evidence_notify after insert on public.finance_payment_evidence
for each row execute function private.notify_payment_evidence_submitted();

commit;

select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='finance_payment_evidence' and column_name='paid_period') as mes_en_comprobantes,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='finance_payment_evidence' and column_name='comment') as comentario_en_comprobantes,
  exists(select 1 from pg_trigger where tgname='finance_payment_evidence_notify') as aviso_al_admin;
