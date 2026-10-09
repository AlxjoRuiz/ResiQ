-- Physical utility bills received at the concierge desk share the package handoff flow.
begin;

alter table public.packages
  add column kind text not null default 'package' check (kind in ('package','utility_bill')),
  add column utility_service text check (utility_service in ('electricity','gas','water')),
  add constraint packages_kind_service_consistency_check check (
    (kind='package' and utility_service is null) or
    (kind='utility_bill' and utility_service is not null)
  );

create or replace function private.enqueue_package_notification(target_package_id uuid,target_member_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p public.packages%rowtype; notification_id uuid; recipient_email text; service_label text; notice_subject text; notice_body text;
begin
  select * into p from public.packages where id=target_package_id;
  if not found then raise exception 'package_not_found'; end if;
  service_label:=case p.utility_service when 'electricity' then 'luz' when 'gas' then 'gas' when 'water' then 'agua' else null end;
  notice_subject:=case when p.kind='utility_bill' then 'Recibo de '||service_label||' en portería' else 'Paquete recibido' end;
  notice_body:=case when p.kind='utility_bill' then 'Portería recibió un recibo de '||service_label||' para ti. Puedes recogerlo.' else 'Portería registró un paquete para ti.' end;
  insert into public.notifications(property_id,recipient_member_id,type,subject,body,target_type,target_id,dedupe_key)
  values(p.property_id,target_member_id,'package_received',notice_subject,notice_body,'package',p.id,'package-received:'||p.id||':'||target_member_id)
  on conflict(property_id,recipient_member_id,dedupe_key) do nothing returning id into notification_id;
  if notification_id is null then return; end if;
  select lower(au.email) into recipient_email from public.property_members pm join auth.users au on au.id=pm.user_id where pm.id=target_member_id and pm.status='active';
  -- Utility bills use an in-app notice until the project mail domain is configured.
  if recipient_email is not null and p.kind='package' then
    insert into public.email_jobs(property_id,notification_id,recipient_email,template_key,template_data,dedupe_key)
    values(p.property_id,notification_id,recipient_email,'package_received',jsonb_build_object('property_id',p.property_id,'package_id',p.id,'recipient_name',p.recipient_name,'carrier',p.carrier),'package-received:'||p.id||':'||target_member_id);
  end if;
end;
$$;

create or replace function public.register_utility_bill(
  target_property_id uuid,target_unit_id uuid,target_recipient_member_id uuid,target_recipient_name text,
  target_service text,target_notes text
) returns uuid language plpgsql security definer set search_path='' as $$
declare created_id uuid; service_label text; display_name text:=nullif(trim(target_recipient_name),'');
begin
  service_label:=case target_service when 'electricity' then 'luz' when 'gas' then 'gas' when 'water' then 'agua' else null end;
  if service_label is null then raise exception 'invalid_service'; end if;
  if target_recipient_member_id is null and display_name is null then raise exception 'invalid_recipient'; end if;
  created_id:=public.register_package(target_property_id,target_unit_id,null,coalesce(display_name,'Residente'),null,null,null,null,'Recibo de '||service_label,target_notes);
  update public.packages set kind='utility_bill',utility_service=target_service where id=created_id;
  update public.activity_events set description='Recibo de '||service_label||' recibido en portería'
    where package_id=created_id and event_type='package_received' and actor_id=auth.uid();
  if target_recipient_member_id is not null then
    perform public.assign_package_recipient(created_id,target_recipient_member_id);
  end if;
  return created_id;
end;
$$;

revoke all on function public.register_utility_bill(uuid,uuid,uuid,text,text,text) from public,anon;
grant execute on function public.register_utility_bill(uuid,uuid,uuid,text,text,text) to authenticated;

commit;
