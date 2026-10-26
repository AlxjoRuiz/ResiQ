-- Comprobantes de pago: administración marca cada comprobante como «Recibido» antes de registrar
-- el pago (decisión de Alejandro, 26/10/2026). Marcarlo no registra el pago ni cambia saldos;
-- solo deja constancia de quién y cuándo lo revisó. El residente ve su comprobante como recibido.
begin;

alter table public.finance_payment_evidence add column received_at timestamptz;
alter table public.finance_payment_evidence add column received_by uuid references public.profiles(id) on delete restrict;
alter table public.finance_payment_evidence add constraint finance_payment_evidence_received_check
  check ((received_at is null) = (received_by is null));

create or replace function public.mark_payment_evidence_received(target_evidence_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare item public.finance_payment_evidence%rowtype;
begin
  select * into item from public.finance_payment_evidence where id=target_evidence_id for update;
  if not found or auth.uid() is null or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.received_at is not null then return; end if;
  update public.finance_payment_evidence set received_at=now(),received_by=auth.uid() where id=item.id;
  perform private.write_property_audit(item.property_id,'payment_evidence.received','finance_payment_evidence',item.id,
    jsonb_build_object('receivable_id',item.receivable_id,'unit_id',item.unit_id));
end;
$$;
revoke all on function public.mark_payment_evidence_received(uuid) from public,anon;
grant execute on function public.mark_payment_evidence_received(uuid) to authenticated;

notify pgrst,'reload schema';
commit;

select
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='finance_payment_evidence' and column_name='received_at') as recibido_en_comprobantes,
  has_function_privilege('authenticated','public.mark_payment_evidence_received(uuid)','execute') as marcar_recibido_disponible,
  not has_table_privilege('authenticated','public.finance_payment_evidence','update') as solo_por_funcion;
