-- Paquetes: solo portería registra llegadas, asocia destinatarios y entrega (decisión de
-- Alejandro, 25/10/2026). Administración solo consulta la lista, el historial y el detalle.
-- Las funciones son las de 20261001100000_packages.sql con el permiso limitado a portería.
begin;

create or replace function public.register_package(
  target_property_id uuid,target_unit_id uuid,target_recipient_member_id uuid,target_recipient_name text,
  target_carrier text,target_tracking_number text,target_sender_name text,target_origin text,target_description text,target_notes text
) returns uuid language plpgsql security definer set search_path='' as $$
declare created_id uuid; clean_recipient text; clean_carrier text; clean_tracking text; clean_sender text; clean_origin text; clean_notes text;
begin
  if not private.is_active_member(target_property_id,'concierge') then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.units u where u.id=target_unit_id and u.property_id=target_property_id and u.status='active') then raise exception 'invalid_unit'; end if;
  clean_recipient:=nullif(trim(target_recipient_name),''); clean_carrier:=nullif(trim(target_carrier),''); clean_tracking:=nullif(trim(target_tracking_number),''); clean_sender:=nullif(trim(target_sender_name),''); clean_origin:=nullif(trim(target_origin),''); clean_notes:=nullif(trim(target_notes),'');
  if target_recipient_member_id is not null then
    select pr.display_name into clean_recipient from public.property_members pm join public.profiles pr on pr.id=pm.user_id join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id
    where pm.id=target_recipient_member_id and pm.property_id=target_property_id and pm.status='active' and 'member'=any(pm.roles) and um.unit_id=target_unit_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now());
    if clean_recipient is null then raise exception 'invalid_recipient'; end if;
  end if;
  if clean_recipient is null or char_length(clean_recipient) not between 2 and 120 or char_length(trim(target_description)) not between 3 and 500 then raise exception 'invalid_input'; end if;
  if coalesce(char_length(clean_carrier),2) not between 2 and 100 or coalesce(char_length(clean_tracking),2) not between 2 and 100 or coalesce(char_length(clean_sender),2) not between 2 and 120 or coalesce(char_length(clean_origin),2) not between 2 and 120 or coalesce(char_length(clean_notes),0)>1000 then raise exception 'invalid_input'; end if;
  insert into public.packages(property_id,unit_id,recipient_member_id,recipient_name,carrier,tracking_number,sender_name,origin,description,notes,received_by)
  values(target_property_id,target_unit_id,target_recipient_member_id,clean_recipient,clean_carrier,clean_tracking,clean_sender,clean_origin,trim(target_description),clean_notes,auth.uid()) returning id into created_id;
  insert into public.activity_events(property_id,package_id,actor_id,event_type,new_state,description) values(target_property_id,created_id,auth.uid(),'package_received','received','Paquete recibido en portería');
  perform private.write_property_audit(target_property_id,'package.received','package',created_id,jsonb_build_object('unit_id',target_unit_id));
  if target_recipient_member_id is not null then perform private.enqueue_package_notification(created_id,target_recipient_member_id); end if;
  return created_id;
end;
$$;

create or replace function public.assign_package_recipient(target_package_id uuid,target_member_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p public.packages%rowtype; resolved_name text;
begin
  select * into p from public.packages where id=target_package_id for update;
  if not found or not private.is_active_member(p.property_id,'concierge') then raise exception 'not_authorized'; end if;
  if p.status='delivered' or p.recipient_member_id is not null then raise exception 'invalid_transition'; end if;
  select pr.display_name into resolved_name from public.property_members pm join public.profiles pr on pr.id=pm.user_id join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id
  where pm.id=target_member_id and pm.property_id=p.property_id and pm.status='active' and 'member'=any(pm.roles) and um.unit_id=p.unit_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now());
  if resolved_name is null then raise exception 'invalid_recipient'; end if;
  update public.packages set recipient_member_id=target_member_id,recipient_name=resolved_name where id=p.id;
  insert into public.activity_events(property_id,package_id,actor_id,event_type,description) values(p.property_id,p.id,auth.uid(),'package_recipient_assigned','Destinatario asociado');
  perform private.write_property_audit(p.property_id,'package.recipient_assigned','package',p.id,jsonb_build_object('recipient_member_id',target_member_id));
  perform private.enqueue_package_notification(p.id,target_member_id);
end;
$$;

create or replace function public.deliver_package(target_package_id uuid,target_collected_by_name text)
returns void language plpgsql security definer set search_path='' as $$
declare p public.packages%rowtype; collector text:=trim(target_collected_by_name);
begin
  select * into p from public.packages where id=target_package_id for update;
  if not found or not private.is_active_member(p.property_id,'concierge') then raise exception 'not_authorized'; end if;
  if p.status='delivered' or char_length(collector) not between 2 and 120 then raise exception 'invalid_transition'; end if;
  update public.packages set status='delivered',delivered_at=now(),delivered_by=auth.uid(),collected_by_name=collector where id=p.id;
  insert into public.activity_events(property_id,package_id,actor_id,event_type,previous_state,new_state,description) values(p.property_id,p.id,auth.uid(),'package_delivered',p.status,'delivered','Paquete entregado a '||collector);
  perform private.write_property_audit(p.property_id,'package.delivered','package',p.id,jsonb_build_object('collected_by_name',collector));
end;
$$;

commit;

select
  pg_get_functiondef('public.register_package(uuid,uuid,uuid,text,text,text,text,text,text,text)'::regprocedure) not like '%administrator%' as registrar_solo_porteria,
  pg_get_functiondef('public.assign_package_recipient(uuid,uuid)'::regprocedure) not like '%administrator%' as asociar_solo_porteria,
  pg_get_functiondef('public.deliver_package(uuid,text)'::regprocedure) not like '%administrator%' as entregar_solo_porteria;
