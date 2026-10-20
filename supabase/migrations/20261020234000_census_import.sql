-- Primera entrega del censo: importación atómica a una propiedad sin estructura.
-- No crea usuarios, membresías ni invitaciones.
begin;

create table public.census_imports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  file_name text not null check (char_length(file_name) between 1 and 180),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{32}$'),
  headers jsonb not null check (jsonb_typeof(headers) = 'array'),
  record_count integer not null check (record_count between 1 and 500),
  imported_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (property_id, id),
  unique (property_id, payload_hash)
);

create table public.census_records (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  import_id uuid not null,
  building_id uuid not null,
  unit_id uuid not null,
  source_row integer not null check (source_row >= 2),
  full_name text,
  user_type text,
  email_normalized text,
  phone text,
  cells jsonb not null check (jsonb_typeof(cells) = 'array'),
  created_at timestamptz not null default now(),
  unique (property_id, import_id, source_row),
  foreign key (property_id, import_id) references public.census_imports(property_id, id) on delete restrict,
  foreign key (property_id, building_id) references public.buildings(property_id, id) on delete restrict,
  foreign key (property_id, unit_id) references public.units(property_id, id) on delete restrict
);
create index census_records_unit_idx on public.census_records(property_id, unit_id, source_row);

alter table public.census_imports enable row level security;
alter table public.census_records enable row level security;
revoke all on public.census_imports, public.census_records from public, anon, authenticated;
grant select on public.census_imports, public.census_records to authenticated;
create policy census_imports_admin_read on public.census_imports for select to authenticated
  using (private.is_active_member(property_id, 'administrator'));
create policy census_records_admin_read on public.census_records for select to authenticated
  using (private.is_active_member(property_id, 'administrator'));

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
  if header_count not between 27 and 80 or jsonb_array_length(target_rows) not between 1 and 500
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

commit;

select 'CENSO_SCHEMA_OK' as result;
