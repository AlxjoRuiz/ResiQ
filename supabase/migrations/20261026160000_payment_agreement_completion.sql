-- Acuerdos de pago terminados (decisión de Alejandro, 26/10/2026): cuando los pagos registrados
-- desde la fecha del acuerdo cubren su total, el acuerdo pasa a «completed», deja de mostrarse y
-- el apartamento puede tener un acuerdo nuevo. Es la misma regla de cuotas cubiertas de la vista.
begin;

alter table public.payment_agreements drop constraint payment_agreements_status_check;
alter table public.payment_agreements add constraint payment_agreements_status_check check (status in ('active','completed','cancelled'));
alter table public.payment_agreements add column completed_at timestamptz;
alter table public.payment_agreements add constraint payment_agreements_completed_check check ((status='completed')=(completed_at is not null));

-- Pagos registrados del apartamento desde el día (hora local del conjunto) en que se creó el acuerdo.
create or replace function private.payment_agreement_paid(target_agreement_id uuid)
returns numeric language sql stable security definer set search_path='' as $$
  select coalesce(sum(p.amount),0) from public.payment_agreements pa
  join public.properties pr on pr.id=pa.property_id
  join public.payments p on p.property_id=pa.property_id and p.unit_id=pa.unit_id and p.status='posted'
    and p.paid_on>=(pa.created_at at time zone pr.timezone)::date
  where pa.id=target_agreement_id;
$$;
revoke all on function private.payment_agreement_paid(uuid) from public,anon,authenticated;

create or replace function private.complete_covered_payment_agreements(target_property_id uuid,target_unit_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.payment_agreements pa set status='completed',completed_at=now()
  where pa.property_id=target_property_id and pa.unit_id=target_unit_id and pa.status='active'
    and private.payment_agreement_paid(pa.id)>=pa.total_amount;
end;
$$;
revoke all on function private.complete_covered_payment_agreements(uuid,uuid) from public,anon,authenticated;

create or replace function private.complete_agreements_after_payment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.complete_covered_payment_agreements(new.property_id,new.unit_id);
  return new;
end;
$$;
revoke all on function private.complete_agreements_after_payment() from public,anon,authenticated;
create trigger payments_complete_agreements after insert on public.payments
for each row execute function private.complete_agreements_after_payment();

-- Acuerdos que ya estaban pagados antes de esta regla.
update public.payment_agreements pa set status='completed',completed_at=now()
where pa.status='active' and private.payment_agreement_paid(pa.id)>=pa.total_amount;

commit;

select
  exists(select 1 from pg_trigger where tgname='payments_complete_agreements') as cierre_automatico,
  not exists(select 1 from public.payment_agreements pa where pa.status='active' and private.payment_agreement_paid(pa.id)>=pa.total_amount) as pagados_cerrados,
  (select count(*) from public.payment_agreements where status='completed') as acuerdos_terminados;
