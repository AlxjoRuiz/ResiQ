-- Guarda la eleccion explicita de un destinatario principal por apartamento.
-- Esta migracion NO crea invitaciones, trabajos de correo ni usuarios.
begin;

alter table public.census_imports
  add column primary_selection_finalized boolean not null default false;

alter table public.census_records
  add column invitation_primary boolean not null default false,
  add column invitation_relationship text
    check (invitation_relationship in ('owner', 'resident'));

alter table public.census_records
  add constraint census_primary_relationship_check
  check (invitation_primary = (invitation_relationship is not null));

create unique index census_one_invitation_primary_per_unit
  on public.census_records(property_id, import_id, unit_id)
  where invitation_primary;

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
     or jsonb_array_length(target_selections) > 500 then
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

select 'CENSUS_PRIMARY_SCHEMA_OK' as result;
