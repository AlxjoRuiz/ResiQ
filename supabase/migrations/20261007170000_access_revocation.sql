-- Recheck current access for financial snapshots and representation evidence.
create or replace function private.can_read_assembly_representation(target_representation_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.assembly_representations ar
    where ar.id=target_representation_id and (
      private.is_active_member(ar.property_id,'administrator') or exists(
        select 1 from public.property_members pm
        where pm.property_id=ar.property_id and pm.id in (ar.grantor_member_id,ar.representative_member_id)
          and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
          and private.is_active_member(ar.property_id)
          and (pm.id=ar.representative_member_id or exists(
            select 1 from public.unit_memberships um where um.property_id=ar.property_id and um.unit_id=ar.unit_id
              and um.member_id=ar.grantor_member_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
          ))
      )
    )
  );
$$;

create or replace function private.can_read_assembly(target_assembly_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.assemblies a
    where a.id=target_assembly_id and (
      private.is_active_member(a.property_id,'administrator') or
      (a.published_at is not null and exists(
        select 1 from public.assembly_attendees aa
        join public.property_members pm on pm.id=aa.member_id and pm.property_id=aa.property_id
        join public.unit_memberships um on um.property_id=aa.property_id and um.member_id=aa.member_id and um.unit_id=aa.unit_id
        where aa.assembly_id=a.id and aa.property_id=a.property_id and pm.user_id=auth.uid() and pm.status='active'
          and 'member'=any(pm.roles) and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now())
      )) or
      (a.published_at is not null and exists(
        select 1 from public.assembly_representations ar
        join public.property_members pm on pm.id in (ar.grantor_member_id,ar.representative_member_id) and pm.property_id=ar.property_id
        where ar.assembly_id=a.id and ar.property_id=a.property_id and ar.status in ('submitted','validated')
          and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
          and private.can_read_assembly_representation(ar.id)
      ))
    )
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
    values(target_property_id,recipient.id,notification_type,notification_subject,notification_body,target_entity_type,target_entity_id,target_payload||jsonb_build_object('unit_id',target_unit_id),target_dedupe_prefix||':'||recipient.id)
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

create or replace function private.can_read_finance_notification(target_notification_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare n public.notifications%rowtype; target_unit uuid;
begin
  select * into n from public.notifications where id=target_notification_id;
  if not found then return false; end if;
  if n.type not in ('receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice') then return true; end if;
  if n.payload->>'unit_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    target_unit:=(n.payload->>'unit_id')::uuid;
  elsif n.target_type='receivable' then
    select ar.unit_id into target_unit from public.accounts_receivable ar where ar.id=n.target_id and ar.property_id=n.property_id;
    -- Historical batch notifications identify the unit in their generated dedupe key.
    if target_unit is null and n.dedupe_key like 'receivable-batch:%' and split_part(n.dedupe_key,':',3) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      target_unit:=split_part(n.dedupe_key,':',3)::uuid;
    end if;
  elsif n.target_type='payment' then
    select p.unit_id into target_unit from public.payments p where p.id=n.target_id and p.property_id=n.property_id;
  end if;
  return coalesce(private.can_access_unit_finance(n.property_id,target_unit),false);
end;
$$;
revoke all on function private.can_read_finance_notification(uuid) from public,anon;
grant execute on function private.can_read_finance_notification(uuid) to authenticated;
create policy notifications_current_finance_read on public.notifications as restrictive for select to authenticated
using(private.can_read_finance_notification(id));
create policy notifications_current_finance_update on public.notifications as restrictive for update to authenticated
using(private.can_read_finance_notification(id)) with check(private.can_read_finance_notification(id));

create or replace function private.can_read_document_parent(target_document_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.documents d where d.id=target_document_id and private.is_active_member(d.property_id) and (
    (d.pqrs_id is not null or d.pqrs_message_id is not null) and private.can_read_pqrs(private.pqrs_document_parent(d.id)) or
    d.attention_call_id is not null and private.can_read_attention_call(d.attention_call_id) or
    d.assembly_id is not null and private.can_read_assembly(d.assembly_id) or
    d.assembly_representation_id is not null and private.can_read_assembly_representation(d.assembly_representation_id)
  ));
$$;
revoke all on function private.can_read_document_parent(uuid) from public,anon;
grant execute on function private.can_read_document_parent(uuid) to authenticated;
create policy documents_current_parent_access on public.documents as restrictive for select to authenticated
using(private.can_read_document_parent(id));
create policy private_documents_current_read on storage.objects as restrictive for select to authenticated
using(bucket_id<>'private-documents' or exists(select 1 from public.documents d where d.bucket=bucket_id and d.object_path=name and private.can_read_document_parent(d.id)));
create policy private_documents_current_insert on storage.objects as restrictive for insert to authenticated
with check(bucket_id<>'private-documents' or exists(select 1 from public.documents d where d.bucket=bucket_id and d.object_path=name and private.can_read_document_parent(d.id)));
notify pgrst,'reload schema';
