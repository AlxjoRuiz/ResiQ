-- Cartera (28/10/2026): punto rojo fijo mientras haya comprobantes sin registrar. Para administración,
-- «Ver cuenta» del apartamento y «Cartera» en la barra lateral muestran el punto aunque se entre y se
-- salga; solo se quita al registrar el pago (o si la deuda queda pagada de otra forma o se anula).
begin;

-- Comprobante pendiente: sin pago registrado y su deuda sigue activa con saldo.
create or replace function private.evidence_is_pending(target_evidence_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.finance_payment_evidence e
    join public.accounts_receivable ar on ar.id = e.receivable_id and ar.property_id = e.property_id
    where e.id = target_evidence_id and e.payment_id is null and ar.status = 'active' and private.receivable_outstanding(ar.id) > 0);
$$;
revoke all on function private.evidence_is_pending(uuid) from public, anon, authenticated;

create or replace function public.list_units_with_pending_evidence(target_property_id uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct e.unit_id), '{}') from public.finance_payment_evidence e
  where e.property_id = target_property_id and private.is_active_member(target_property_id, 'administrator')
    and private.evidence_is_pending(e.id);
$$;

-- Igual a 20261028110000; agrega «cartera_pending» para administración mientras haya comprobantes
-- sin registrar (ese punto no se quita al abrir la sección).
create or replace function public.get_unseen_sections(target_property_id uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  with me as (
    select pm.id from public.property_members pm
    where pm.property_id = target_property_id and pm.user_id = auth.uid() and pm.status = 'active'
  ), pending as (
    select private.notification_section(n.target_type) as section, n.created_at from public.notifications n
    where n.property_id = target_property_id and n.recipient_member_id = (select id from me) and n.read_at is null
    union all
    select 'notificaciones', n.created_at from public.notifications n
    where n.property_id = target_property_id and n.recipient_member_id = (select id from me) and n.read_at is null
  ), unseen as (
    select p.section from pending p
    left join public.section_views v on v.member_id = (select id from me) and v.section = p.section
    where p.section is not null and (v.seen_at is null or p.created_at > v.seen_at)
    union all
    select 'cartera_pending' where private.is_active_member(target_property_id, 'administrator') and exists(
      select 1 from public.finance_payment_evidence e where e.property_id = target_property_id and private.evidence_is_pending(e.id))
  )
  select coalesce(array_agg(distinct section), '{}') from unseen;
$$;

revoke all on function public.list_units_with_pending_evidence(uuid), public.get_unseen_sections(uuid) from public, anon;
grant execute on function public.list_units_with_pending_evidence(uuid), public.get_unseen_sections(uuid) to authenticated;

commit;

select
  has_function_privilege('authenticated', 'public.list_units_with_pending_evidence(uuid)', 'execute') as apartamentos_con_comprobante,
  pg_get_functiondef('public.get_unseen_sections(uuid)'::regprocedure) like '%cartera_pending%' as punto_fijo_cartera;
