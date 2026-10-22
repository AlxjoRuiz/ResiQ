-- Amplía la importación del censo de 500 a 2.000 respuestas por archivo.
-- Las funciones se reemplazan sin cambios de lógica: solo cambia el límite.
-- No crea usuarios, membresías, invitaciones ni trabajos de correo.
begin;

alter table public.census_imports drop constraint census_imports_record_count_check;
alter table public.census_imports
  add constraint census_imports_record_count_check check (record_count between 1 and 2000);

create or replace function public.import_census(
  target_property_id uuid, target_file_name text, target_headers jsonb, target_rows jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  import_id_value uuid;
  payload_hash_value text;
  item jsonb;
  building_id_value uuid;
  unit_id_value uuid;
  building_code_value text;
  building_name_value text;
  unit_code_value text;
  email_value text;
  header_count integer;
begin
  if actor_id is null or not private.is_active_member(target_property_id, 'administrator') then
    raise exception 'not_authorized';
  end if;
  if target_file_name is null or char_length(target_file_name) not between 1 and 180
     or target_file_name !~* '\.xlsx$' or jsonb_typeof(target_headers) <> 'array'
     or jsonb_typeof(target_rows) <> 'array' then raise exception 'invalid_census'; end if;
  header_count := jsonb_array_length(target_headers);
  if header_count not between 27 and 80 or jsonb_array_length(target_rows) not between 1 and 2000
     or exists (select 1 from jsonb_array_elements(target_headers) h where jsonb_typeof(h) <> 'string')
  then raise exception 'invalid_census'; end if;

  perform 1 from public.properties where id = target_property_id and status = 'active' for update;
  if not found then raise exception 'inactive_property'; end if;
  payload_hash_value := md5(target_headers::text || target_rows::text);
  select id into import_id_value from public.census_imports
    where property_id = target_property_id and payload_hash = payload_hash_value;
  if import_id_value is not null then return import_id_value; end if;
  if exists (select 1 from public.buildings where property_id = target_property_id)
     or exists (select 1 from public.units where property_id = target_property_id)
  then raise exception 'census_requires_empty_structure'; end if;

  insert into public.census_imports(property_id,file_name,payload_hash,headers,record_count,imported_by)
  values(target_property_id,target_file_name,payload_hash_value,target_headers,jsonb_array_length(target_rows),actor_id)
  returning id into import_id_value;

  for item in select value from jsonb_array_elements(target_rows) loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'cells') <> 'array'
       or jsonb_array_length(item->'cells') <> header_count
       or nullif(trim(item->>'building_code'),'') is null
       or nullif(trim(item->>'building_name'),'') is null
       or nullif(trim(item->>'unit_code'),'') is null
       or (item->>'source_row')::integer < 2
    then raise exception 'invalid_census_row'; end if;
    building_code_value := upper(trim(item->>'building_code'));
    building_name_value := trim(item->>'building_name');
    unit_code_value := trim(item->>'unit_code');
    if building_code_value !~ '^[A-Z0-9][A-Z0-9 -]{0,19}$'
       or char_length(building_name_value) > 80 or char_length(unit_code_value) > 30
    then raise exception 'invalid_census_row'; end if;
    select id into building_id_value from public.buildings
      where property_id=target_property_id and code=building_code_value;
    if building_id_value is null then
      insert into public.buildings(property_id,name,code)
      values(target_property_id,building_name_value,building_code_value)
      returning id into building_id_value;
    elsif not exists (select 1 from public.buildings where id=building_id_value and name=building_name_value) then
      raise exception 'conflicting_building_name';
    end if;
    select id into unit_id_value from public.units
      where property_id=target_property_id and building_id=building_id_value and code=unit_code_value;
    if unit_id_value is null then
      insert into public.units(property_id,building_id,code)
      values(target_property_id,building_id_value,unit_code_value)
      returning id into unit_id_value;
    end if;
    email_value := nullif(lower(trim(item->>'email')), '');
    if email_value is not null and (char_length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    then raise exception 'invalid_census_email'; end if;
    insert into public.census_records(property_id,import_id,building_id,unit_id,source_row,
                                      full_name,user_type,email_normalized,phone,cells)
    values(target_property_id,import_id_value,building_id_value,unit_id_value,
           (item->>'source_row')::integer,nullif(trim(item->>'full_name'),''),
           nullif(trim(item->>'user_type'),''),email_value,nullif(trim(item->>'phone'),''),item->'cells');
  end loop;
  perform private.write_property_audit(target_property_id,'census.imported','census_import',import_id_value,
    jsonb_build_object('records',jsonb_array_length(target_rows)));
  return import_id_value;
end;
$$;
revoke all on function public.import_census(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.import_census(uuid,text,jsonb,jsonb) to authenticated;

create or replace function public.import_census_with_primary(
  target_property_id uuid, target_file_name text, target_headers jsonb,
  target_rows jsonb, target_selections jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  saved_import_id uuid;
  chosen jsonb;
  chosen_row integer;
  chosen_relationship text;
  chosen_record public.census_records%rowtype;
  selected_count integer := 0;
  existing_count integer;
  finalized boolean;
  seen_rows integer[] := '{}';
  seen_units uuid[] := '{}';
  seen_emails text[] := '{}';
begin
  if not private.is_active_member(target_property_id, 'administrator') then
    raise exception 'not_authorized';
  end if;
  if jsonb_typeof(target_selections) is distinct from 'array'
     or jsonb_array_length(target_selections) > 2000 then
    raise exception 'invalid_primary_selections';
  end if;

  -- La importacion y la eleccion comparten transaccion: un error revierte ambas.
  saved_import_id := public.import_census(
    target_property_id, target_file_name, target_headers, target_rows
  );
  select primary_selection_finalized into finalized from public.census_imports
  where property_id = target_property_id and id = saved_import_id for update;
  select count(*) into existing_count from public.census_records
  where property_id = target_property_id and import_id = saved_import_id
    and invitation_primary;
  if not finalized and existing_count > 0 then
    raise exception 'unexpected_primary_state';
  end if;

  for chosen in select value from jsonb_array_elements(target_selections) loop
    if jsonb_typeof(chosen) is distinct from 'object'
       or jsonb_typeof(chosen->'source_row') is distinct from 'number'
       or coalesce(chosen->>'source_row', '') !~ '^[0-9]{1,6}$'
       or coalesce(chosen->>'relationship', '') not in ('owner', 'resident') then
      raise exception 'invalid_primary_selection';
    end if;
    chosen_row := (chosen->>'source_row')::integer;
    chosen_relationship := chosen->>'relationship';
    select * into chosen_record from public.census_records
    where property_id = target_property_id and import_id = saved_import_id
      and source_row = chosen_row for update;
    if not found or chosen_record.email_normalized is null
       or chosen_record.full_name is null then
      raise exception 'primary_missing_email_or_name';
    end if;
    if chosen_row = any(seen_rows)
       or chosen_record.unit_id = any(seen_units)
       or chosen_record.email_normalized = any(seen_emails) then
      raise exception 'duplicate_primary_unit_or_email';
    end if;
    seen_rows := array_append(seen_rows, chosen_row);
    seen_units := array_append(seen_units, chosen_record.unit_id);
    seen_emails := array_append(seen_emails, chosen_record.email_normalized);
    if finalized then
      if not chosen_record.invitation_primary
         or chosen_record.invitation_relationship <> chosen_relationship then
        raise exception 'primary_selection_changed';
      end if;
    else
      update public.census_records
      set invitation_primary = true,
          invitation_relationship = chosen_relationship
      where id = chosen_record.id;
    end if;
    selected_count := selected_count + 1;
  end loop;

  if finalized and existing_count <> selected_count then
    raise exception 'primary_selection_changed';
  end if;
  if not finalized then
    update public.census_imports set primary_selection_finalized = true
    where property_id = target_property_id and id = saved_import_id;
  end if;
  return saved_import_id;
end;
$$;

revoke all on function public.import_census_with_primary(uuid,text,jsonb,jsonb,jsonb)
  from public, anon;
grant execute on function public.import_census_with_primary(uuid,text,jsonb,jsonb,jsonb)
  to authenticated;

commit;

select 'CENSUS_CAPACITY_2000_OK' as result;
