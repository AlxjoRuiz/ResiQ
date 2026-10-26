-- Cartera (decisiones de Alejandro, 26/10/2026):
-- 1. Todo propietario o residente vinculado a un apartamento ve su cartera, sin activación del
--    admin. Las reglas existentes leen unit_memberships.finance_access, así que todo vínculo
--    queda con acceso y se retira el interruptor administrativo.
-- 2. Acuerdos de pago: administración registra un acuerdo con cuotas (valor y fecha) para un
--    apartamento; el residente lo consulta. Las cuotas cubiertas se calculan con los pagos
--    registrados desde la creación del acuerdo; no cambian obligaciones ni saldos.
begin;

update public.unit_memberships set finance_access = true where not finance_access;
alter table public.unit_memberships alter column finance_access set default true;
revoke execute on function public.set_unit_finance_access(uuid,boolean) from authenticated;

create table public.payment_agreements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid not null,
  total_amount numeric(14,2) not null check (total_amount > 0),
  notes text check (notes is null or char_length(trim(notes)) between 3 and 1000),
  status text not null default 'active' check (status in ('active','cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  cancel_reason text check (cancel_reason is null or char_length(trim(cancel_reason)) between 4 and 1000),
  cancelled_by uuid references public.profiles(id) on delete restrict,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,id),
  foreign key(property_id,unit_id) references public.units(property_id,id) on delete restrict,
  check ((status='cancelled')=(cancel_reason is not null and cancelled_by is not null and cancelled_at is not null))
);
create unique index payment_agreements_one_active_idx on public.payment_agreements(property_id,unit_id) where status='active';
create trigger payment_agreements_set_updated_at before update on public.payment_agreements for each row execute function private.set_updated_at();

create table public.payment_agreement_installments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  agreement_id uuid not null,
  number integer not null check (number between 1 and 120),
  amount numeric(14,2) not null check (amount > 0),
  due_on date not null,
  unique(agreement_id,number),
  foreign key(property_id,agreement_id) references public.payment_agreements(property_id,id) on delete restrict
);

alter table public.payment_agreements enable row level security;
alter table public.payment_agreement_installments enable row level security;
revoke all on public.payment_agreements,public.payment_agreement_installments from public,anon,authenticated;
grant select on public.payment_agreements,public.payment_agreement_installments to authenticated;
create policy payment_agreements_read_finance on public.payment_agreements for select to authenticated
using (private.can_access_unit_finance(property_id,unit_id));
create policy payment_agreement_installments_read_finance on public.payment_agreement_installments for select to authenticated
using (exists(select 1 from public.payment_agreements pa where pa.id=agreement_id and pa.property_id=payment_agreement_installments.property_id
  and private.can_access_unit_finance(pa.property_id,pa.unit_id)));

create or replace function public.create_payment_agreement(target_property_id uuid,target_unit_id uuid,target_notes text,target_installments jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare created_id uuid; item jsonb; seq integer:=0; total numeric:=0; amount_value numeric; due_value date; clean_notes text:=nullif(trim(target_notes),'');
begin
  if auth.uid() is null or not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.units where id=target_unit_id and property_id=target_property_id and status='active') then raise exception 'unit_not_found'; end if;
  if target_installments is null or jsonb_typeof(target_installments)<>'array' or jsonb_array_length(target_installments) not between 1 and 120
    or (clean_notes is not null and char_length(clean_notes) not between 3 and 1000) then raise exception 'invalid_input'; end if;
  perform private.lock_unit_finance(target_property_id,target_unit_id);
  if exists(select 1 from public.payment_agreements where property_id=target_property_id and unit_id=target_unit_id and status='active') then raise exception 'agreement_exists'; end if;
  for item in select value from jsonb_array_elements(target_installments) loop
    amount_value:=(item->>'amount')::numeric; due_value:=(item->>'due_on')::date;
    if amount_value is null or amount_value<=0 or due_value is null then raise exception 'invalid_input'; end if;
    total:=total+amount_value;
  end loop;
  insert into public.payment_agreements(property_id,unit_id,total_amount,notes,created_by)
  values(target_property_id,target_unit_id,total,clean_notes,auth.uid()) returning id into created_id;
  -- Las cuotas se numeran por fecha de vencimiento.
  for item in select value from jsonb_array_elements(target_installments) order by (value->>'due_on')::date loop
    seq:=seq+1;
    insert into public.payment_agreement_installments(property_id,agreement_id,number,amount,due_on)
    values(target_property_id,created_id,seq,(item->>'amount')::numeric,(item->>'due_on')::date);
  end loop;
  perform private.write_property_audit(target_property_id,'payment_agreement.created','payment_agreement',created_id,
    jsonb_build_object('unit_id',target_unit_id,'installments',seq,'total',total));
  return created_id;
end;
$$;

create or replace function public.cancel_payment_agreement(target_agreement_id uuid,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.payment_agreements%rowtype; clean_reason text:=nullif(trim(target_reason),'');
begin
  select * into item from public.payment_agreements where id=target_agreement_id for update;
  if not found or auth.uid() is null or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status<>'active' or clean_reason is null or char_length(clean_reason) not between 4 and 1000 then raise exception 'invalid_input'; end if;
  update public.payment_agreements set status='cancelled',cancel_reason=clean_reason,cancelled_by=auth.uid(),cancelled_at=now() where id=item.id;
  perform private.write_property_audit(item.property_id,'payment_agreement.cancelled','payment_agreement',item.id,jsonb_build_object('reason',clean_reason));
end;
$$;

revoke all on function public.create_payment_agreement(uuid,uuid,text,jsonb),public.cancel_payment_agreement(uuid,text) from public,anon;
grant execute on function public.create_payment_agreement(uuid,uuid,text,jsonb),public.cancel_payment_agreement(uuid,text) to authenticated;

notify pgrst,'reload schema';
commit;

select
  not exists(select 1 from public.unit_memberships where not finance_access) as todos_con_acceso,
  (select column_default from information_schema.columns where table_schema='public' and table_name='unit_memberships' and column_name='finance_access')='true' as nuevos_con_acceso,
  not has_function_privilege('authenticated','public.set_unit_finance_access(uuid,boolean)','execute') as interruptor_retirado,
  has_function_privilege('authenticated','public.create_payment_agreement(uuid,uuid,text,jsonb)','execute') as acuerdos_disponibles,
  not has_table_privilege('authenticated','public.payment_agreements','insert') as acuerdos_solo_por_funcion;
