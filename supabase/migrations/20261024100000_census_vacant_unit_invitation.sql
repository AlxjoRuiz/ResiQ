-- Apartamento libre (sin residente vinculado ni invitación pendiente): al guardar los datos
-- del nuevo residente desde «Nueva invitación» se crea la invitación, aunque el correo sea el
-- mismo de antes (volver a invitar a la misma persona). Resultado nuevo: invitation_created.
begin;
create or replace function public.update_census_record(target_property_id uuid, target_record_id uuid, target_cells jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  rec public.census_records%rowtype;
  headers_value jsonb;
  tower_index integer; unit_index integer; name_index integer; type_index integer; email_index integer; phone_index integer;
  new_name text; new_type text; new_email text; new_phone text; new_relationship text; normalized_type text;
  occupied boolean;
  replace_resident boolean := false;
  link record;
  outcome text := 'saved';
  has_pending boolean;
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  select * into rec from public.census_records where id = target_record_id and property_id = target_property_id for update;
  if not found then raise exception 'record_not_found'; end if;
  select headers into headers_value from public.census_imports where id = rec.import_id and property_id = target_property_id;

  if jsonb_typeof(target_cells) is distinct from 'array' or jsonb_array_length(target_cells) <> jsonb_array_length(headers_value)
     or exists (select 1 from jsonb_array_elements(target_cells) c
                where jsonb_typeof(c) not in ('string', 'null') or (jsonb_typeof(c) = 'string' and char_length(c #>> '{}') > 1000)) then
    raise exception 'invalid_cells';
  end if;
  has_pending := exists (select 1 from public.invitations i where i.property_id = target_property_id
                         and i.unit_id = rec.unit_id and i.status = 'pending');

  tower_index := private.census_header_index(headers_value, 'torre');
  unit_index := private.census_header_index(headers_value, 'apartamento');
  if tower_index is null or unit_index is null
     or (target_cells -> tower_index) is distinct from (rec.cells -> tower_index)
     or (target_cells -> unit_index) is distinct from (rec.cells -> unit_index) then
    raise exception 'locked_field';
  end if;

  name_index := private.census_header_index(headers_value, 'nombre completo');
  type_index := private.census_header_index(headers_value, 'tipo de usuario');
  email_index := private.census_header_index(headers_value, 'correo electronico');
  phone_index := private.census_header_index(headers_value, 'numero de telefono');
  new_name := nullif(trim(target_cells ->> name_index), '');
  new_type := nullif(trim(target_cells ->> type_index), '');
  new_email := nullif(lower(trim(target_cells ->> email_index)), '');
  new_phone := nullif(trim(target_cells ->> phone_index), '');
  if new_email is not null and (char_length(new_email) > 254 or new_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'invalid_census_email';
  end if;
  normalized_type := lower(translate(coalesce(new_type, ''), 'ÁÉÍÓÚáéíóú', 'AEIOUaeiou'));
  new_relationship := case when normalized_type in ('propietario', 'propietaria') then 'owner'
                           when normalized_type in ('residente', 'arrendatario', 'arrendataria') then 'resident' end;
  occupied := exists (select 1 from public.unit_memberships um where um.property_id = target_property_id and um.unit_id = rec.unit_id
                      and um.valid_from <= now() and (um.valid_to is null or um.valid_to > now()));
  -- Sin cambios solo se ignora si no hay que invitar: un apartamento libre sin invitación
  -- pendiente puede volver a invitar con los mismos datos.
  if target_cells = rec.cells and (occupied or has_pending) then return 'unchanged'; end if;

  -- Apartamento con residente: si cambia el correo por uno que no es el de la cuenta vinculada,
  -- se desvincula al residente actual y se invita al correo nuevo (decisión de Alejandro).
  if occupied and new_name is not null and new_email is not null and new_email is distinct from rec.email_normalized
     and not exists (select 1 from public.unit_memberships um join public.property_members pm on pm.id = um.member_id and pm.property_id = um.property_id
                     join auth.users au on au.id = pm.user_id
                     where um.property_id = target_property_id and um.unit_id = rec.unit_id and um.valid_to is null
                       and lower(au.email) = new_email) then
    replace_resident := true;
  end if;

  if (not occupied or replace_resident) and new_name is not null and new_email is not null then
    if new_relationship is null then raise exception 'invalid_user_type'; end if;
    if exists (select 1 from public.census_records r where r.property_id = target_property_id and r.id <> rec.id
               and r.invitation_primary and r.email_normalized = new_email)
       or exists (select 1 from public.invitations i where i.property_id = target_property_id and i.status = 'pending'
                  and i.email_normalized = new_email and i.unit_id is distinct from rec.unit_id) then
      raise exception 'email_in_use';
    end if;
  end if;

  if target_cells <> rec.cells then
    insert into public.census_record_changes(property_id, census_record_id, changed_by, previous_cells, new_cells)
    values (target_property_id, rec.id, auth.uid(), rec.cells, target_cells);
  end if;
  update public.census_records
  set cells = target_cells, full_name = new_name, user_type = new_type, email_normalized = new_email, phone = new_phone
  where id = rec.id;

  if replace_resident then
    for link in select um.id from public.unit_memberships um
                where um.property_id = target_property_id and um.unit_id = rec.unit_id and um.valid_to is null loop
      perform public.end_unit_membership(target_property_id, link.id);
    end loop;
    occupied := false;
    outcome := 'resident_replaced';
  end if;

  if not occupied then
    if new_name is not null and new_email is not null then
      if not rec.invitation_primary or rec.email_normalized is distinct from new_email
         or rec.invitation_relationship is distinct from new_relationship or not has_pending then
        update public.census_records set invitation_primary = true, invitation_relationship = new_relationship where id = rec.id;
        perform private.enqueue_resident_invitation(target_property_id, rec.unit_id, new_email, new_relationship, auth.uid());
        if outcome = 'saved' then outcome := case when has_pending then 'invitation_replaced' else 'invitation_created' end; end if;
      end if;
    elsif rec.invitation_primary then
      update public.census_records set invitation_primary = false, invitation_relationship = null where id = rec.id;
      update public.email_jobs j set status = 'cancelled', last_error_code = 'census_contact_removed', locked_by = null, locked_until = null
      from public.invitations i
      where j.invitation_id = i.id and i.property_id = target_property_id and i.unit_id = rec.unit_id
        and i.status = 'pending' and j.status in ('held', 'queued');
      update public.invitations set status = 'revoked', updated_at = now()
      where property_id = target_property_id and unit_id = rec.unit_id and status = 'pending';
    end if;
  end if;

  perform private.write_property_audit(target_property_id, 'census.record_updated', 'census_record', rec.id,
    jsonb_build_object('unit_id', rec.unit_id, 'outcome', outcome));
  return outcome;
end;
$$;
revoke all on function public.update_census_record(uuid, uuid, jsonb) from public, anon;
grant execute on function public.update_census_record(uuid, uuid, jsonb) to authenticated;

commit;

select has_function_privilege('authenticated', 'public.update_census_record(uuid,uuid,jsonb)', 'execute') as editar_disponible,
  pg_get_functiondef('public.update_census_record(uuid,uuid,jsonb)'::regprocedure) like '%invitation_created%' as nueva_invitacion;
