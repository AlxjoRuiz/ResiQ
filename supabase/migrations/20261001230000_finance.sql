-- Etapa 12: auxiliar de cartera, pagos, mora y restricción de reservas.

create table public.accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid not null,
  concept text not null check (char_length(trim(concept)) between 2 and 180),
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'COP' check (currency = upper(currency)),
  issued_on date not null,
  due_on date not null,
  status text not null default 'active' check (status in ('active','void')),
  source text not null default 'manual' check (source in ('manual','import','opening_balance')),
  external_reference text check (external_reference is null or char_length(trim(external_reference)) between 1 and 120),
  import_batch_id uuid,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  void_reason text check (void_reason is null or char_length(trim(void_reason)) between 3 and 500),
  voided_by uuid references public.profiles(id) on delete restrict,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,id),
  unique(property_id,id,unit_id),
  foreign key(property_id,unit_id) references public.units(property_id,id) on delete restrict,
  check (due_on >= issued_on),
  check ((status='void')=(void_reason is not null and voided_by is not null and voided_at is not null))
);
create unique index accounts_receivable_external_ref_uidx on public.accounts_receivable(property_id,source,external_reference) where external_reference is not null;
create index accounts_receivable_unit_due_idx on public.accounts_receivable(property_id,unit_id,due_on) where status='active';
create index accounts_receivable_property_due_idx on public.accounts_receivable(property_id,due_on) where status='active';
create index accounts_receivable_batch_idx on public.accounts_receivable(property_id,import_batch_id) where import_batch_id is not null;
create trigger accounts_receivable_set_updated_at before update on public.accounts_receivable for each row execute function private.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'COP' check (currency = upper(currency)),
  paid_on date not null,
  reference text check (reference is null or char_length(trim(reference)) between 1 and 120),
  status text not null default 'posted' check (status in ('posted','void')),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  void_reason text check (void_reason is null or char_length(trim(void_reason)) between 3 and 500),
  voided_by uuid references public.profiles(id) on delete restrict,
  voided_at timestamptz,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,id),
  unique(property_id,id,unit_id),
  unique(property_id,idempotency_key),
  foreign key(property_id,unit_id) references public.units(property_id,id) on delete restrict,
  check ((status='void')=(void_reason is not null and voided_by is not null and voided_at is not null))
);
create index payments_unit_paid_idx on public.payments(property_id,unit_id,paid_on desc);
create trigger payments_set_updated_at before update on public.payments for each row execute function private.set_updated_at();

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid not null,
  payment_id uuid not null,
  receivable_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(property_id,id),
  unique(property_id,payment_id,receivable_id),
  foreign key(property_id,payment_id,unit_id) references public.payments(property_id,id,unit_id) on delete restrict,
  foreign key(property_id,receivable_id,unit_id) references public.accounts_receivable(property_id,id,unit_id) on delete restrict
);
create index payment_allocations_receivable_idx on public.payment_allocations(property_id,receivable_id);

alter table public.accounts_receivable enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;

create or replace function private.can_access_unit_finance(target_property_id uuid,target_unit_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active_member(target_property_id,'administrator') or exists(
    select 1 from public.unit_memberships um
    join public.property_members pm on pm.id=um.member_id and pm.property_id=um.property_id
    join public.units u on u.id=um.unit_id and u.property_id=um.property_id
    join public.properties p on p.id=um.property_id
    where um.property_id=target_property_id and um.unit_id=target_unit_id and um.finance_access
      and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
      and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
      and u.status='active' and p.status='active'
  );
$$;

create policy accounts_receivable_read_finance on public.accounts_receivable for select to authenticated using (private.can_access_unit_finance(property_id,unit_id));
create policy payments_read_finance on public.payments for select to authenticated using (private.can_access_unit_finance(property_id,unit_id));
create policy payment_allocations_read_finance on public.payment_allocations for select to authenticated using (private.can_access_unit_finance(property_id,unit_id));

grant select on public.accounts_receivable,public.payments,public.payment_allocations to authenticated;
revoke all on function private.can_access_unit_finance(uuid,uuid) from public,anon;
grant execute on function private.can_access_unit_finance(uuid,uuid) to authenticated;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice'));
alter table public.notifications drop constraint notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check check (target_type in ('pqrs','package','visitor','reservation','receivable','payment'));
alter table public.email_jobs drop constraint email_jobs_template_key_check;
alter table public.email_jobs add constraint email_jobs_template_key_check check (template_key in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice'));

alter table public.activity_events add column receivable_id uuid;
alter table public.activity_events add column payment_id uuid;
alter table public.activity_events add foreign key(property_id,receivable_id) references public.accounts_receivable(property_id,id) on delete restrict;
alter table public.activity_events add foreign key(property_id,payment_id) references public.payments(property_id,id) on delete restrict;
alter table public.activity_events drop constraint activity_events_one_parent_check;
alter table public.activity_events add constraint activity_events_one_parent_check check (num_nonnulls(pqrs_id,package_id,visitor_id,reservation_id,receivable_id,payment_id)=1);
alter table public.activity_events drop constraint activity_events_event_type_check;
alter table public.activity_events add constraint activity_events_event_type_check check (event_type in ('created','message_added','status_changed','attachment_added','package_received','package_recipient_assigned','package_notified','package_delivered','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','reservation_completed','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice'));
create index activity_events_receivable_idx on public.activity_events(property_id,receivable_id,occurred_at,id) where receivable_id is not null;
create index activity_events_payment_idx on public.activity_events(property_id,payment_id,occurred_at,id) where payment_id is not null;
create policy activity_events_read_finance on public.activity_events for select to authenticated using (
  (receivable_id is not null and exists(select 1 from public.accounts_receivable ar where ar.id=receivable_id and ar.property_id=activity_events.property_id and private.can_access_unit_finance(ar.property_id,ar.unit_id)))
  or (payment_id is not null and exists(select 1 from public.payments p where p.id=payment_id and p.property_id=activity_events.property_id and private.can_access_unit_finance(p.property_id,p.unit_id)))
);

create or replace function private.lock_unit_finance(target_property_id uuid,target_unit_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(target_property_id::text||':'||target_unit_id::text,0));
end;
$$;

create or replace function private.receivable_outstanding(target_receivable_id uuid)
returns numeric language sql stable security definer set search_path='' as $$
  select case when ar.status='active' then greatest(ar.amount-coalesce(sum(pa.amount) filter(where p.status='posted'),0),0) else 0 end
  from public.accounts_receivable ar
  left join public.payment_allocations pa on pa.property_id=ar.property_id and pa.receivable_id=ar.id
  left join public.payments p on p.property_id=pa.property_id and p.id=pa.payment_id
  where ar.id=target_receivable_id group by ar.id,ar.amount,ar.status;
$$;

create or replace function private.unit_has_blocking_debt(target_property_id uuid,target_unit_id uuid,target_days integer)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.accounts_receivable ar
    join public.properties p on p.id=ar.property_id
    where ar.property_id=target_property_id and ar.unit_id=target_unit_id and ar.status='active'
      and private.receivable_outstanding(ar.id)>0
      and ((now() at time zone p.timezone)::date-ar.due_on)>=target_days
  );
$$;

create or replace function private.enqueue_finance_notification(
  target_property_id uuid,target_unit_id uuid,target_entity_type text,target_entity_id uuid,
  notification_type text,notification_subject text,notification_body text,target_dedupe_prefix text,target_payload jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare recipient record; notification_id uuid; recipient_email text; unit_label text;
begin
  select b.name||' · '||u.code into unit_label from public.units u join public.buildings b on b.id=u.building_id and b.property_id=u.property_id where u.id=target_unit_id and u.property_id=target_property_id;
  for recipient in
    select distinct pm.id,pm.user_id from public.unit_memberships um
    join public.property_members pm on pm.id=um.member_id and pm.property_id=um.property_id
    where um.property_id=target_property_id and um.unit_id=target_unit_id and um.finance_access
      and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now()) and pm.status='active' and 'member'=any(pm.roles)
  loop
    notification_id:=null;
    insert into public.notifications(property_id,recipient_member_id,type,subject,body,target_type,target_id,payload,dedupe_key)
    values(target_property_id,recipient.id,notification_type,notification_subject,notification_body,target_entity_type,target_entity_id,target_payload,target_dedupe_prefix||':'||recipient.id)
    on conflict(property_id,recipient_member_id,dedupe_key) do nothing returning id into notification_id;
    if notification_id is not null then
      select lower(email) into recipient_email from auth.users where id=recipient.user_id;
      if recipient_email is not null then
        insert into public.email_jobs(property_id,notification_id,recipient_email,template_key,template_data,dedupe_key)
        values(target_property_id,notification_id,recipient_email,notification_type,target_payload||jsonb_build_object('property_id',target_property_id,'unit_id',target_unit_id,'unit_label',unit_label),target_dedupe_prefix||':'||recipient.id);
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.list_finance_account_summaries(target_property_id uuid)
returns table(unit_id uuid,building_name text,unit_code text,total_amount numeric,applied_amount numeric,outstanding_balance numeric,overdue_balance numeric,oldest_due_on date,overdue_days integer,account_status text,unapplied_payments numeric)
language plpgsql security definer set search_path='' as $$
begin
  if not private.is_active_member(target_property_id) then raise exception 'not_authorized'; end if;
  return query
  with visible_units as (
    select u.id,u.code,u.building_id from public.units u
    where u.property_id=target_property_id and u.status='active' and private.can_access_unit_finance(u.property_id,u.id)
  ), receivables as (
    select ar.unit_id,sum(ar.amount) total,
      sum(private.receivable_outstanding(ar.id)) outstanding,
      sum(case when ar.due_on<(now() at time zone pr.timezone)::date then private.receivable_outstanding(ar.id) else 0 end) overdue,
      min(ar.due_on) filter(where ar.due_on<(now() at time zone pr.timezone)::date and private.receivable_outstanding(ar.id)>0) oldest
    from public.accounts_receivable ar join public.properties pr on pr.id=ar.property_id
    where ar.property_id=target_property_id and ar.status='active' group by ar.unit_id
  ), payment_totals as (
    select p.unit_id,sum(p.amount) filter(where p.status='posted') paid,
      sum(p.amount-coalesce(a.applied,0)) filter(where p.status='posted') unapplied
    from public.payments p left join (select property_id,payment_id,sum(amount) applied from public.payment_allocations group by property_id,payment_id) a on a.property_id=p.property_id and a.payment_id=p.id
    where p.property_id=target_property_id group by p.unit_id
  )
  select vu.id,b.name,vu.code,coalesce(r.total,0)::numeric,coalesce(r.total-r.outstanding,0)::numeric,coalesce(r.outstanding,0)::numeric,coalesce(r.overdue,0)::numeric,r.oldest,
    case when r.oldest is null then 0 else ((now() at time zone pr.timezone)::date-r.oldest)::integer end,
    case when coalesce(r.outstanding,0)=0 then 'current' when coalesce(r.overdue,0)>0 then 'overdue' else 'pending' end,
    coalesce(pt.unapplied,0)::numeric
  from visible_units vu join public.buildings b on b.id=vu.building_id and b.property_id=target_property_id join public.properties pr on pr.id=target_property_id
  left join receivables r on r.unit_id=vu.id left join payment_totals pt on pt.unit_id=vu.id order by b.name,vu.code;
end;
$$;

create or replace function public.set_unit_finance_access(target_unit_membership_id uuid,target_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
declare link public.unit_memberships%rowtype;
begin
  select * into link from public.unit_memberships where id=target_unit_membership_id for update;
  if not found or not private.is_active_member(link.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if link.valid_from>now() or link.valid_to is not null and link.valid_to<=now() then raise exception 'inactive_membership'; end if;
  update public.unit_memberships set finance_access=target_enabled,updated_at=now() where id=link.id;
  perform private.write_property_audit(link.property_id,'finance.access_updated','unit_membership',link.id,jsonb_build_object('unit_id',link.unit_id,'enabled',target_enabled));
end;
$$;

create or replace function public.create_receivable(target_property_id uuid,target_unit_id uuid,target_concept text,target_amount numeric,target_issued_on date,target_due_on date,target_external_reference text)
returns uuid language plpgsql security definer set search_path='' as $$
declare created_id uuid; clean_concept text:=trim(target_concept); clean_reference text:=nullif(trim(target_external_reference),'');
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if char_length(clean_concept) not between 2 and 180 or target_amount<=0 or target_due_on<target_issued_on then raise exception 'invalid_input'; end if;
  if not exists(select 1 from public.units where id=target_unit_id and property_id=target_property_id and status='active') then raise exception 'unit_not_found'; end if;
  perform private.lock_unit_finance(target_property_id,target_unit_id);
  insert into public.accounts_receivable(property_id,unit_id,concept,amount,currency,issued_on,due_on,source,external_reference,recorded_by)
  values(target_property_id,target_unit_id,clean_concept,target_amount,'COP',target_issued_on,target_due_on,'manual',clean_reference,auth.uid()) returning id into created_id;
  insert into public.activity_events(property_id,receivable_id,actor_id,event_type,new_state,description) values(target_property_id,created_id,auth.uid(),'receivable_created','active','Obligación registrada');
  perform private.write_property_audit(target_property_id,'receivable.created','accounts_receivable',created_id,jsonb_build_object('unit_id',target_unit_id,'amount',target_amount));
  perform private.enqueue_finance_notification(target_property_id,target_unit_id,'receivable',created_id,'receivable_created','Nueva obligación registrada','La administración registró una obligación en tu cuenta.','receivable:'||created_id||':created',jsonb_build_object('receivable_id',created_id,'concept',clean_concept,'amount',target_amount,'currency','COP','due_on',target_due_on));
  return created_id;
exception when unique_violation then raise exception 'duplicate_reference';
end;
$$;

create or replace function public.import_receivables(target_property_id uuid,target_batch_id uuid,target_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare item jsonb; created_id uuid; imported integer:=0; unit_id_value uuid; amount_value numeric; issued_value date; due_value date; source_value text; reference_value text; concept_value text;
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if target_batch_id is null or target_rows is null or jsonb_typeof(target_rows)<>'array' or jsonb_array_length(target_rows) not between 1 and 500 then raise exception 'invalid_import'; end if;
  for item in select value from jsonb_array_elements(target_rows) loop
    unit_id_value:=(item->>'unit_id')::uuid; amount_value:=(item->>'amount')::numeric; issued_value:=(item->>'issued_on')::date; due_value:=(item->>'due_on')::date;
    source_value:=coalesce(nullif(item->>'source',''),'import'); reference_value:=nullif(trim(item->>'external_reference'),''); concept_value:=trim(item->>'concept');
    if source_value not in ('import','opening_balance') or reference_value is null or char_length(reference_value)>120 or char_length(concept_value) not between 2 and 180 or amount_value<=0 or due_value<issued_value then raise exception 'invalid_import_row'; end if;
    if not exists(select 1 from public.units where id=unit_id_value and property_id=target_property_id and status='active') then raise exception 'unit_not_found'; end if;
    perform private.lock_unit_finance(target_property_id,unit_id_value);
    insert into public.accounts_receivable(property_id,unit_id,concept,amount,currency,issued_on,due_on,source,external_reference,import_batch_id,recorded_by)
    values(target_property_id,unit_id_value,concept_value,amount_value,'COP',issued_value,due_value,source_value,reference_value,target_batch_id,auth.uid()) returning id into created_id;
    insert into public.activity_events(property_id,receivable_id,actor_id,event_type,new_state,description) values(target_property_id,created_id,auth.uid(),'receivable_created','active','Obligación importada');
    imported:=imported+1;
  end loop;
  for unit_id_value in select distinct (value->>'unit_id')::uuid from jsonb_array_elements(target_rows) loop
    perform private.enqueue_finance_notification(target_property_id,unit_id_value,'receivable',target_batch_id,'receivable_created','Cartera actualizada','La administración importó nuevas obligaciones en tu cuenta.','receivable-batch:'||target_batch_id||':'||unit_id_value,jsonb_build_object('batch_id',target_batch_id));
  end loop;
  perform private.write_property_audit(target_property_id,'receivable.batch_imported','accounts_receivable',target_batch_id,jsonb_build_object('rows',imported,'batch_id',target_batch_id));
  return imported;
exception when unique_violation then raise exception 'duplicate_reference';
end;
$$;

create or replace function public.void_receivable(target_receivable_id uuid,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.accounts_receivable%rowtype; clean_reason text:=trim(target_reason);
begin
  select * into item from public.accounts_receivable where id=target_receivable_id for update;
  if not found or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status<>'active' or char_length(clean_reason) not between 3 and 500 then raise exception 'invalid_transition'; end if;
  perform private.lock_unit_finance(item.property_id,item.unit_id);
  update public.accounts_receivable set status='void',void_reason=clean_reason,voided_by=auth.uid(),voided_at=now() where id=item.id;
  insert into public.activity_events(property_id,receivable_id,actor_id,event_type,previous_state,new_state,description) values(item.property_id,item.id,auth.uid(),'receivable_voided','active','void','Obligación anulada: '||clean_reason);
  perform private.write_property_audit(item.property_id,'receivable.voided','accounts_receivable',item.id,jsonb_build_object('reason',clean_reason));
  perform private.enqueue_finance_notification(item.property_id,item.unit_id,'receivable',item.id,'receivable_voided','Obligación anulada','La administración anuló una obligación de tu cuenta.','receivable:'||item.id||':void',jsonb_build_object('receivable_id',item.id,'concept',item.concept,'amount',item.amount,'currency',item.currency));
end;
$$;

create or replace function public.record_payment(target_property_id uuid,target_unit_id uuid,target_amount numeric,target_paid_on date,target_reference text,target_allocations jsonb,target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare created_id uuid; item jsonb; receivable public.accounts_receivable%rowtype; allocation_amount numeric; allocation_total numeric:=0; outstanding numeric;
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if target_amount<=0 or target_paid_on is null or target_idempotency_key is null or target_allocations is null or jsonb_typeof(target_allocations)<>'array' or jsonb_array_length(target_allocations)>100 then raise exception 'invalid_input'; end if;
  if not exists(select 1 from public.units where id=target_unit_id and property_id=target_property_id and status='active') then raise exception 'unit_not_found'; end if;
  perform private.lock_unit_finance(target_property_id,target_unit_id);
  for item in select value from jsonb_array_elements(target_allocations) order by value->>'receivable_id' loop
    allocation_amount:=(item->>'amount')::numeric;
    if allocation_amount<=0 then raise exception 'invalid_allocation'; end if;
    allocation_total:=allocation_total+allocation_amount;
  end loop;
  if allocation_total>target_amount then raise exception 'payment_overallocated'; end if;
  insert into public.payments(property_id,unit_id,amount,currency,paid_on,reference,recorded_by,idempotency_key)
  values(target_property_id,target_unit_id,target_amount,'COP',target_paid_on,nullif(trim(target_reference),''),auth.uid(),target_idempotency_key) returning id into created_id;
  for item in select value from jsonb_array_elements(target_allocations) order by value->>'receivable_id' loop
    select * into receivable from public.accounts_receivable where id=(item->>'receivable_id')::uuid and property_id=target_property_id and unit_id=target_unit_id for update;
    if not found or receivable.status<>'active' or receivable.currency<>'COP' then raise exception 'invalid_receivable'; end if;
    allocation_amount:=(item->>'amount')::numeric; outstanding:=private.receivable_outstanding(receivable.id);
    if allocation_amount>outstanding then raise exception 'receivable_overallocated'; end if;
    insert into public.payment_allocations(property_id,unit_id,payment_id,receivable_id,amount,recorded_by) values(target_property_id,target_unit_id,created_id,receivable.id,allocation_amount,auth.uid());
  end loop;
  insert into public.activity_events(property_id,payment_id,actor_id,event_type,new_state,description) values(target_property_id,created_id,auth.uid(),'payment_recorded','posted','Pago registrado');
  perform private.write_property_audit(target_property_id,'payment.recorded','payment',created_id,jsonb_build_object('unit_id',target_unit_id,'amount',target_amount,'allocated',allocation_total));
  perform private.enqueue_finance_notification(target_property_id,target_unit_id,'payment',created_id,'payment_recorded','Pago registrado','La administración registró un pago en tu cuenta.','payment:'||created_id||':recorded',jsonb_build_object('payment_id',created_id,'amount',target_amount,'currency','COP','paid_on',target_paid_on));
  return created_id;
exception when unique_violation then raise exception 'duplicate_payment';
end;
$$;

create or replace function public.void_payment(target_payment_id uuid,target_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.payments%rowtype; clean_reason text:=trim(target_reason);
begin
  select * into item from public.payments where id=target_payment_id for update;
  if not found or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status<>'posted' or char_length(clean_reason) not between 3 and 500 then raise exception 'invalid_transition'; end if;
  perform private.lock_unit_finance(item.property_id,item.unit_id);
  update public.payments set status='void',void_reason=clean_reason,voided_by=auth.uid(),voided_at=now() where id=item.id;
  insert into public.activity_events(property_id,payment_id,actor_id,event_type,previous_state,new_state,description) values(item.property_id,item.id,auth.uid(),'payment_voided','posted','void','Pago anulado: '||clean_reason);
  perform private.write_property_audit(item.property_id,'payment.voided','payment',item.id,jsonb_build_object('reason',clean_reason));
  perform private.enqueue_finance_notification(item.property_id,item.unit_id,'payment',item.id,'payment_voided','Pago anulado','La administración anuló un pago de tu cuenta.','payment:'||item.id||':void',jsonb_build_object('payment_id',item.id,'amount',item.amount,'currency',item.currency,'paid_on',item.paid_on));
end;
$$;

create or replace function public.update_finance_policy(target_property_id uuid,target_restrict boolean,target_minimum_overdue_days integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  if target_minimum_overdue_days not between 0 and 3650 then raise exception 'invalid_input'; end if;
  insert into public.property_policies(property_id,restrict_reservations_for_debt,minimum_overdue_days,updated_by)
  values(target_property_id,target_restrict,target_minimum_overdue_days,auth.uid())
  on conflict(property_id) do update set restrict_reservations_for_debt=excluded.restrict_reservations_for_debt,minimum_overdue_days=excluded.minimum_overdue_days,updated_by=auth.uid();
  perform private.write_property_audit(target_property_id,'finance.policy_updated','property_policy',target_property_id,jsonb_build_object('restrict_reservations_for_debt',target_restrict,'minimum_overdue_days',target_minimum_overdue_days));
end;
$$;

create or replace function public.process_delinquency_notifications(target_property_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare item record; processed integer:=0; policy public.property_policies%rowtype;
begin
  if not private.is_active_member(target_property_id,'administrator') then raise exception 'not_authorized'; end if;
  select * into policy from public.property_policies where property_id=target_property_id;
  if not found then return 0; end if;
  for item in
    select ar.*,private.receivable_outstanding(ar.id) outstanding,p.timezone from public.accounts_receivable ar join public.properties p on p.id=ar.property_id
    where ar.property_id=target_property_id and ar.status='active' and private.receivable_outstanding(ar.id)>0
      and ((now() at time zone p.timezone)::date-ar.due_on)>=policy.minimum_overdue_days
  loop
    perform private.enqueue_finance_notification(item.property_id,item.unit_id,'receivable',item.id,'delinquency_notice','Aviso de mora','Tu cuenta presenta una obligación que alcanzó el umbral de mora.','receivable:'||item.id||':delinquency:'||policy.minimum_overdue_days,jsonb_build_object('receivable_id',item.id,'concept',item.concept,'amount',item.outstanding,'currency',item.currency,'due_on',item.due_on,'overdue_days',((now() at time zone item.timezone)::date-item.due_on)));
    processed:=processed+1;
  end loop;
  return processed;
end;
$$;

create or replace function public.create_reservation(target_property_id uuid,target_amenity_id uuid,target_unit_id uuid,target_starts_at timestamp,target_ends_at timestamp,target_attendee_count integer,target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.amenities%rowtype; policy public.property_policies%rowtype; requester_id uuid; property_timezone text; actual_start timestamptz; actual_end timestamptz; initial_status text; hold_until timestamptz; created_id uuid; start_minutes integer; duration_minutes integer;
begin
  select pm.id into requester_id from public.property_members pm
  join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id and um.unit_id=target_unit_id
  where pm.property_id=target_property_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles) and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now()) limit 1;
  if requester_id is null then raise exception 'not_authorized'; end if;
  perform private.lock_unit_finance(target_property_id,target_unit_id);
  select * into a from public.amenities where id=target_amenity_id and property_id=target_property_id for update;
  if not found or a.status<>'active' then raise exception 'amenity_unavailable'; end if;
  select timezone into property_timezone from public.properties where id=target_property_id and status='active';
  actual_start:=target_starts_at at time zone property_timezone; actual_end:=target_ends_at at time zone property_timezone;
  if actual_start<now() or actual_end<=actual_start or target_attendee_count not between 1 and a.capacity then raise exception 'invalid_input'; end if;
  if target_starts_at::date<>target_ends_at::date then raise exception 'outside_amenity_hours'; end if;
  start_minutes:=extract(hour from target_starts_at)::integer*60+extract(minute from target_starts_at)::integer;
  duration_minutes:=extract(epoch from (target_ends_at-target_starts_at))::integer/60;
  if mod(start_minutes,a.slot_minutes)<>0 or duration_minutes<=0 or mod(duration_minutes,a.slot_minutes)<>0 then raise exception 'invalid_slot'; end if;
  if not exists(select 1 from public.amenity_hours h where h.property_id=target_property_id and h.amenity_id=a.id and h.weekday=extract(isodow from target_starts_at)::integer and h.opens_at<=target_starts_at::time and h.closes_at>=target_ends_at::time) then raise exception 'outside_amenity_hours'; end if;
  perform private.refresh_reservation_states(target_property_id);
  if exists(select 1 from public.amenity_blackouts b where b.property_id=target_property_id and b.amenity_id=a.id and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(actual_start,actual_end,'[)')) then raise exception 'amenity_closed'; end if;
  if exists(select 1 from public.reservations r where r.property_id=target_property_id and r.amenity_id=a.id and r.blocks_slot and tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(actual_start,actual_end,'[)')) then raise exception 'reservation_conflict'; end if;
  insert into public.property_policies(property_id) values(target_property_id) on conflict do nothing;
  select * into policy from public.property_policies where property_id=target_property_id for update;
  if policy.restrict_reservations_for_debt and private.unit_has_blocking_debt(target_property_id,target_unit_id,policy.minimum_overdue_days) then raise exception 'reservation_blocked_by_debt'; end if;
  if a.requires_approval then initial_status:='pending'; hold_until:=least(now()+make_interval(mins=>policy.pending_hold_minutes),actual_start); else initial_status:='approved'; hold_until:=null; end if;
  insert into public.reservations(property_id,amenity_id,unit_id,requester_member_id,starts_at,ends_at,attendee_count,status,blocks_slot,hold_expires_at,idempotency_key)
  values(target_property_id,a.id,target_unit_id,requester_id,actual_start,actual_end,target_attendee_count,initial_status,true,hold_until,target_idempotency_key) returning id into created_id;
  insert into public.activity_events(property_id,reservation_id,actor_id,event_type,new_state,description) values(target_property_id,created_id,auth.uid(),'reservation_created',initial_status,case when initial_status='pending' then 'Solicitud de reserva creada' else 'Reserva confirmada' end);
  perform private.write_property_audit(target_property_id,'reservation.created','reservation',created_id,jsonb_build_object('amenity_id',a.id,'unit_id',target_unit_id,'status',initial_status));
  if initial_status='pending' then perform private.enqueue_reservation_notification(created_id,'reservation_created','Solicitud de reserva recibida','La solicitud está pendiente de aprobación.','created'); else perform private.enqueue_reservation_notification(created_id,'reservation_approved','Reserva confirmada','La reserva fue confirmada automáticamente.','approved'); end if;
  return created_id;
exception when exclusion_violation then raise exception 'reservation_conflict';
end;
$$;

revoke all on function private.lock_unit_finance(uuid,uuid),private.receivable_outstanding(uuid),private.unit_has_blocking_debt(uuid,uuid,integer),private.enqueue_finance_notification(uuid,uuid,text,uuid,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.list_finance_account_summaries(uuid),public.set_unit_finance_access(uuid,boolean),public.create_receivable(uuid,uuid,text,numeric,date,date,text),public.import_receivables(uuid,uuid,jsonb),public.void_receivable(uuid,text),public.record_payment(uuid,uuid,numeric,date,text,jsonb,uuid),public.void_payment(uuid,text),public.update_finance_policy(uuid,boolean,integer),public.process_delinquency_notifications(uuid) from public,anon;
grant execute on function public.list_finance_account_summaries(uuid),public.set_unit_finance_access(uuid,boolean),public.create_receivable(uuid,uuid,text,numeric,date,date,text),public.import_receivables(uuid,uuid,jsonb),public.void_receivable(uuid,text),public.record_payment(uuid,uuid,numeric,date,text,jsonb,uuid),public.void_payment(uuid,text),public.update_finance_policy(uuid,boolean,integer),public.process_delinquency_notifications(uuid) to authenticated;

notify pgrst, 'reload schema';
