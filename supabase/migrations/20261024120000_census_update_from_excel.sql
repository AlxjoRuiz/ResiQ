-- Actualizar el censo subiendo otro Excel en una propiedad que ya tiene torres.
-- Reglas aprobadas por Alejandro (24/10/2026):
-- * Mismo apartamento (torre + número): se actualizan sus datos con update_census_record,
--   así que aplica lo mismo que «Editar»: historial, invitación reemplazada si cambia el
--   correo o el tipo y, con residente vinculado, desvinculación e invitación al correo nuevo.
--   Torre y apartamento conservan el texto ya guardado.
-- * Apartamento nuevo: se crea (y su torre si no existe) con su invitación retenida.
-- * Apartamento que no viene en el Excel: no se toca. Nunca se borra nada.
-- * Las columnas deben ser las mismas del censo existente.
-- * dry_run = true aplica todo, cuenta el resultado y lo deshace (vista previa exacta).
begin;

create or replace function private.census_header_key(header text)
returns text language sql immutable set search_path = '' as $$
  select trim(regexp_replace(lower(translate(header, 'ÁÀÄÉÈËÍÌÏÓÒÖÚÙÜÑáàäéèëíìïóòöúùüñ', 'AAAEEEIIIOOOUUUNaaaeeeiiiooouuun')),
                             '[^a-z0-9]+', ' ', 'g'));
$$;
revoke all on function private.census_header_key(text) from public, anon, authenticated;

create or replace function private.apply_census_update(
  target_property_id uuid, target_file_name text, target_headers jsonb, target_rows jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  existing_headers jsonb;
  import_id_value uuid;
  payload_hash_value text;
  item jsonb;
  source_row_value integer;
  building_id_value uuid;
  unit_id_value uuid;
  building_code_value text;
  building_name_value text;
  unit_code_value text;
  email_value text;
  name_value text;
  type_value text;
  relationship_value text;
  rec public.census_records%rowtype;
  new_cells jsonb;
  tower_index integer;
  unit_index integer;
  outcome text;
  updated_count integer := 0;
  created_count integer := 0;
  unchanged_count integer := 0;
  towers_created integer := 0;
  invitations_count integer := 0;
  replaced jsonb := '[]'::jsonb;
begin
  if target_file_name is null or char_length(target_file_name) not between 1 and 180 or target_file_name !~* '\.xlsx$'
     or jsonb_typeof(target_headers) is distinct from 'array' or jsonb_typeof(target_rows) is distinct from 'array'
     or jsonb_array_length(target_rows) not between 1 and 2000 then
    raise exception 'invalid_census';
  end if;

  perform 1 from public.properties where id = target_property_id and status = 'active' for update;
  if not found then raise exception 'inactive_property'; end if;

  select headers into existing_headers from public.census_imports
  where property_id = target_property_id order by created_at limit 1;
  if existing_headers is null then raise exception 'no_existing_census'; end if;
  if (select array_agg(private.census_header_key(h.value) order by h.position) from jsonb_array_elements_text(existing_headers) with ordinality h(value, position))
     is distinct from
     (select array_agg(private.census_header_key(h.value) order by h.position) from jsonb_array_elements_text(target_headers) with ordinality h(value, position)) then
    raise exception 'headers_mismatch';
  end if;
  tower_index := private.census_header_index(existing_headers, 'torre');
  unit_index := private.census_header_index(existing_headers, 'apartamento');

  payload_hash_value := md5(target_headers::text || target_rows::text);
  insert into public.census_imports(property_id, file_name, payload_hash, headers, record_count, imported_by, primary_selection_finalized)
  values (target_property_id, target_file_name, payload_hash_value, existing_headers, jsonb_array_length(target_rows), auth.uid(), true)
  on conflict (property_id, payload_hash) do nothing
  returning id into import_id_value;
  if import_id_value is null then
    select id into import_id_value from public.census_imports where property_id = target_property_id and payload_hash = payload_hash_value;
  end if;

  for item in select value from jsonb_array_elements(target_rows) loop
    source_row_value := (item ->> 'source_row')::integer;
    begin
      if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'cells') <> 'array'
         or jsonb_array_length(item -> 'cells') <> jsonb_array_length(existing_headers)
         or nullif(trim(item ->> 'building_code'), '') is null or nullif(trim(item ->> 'building_name'), '') is null
         or nullif(trim(item ->> 'unit_code'), '') is null or source_row_value < 2 then
        raise exception 'invalid_census_row';
      end if;
      building_code_value := upper(trim(item ->> 'building_code'));
      building_name_value := trim(item ->> 'building_name');
      unit_code_value := trim(item ->> 'unit_code');
      if building_code_value !~ '^[A-Z0-9][A-Z0-9 -]{0,19}$' or char_length(building_name_value) > 80 or char_length(unit_code_value) > 30 then
        raise exception 'invalid_census_row';
      end if;

      select id into building_id_value from public.buildings where property_id = target_property_id and code = building_code_value;
      if building_id_value is null then
        insert into public.buildings(property_id, name, code) values (target_property_id, building_name_value, building_code_value)
        returning id into building_id_value;
        towers_created := towers_created + 1;
      end if;
      select id into unit_id_value from public.units
      where property_id = target_property_id and building_id = building_id_value and code = unit_code_value;
      if unit_id_value is null then
        insert into public.units(property_id, building_id, code) values (target_property_id, building_id_value, unit_code_value)
        returning id into unit_id_value;
      end if;

      select * into rec from public.census_records where property_id = target_property_id and unit_id = unit_id_value;
      if found then
        -- Torre y apartamento conservan lo ya guardado; el resto viene del Excel nuevo.
        new_cells := jsonb_set(jsonb_set(item -> 'cells', array[tower_index::text], rec.cells -> tower_index),
                               array[unit_index::text], rec.cells -> unit_index);
        -- Datos idénticos: no se toca (tampoco se vuelve a invitar a quien ya no vive ahí).
        outcome := case when new_cells = rec.cells then 'unchanged' else public.update_census_record(target_property_id, rec.id, new_cells) end;
        if outcome = 'unchanged' then
          unchanged_count := unchanged_count + 1;
        else
          updated_count := updated_count + 1;
          if outcome in ('invitation_created', 'invitation_replaced', 'resident_replaced') then invitations_count := invitations_count + 1; end if;
          if outcome = 'resident_replaced' then
            replaced := replaced || jsonb_build_array(building_name_value || ' · ' || unit_code_value);
          end if;
        end if;
      else
        name_value := nullif(trim(item ->> 'full_name'), '');
        type_value := nullif(trim(item ->> 'user_type'), '');
        email_value := nullif(lower(trim(item ->> 'email')), '');
        if email_value is not null and (char_length(email_value) > 254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
          raise exception 'invalid_census_email';
        end if;
        relationship_value := case when lower(translate(coalesce(type_value, ''), 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) in ('propietario', 'propietaria') then 'owner'
                                   when lower(translate(coalesce(type_value, ''), 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou')) in ('residente', 'arrendatario', 'arrendataria') then 'resident' end;
        if name_value is not null and email_value is not null then
          if relationship_value is null then raise exception 'invalid_user_type'; end if;
          if exists (select 1 from public.census_records r where r.property_id = target_property_id and r.invitation_primary and r.email_normalized = email_value)
             or exists (select 1 from public.invitations i where i.property_id = target_property_id and i.status = 'pending'
                        and i.email_normalized = email_value and i.unit_id is distinct from unit_id_value) then
            raise exception 'email_in_use';
          end if;
        end if;
        insert into public.census_records(property_id, import_id, building_id, unit_id, source_row, full_name, user_type, email_normalized, phone, cells,
                                          invitation_primary, invitation_relationship)
        values (target_property_id, import_id_value, building_id_value, unit_id_value, source_row_value, name_value, type_value, email_value,
                nullif(trim(item ->> 'phone'), ''), item -> 'cells',
                name_value is not null and email_value is not null,
                case when name_value is not null and email_value is not null then relationship_value end);
        created_count := created_count + 1;
        if name_value is not null and email_value is not null
           and not exists (select 1 from public.unit_memberships um where um.property_id = target_property_id and um.unit_id = unit_id_value
                           and um.valid_from <= now() and (um.valid_to is null or um.valid_to > now())) then
          perform private.enqueue_resident_invitation(target_property_id, unit_id_value, email_value, relationship_value, auth.uid());
          invitations_count := invitations_count + 1;
        end if;
      end if;
    exception when others then
      raise exception 'fila %: %', source_row_value, sqlerrm;
    end;
  end loop;

  perform private.write_property_audit(target_property_id, 'census.updated_from_excel', 'census_import', import_id_value,
    jsonb_build_object('updated', updated_count, 'created', created_count, 'unchanged', unchanged_count));
  return jsonb_build_object('updated', updated_count, 'created', created_count, 'unchanged', unchanged_count,
                            'towers_created', towers_created, 'invitations', invitations_count, 'replaced_residents', replaced);
end;
$$;
revoke all on function private.apply_census_update(uuid, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.update_census_from_excel(
  target_property_id uuid, target_file_name text, target_headers jsonb, target_rows jsonb, dry_run boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare summary jsonb;
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  begin
    summary := private.apply_census_update(target_property_id, target_file_name, target_headers, target_rows);
    if dry_run then raise exception using errcode = 'RQDRY', message = 'census_update_preview'; end if;
  exception when sqlstate 'RQDRY' then
    -- Vista previa: los cambios del bloque se deshacen y solo se devuelve el resumen.
    return summary || jsonb_build_object('preview', true);
  end;
  return summary || jsonb_build_object('preview', false);
end;
$$;
revoke all on function public.update_census_from_excel(uuid, text, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.update_census_from_excel(uuid, text, jsonb, jsonb, boolean) to authenticated;

commit;

select has_function_privilege('authenticated', 'public.update_census_from_excel(uuid,text,jsonb,jsonb,boolean)', 'execute') as actualizar_disponible,
  not has_function_privilege('authenticated', 'private.apply_census_update(uuid,text,jsonb,jsonb)', 'execute') as aplicar_protegido,
  private.census_header_key('¿CORREO ELECTRÓNICO?') = 'correo electronico' as encabezados_ok;
