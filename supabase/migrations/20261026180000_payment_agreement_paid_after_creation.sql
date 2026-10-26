-- Corrección (26/10/2026): un acuerdo de pago solo cuenta los pagos registrados DESPUÉS de crearlo.
-- Antes se contaban los pagos con fecha desde el día del acuerdo, y un pago registrado ese mismo día
-- antes del acuerdo aparecía cubriendo la primera cuota. Los acuerdos marcados como terminados que
-- no cumplen la regla corregida vuelven a quedar activos.
begin;

create or replace function private.payment_agreement_paid(target_agreement_id uuid)
returns numeric language sql stable security definer set search_path='' as $$
  select coalesce(sum(p.amount),0) from public.payment_agreements pa
  join public.payments p on p.property_id=pa.property_id and p.unit_id=pa.unit_id and p.status='posted'
    and p.created_at>=pa.created_at
  where pa.id=target_agreement_id;
$$;
revoke all on function private.payment_agreement_paid(uuid) from public,anon,authenticated;

update public.payment_agreements pa set status='active',completed_at=null
where pa.status='completed' and private.payment_agreement_paid(pa.id)<pa.total_amount
  and not exists(select 1 from public.payment_agreements other
    where other.property_id=pa.property_id and other.unit_id=pa.unit_id and other.status='active');

commit;

select
  pg_get_functiondef('private.payment_agreement_paid(uuid)'::regprocedure) like '%p.created_at>=pa.created_at%' as solo_pagos_posteriores,
  not exists(select 1 from public.payment_agreements pa where pa.status='active' and private.payment_agreement_paid(pa.id)>=pa.total_amount) as pagados_cerrados;
