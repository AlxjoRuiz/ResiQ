-- Separate the intent from the topic, preserving historical categories.
begin;
alter table public.pqrs add column request_type text check (request_type in ('request','complaint','claim','suggestion'));
update public.pqrs set request_type=category where category in ('complaint','suggestion');
create or replace function public.create_pqrs(
  target_property_id uuid,target_unit_id uuid,target_category text,target_request_type text,target_subject text,target_description text
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor_member_id uuid; created_id uuid; recipient record;
begin
  if target_request_type is null or target_request_type not in ('request','complaint','claim','suggestion') or target_category is null or target_category not in ('accounting','administration','security','operations','cleaning','maintenance')
    or char_length(trim(target_subject)) not between 4 and 140 or char_length(trim(target_description)) not between 10 and 5000 then raise exception 'invalid_input'; end if;
  select pm.id into actor_member_id
  from public.property_members pm join public.unit_memberships um on um.property_id=pm.property_id and um.member_id=pm.id
  where pm.property_id=target_property_id and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
    and um.unit_id=target_unit_id and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now());
  if actor_member_id is null then raise exception 'not_authorized'; end if;
  insert into public.pqrs(property_id,unit_id,author_member_id,category,request_type,subject,description)
  values(target_property_id,target_unit_id,actor_member_id,target_category,target_request_type,trim(target_subject),trim(target_description)) returning id into created_id;
  insert into public.activity_events(property_id,pqrs_id,actor_id,event_type,new_state,description)
  values(target_property_id,created_id,auth.uid(),'created','pending','PQRS creada');
  perform private.write_property_audit(target_property_id,'pqrs.created','pqrs',created_id,jsonb_build_object('category',target_category,'request_type',target_request_type));
  for recipient in select id from public.property_members where property_id=target_property_id and status='active' and 'administrator'=any(roles) loop
    perform private.enqueue_pqrs_notification(created_id,recipient.id,'pqrs_created','Nueva PQRS','Se creó una nueva PQRS en la propiedad.','pqrs-created:'||created_id||':'||recipient.id);
  end loop;
  return created_id;
end;
$$;
revoke all on function public.create_pqrs(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.create_pqrs(uuid,uuid,text,text,text,text) to authenticated;
commit;
