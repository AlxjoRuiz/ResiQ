-- Cola de invitaciones de residentes con modo de prueba (entrega 1: base de datos).
-- * Al importar el censo se crea una invitación por apartamento con principal y su trabajo
--   en email_jobs. En modo de prueba (por defecto) el trabajo queda «held»: el trabajador
--   solo reclama «queued», así que no sale ningún correo.
-- * El código secreto del enlace no se guarda: la invitación nace con un hash inutilizable
--   y el código se genera al pulsar «Ver enlace» (o, más adelante, justo antes de enviar),
--   con 72 horas de vigencia desde ese momento.
-- * Antes de generar el código se revalida: invitación pendiente, apartamento activo y sin
--   residente vigente, correo sin rol de administración o portería.
begin;

alter table public.email_jobs drop constraint email_jobs_status_check;
alter table public.email_jobs add constraint email_jobs_status_check
  check (status in ('held','queued','processing','accepted','failed','cancelled'));
alter table public.email_jobs drop constraint email_jobs_template_key_check;
alter table public.email_jobs add constraint email_jobs_template_key_check check (template_key in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice','attention_call_created','assembly_published','assembly_reminder','assembly_updated','assembly_cancelled','visit_requested','visit_rejected','resident_invitation'));
create unique index email_jobs_one_per_invitation on public.email_jobs(invitation_id) where invitation_id is not null;

alter table public.invitations add column link_issued_at timestamptz;

-- Interruptor global del envío real. Solo se cambia por SQL cuando haya dominio verificado.
create table private.invitation_delivery (
  singleton boolean primary key default true check (singleton),
  live boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into private.invitation_delivery default values;
revoke all on private.invitation_delivery from public, anon, authenticated;

-- Crea la invitación (sin código utilizable) y su trabajo de correo. Reemplaza invitaciones
-- pendientes del mismo correo o del mismo apartamento y cancela sus trabajos sin enviar.
create or replace function private.enqueue_resident_invitation(
  target_property_id uuid, target_unit_id uuid, target_email text, target_relationship text, actor_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(trim(target_email));
  invitation_id_value uuid;
  live_value boolean;
begin
  if normalized_email is null or char_length(normalized_email) > 254
     or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  if target_relationship is null or target_relationship not in ('owner','resident') then raise exception 'invalid_relationship'; end if;
  if not exists (select 1 from public.units where id = target_unit_id and property_id = target_property_id and status = 'active') then
    raise exception 'invalid_unit';
  end if;

  update public.email_jobs j set status = 'cancelled', last_error_code = 'invitation_replaced', locked_by = null, locked_until = null
  from public.invitations i
  where j.invitation_id = i.id and i.property_id = target_property_id and i.status = 'pending'
    and (i.email_normalized = normalized_email or i.unit_id = target_unit_id) and j.status in ('held','queued');
  update public.invitations set status = 'revoked', updated_at = now()
  where property_id = target_property_id and status = 'pending'
    and (email_normalized = normalized_email or unit_id = target_unit_id);

  insert into public.invitations(property_id, email_normalized, token_hash, roles, unit_id, relationship, expires_at, invited_by)
  values (target_property_id, normalized_email, encode(extensions.digest(extensions.gen_random_bytes(32), 'sha256'), 'hex'),
          array['member']::text[], target_unit_id, target_relationship, now() + interval '30 days', actor_id)
  returning id into invitation_id_value;

  select live into live_value from private.invitation_delivery;
  insert into public.email_jobs(property_id, invitation_id, recipient_email, template_key, template_data, dedupe_key, status)
  values (target_property_id, invitation_id_value, normalized_email, 'resident_invitation',
          jsonb_build_object('property_id', target_property_id, 'unit_id', target_unit_id),
          'invitation:' || invitation_id_value, case when coalesce(live_value, false) then 'queued' else 'held' end);
  return invitation_id_value;
end;
$$;
revoke all on function private.enqueue_resident_invitation(uuid,uuid,text,text,uuid) from public, anon, authenticated;

-- Revalida la invitación y genera el código del enlace (72 horas). Si ya no corresponde,
-- la revoca, cancela su trabajo y devuelve null.
create or replace function private.issue_invitation_token(target_invitation_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitations%rowtype;
  raw_token text;
begin
  select * into inv from public.invitations where id = target_invitation_id for update;
  if not found then return null; end if;
  if inv.status <> 'pending'
     or not exists (select 1 from public.units u join public.buildings b on b.id = u.building_id and b.property_id = u.property_id
                    where u.id = inv.unit_id and u.property_id = inv.property_id and u.status = 'active' and b.active)
     or exists (select 1 from public.unit_memberships um where um.property_id = inv.property_id and um.unit_id = inv.unit_id
                and um.valid_from <= now() and (um.valid_to is null or um.valid_to > now()))
     or exists (select 1 from public.property_members pm join auth.users au on au.id = pm.user_id
                where pm.property_id = inv.property_id and lower(au.email) = inv.email_normalized
                  and ('administrator' = any(pm.roles) or 'concierge' = any(pm.roles))) then
    if inv.status = 'pending' then
      update public.invitations set status = 'revoked', updated_at = now() where id = inv.id;
    end if;
    update public.email_jobs set status = 'cancelled', last_error_code = 'invitation_not_available', locked_by = null, locked_until = null
    where invitation_id = inv.id and status in ('held','queued','processing');
    return null;
  end if;
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.invitations
  set token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex'), expires_at = now() + interval '72 hours',
      link_issued_at = now(), updated_at = now()
  where id = inv.id;
  return raw_token;
end;
$$;
revoke all on function private.issue_invitation_token(uuid) from public, anon, authenticated;

-- «Agregar residente» en un apartamento vacío: crea la invitación en la cola.
create or replace function public.queue_resident_invitation(
  target_property_id uuid, target_unit_id uuid, target_email text, target_relationship text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  normalized_email text := lower(trim(target_email));
  invitation_id_value uuid;
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if not exists (select 1 from public.units u join public.buildings b on b.id = u.building_id and b.property_id = u.property_id
                 where u.id = target_unit_id and u.property_id = target_property_id and u.status = 'active' and b.active) then
    raise exception 'invalid_unit';
  end if;
  if exists (select 1 from public.unit_memberships um where um.property_id = target_property_id and um.unit_id = target_unit_id
             and um.valid_from <= now() and (um.valid_to is null or um.valid_to > now())) then
    raise exception 'unit_not_empty';
  end if;
  if exists (select 1 from public.property_members pm join auth.users au on au.id = pm.user_id
             where pm.property_id = target_property_id and lower(au.email) = normalized_email
               and ('administrator' = any(pm.roles) or 'concierge' = any(pm.roles))) then
    raise exception 'not_a_resident';
  end if;
  invitation_id_value := private.enqueue_resident_invitation(target_property_id, target_unit_id, normalized_email, target_relationship, auth.uid());
  perform private.write_property_audit(target_property_id, 'invitation.queued', 'invitation', invitation_id_value,
    jsonb_build_object('unit_id', target_unit_id, 'relationship', target_relationship));
  return invitation_id_value;
end;
$$;
revoke all on function public.queue_resident_invitation(uuid,uuid,text,text) from public, anon;
grant execute on function public.queue_resident_invitation(uuid,uuid,text,text) to authenticated;

-- «Ver enlace»: el admin obtiene un enlace nuevo de 72 horas; el anterior deja de servir.
create or replace function public.reveal_invitation_link(target_property_id uuid, target_invitation_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text;
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  if not exists (select 1 from public.invitations where id = target_invitation_id and property_id = target_property_id
                 and roles = array['member']::text[] and unit_id is not null) then
    raise exception 'invitation_not_found';
  end if;
  raw_token := private.issue_invitation_token(target_invitation_id);
  perform private.write_property_audit(target_property_id, 'invitation.link_revealed', 'invitation', target_invitation_id,
    jsonb_build_object('issued', raw_token is not null));
  return raw_token;
end;
$$;
revoke all on function public.reveal_invitation_link(uuid,uuid) from public, anon;
grant execute on function public.reveal_invitation_link(uuid,uuid) to authenticated;

-- Estado de la última invitación de cada apartamento, solo para administración.
create or replace function public.get_unit_invitations(target_property_id uuid)
returns table(unit_id uuid, invitation_id uuid, email text, relationship text, invitation_status text,
              delivery_status text, expires_at timestamptz, link_issued_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_active_member(target_property_id, 'administrator') then raise exception 'not_authorized'; end if;
  return query
  select distinct on (i.unit_id) i.unit_id, i.id, i.email_normalized, i.relationship,
         case when i.status = 'pending' and i.link_issued_at is not null and i.expires_at <= now() then 'expired' else i.status end,
         j.status, i.expires_at, i.link_issued_at
  from public.invitations i
  left join public.email_jobs j on j.invitation_id = i.id
  where i.property_id = target_property_id and i.unit_id is not null and i.roles = array['member']::text[]
  order by i.unit_id, i.created_at desc;
end;
$$;
revoke all on function public.get_unit_invitations(uuid) from public, anon;
grant execute on function public.get_unit_invitations(uuid) to authenticated;

-- La importación del censo crea las invitaciones de los principales.
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
    -- Una invitación por principal, retenida mientras el envío real esté apagado.
    perform private.enqueue_resident_invitation(target_property_id, r.unit_id, r.email_normalized,
                                                r.invitation_relationship, auth.uid())
    from public.census_records r
    where r.property_id = target_property_id and r.import_id = saved_import_id and r.invitation_primary;
  end if;
  return saved_import_id;
end;
$$;

revoke all on function public.import_census_with_primary(uuid,text,jsonb,jsonb,jsonb)
  from public, anon;
grant execute on function public.import_census_with_primary(uuid,text,jsonb,jsonb,jsonb)
  to authenticated;

commit;

select
  (select live = false from private.invitation_delivery) as modo_prueba_activo,
  exists (select 1 from pg_constraint where conname = 'email_jobs_status_check'
          and pg_get_constraintdef(oid) like '%held%') as estado_retenido,
  has_function_privilege('authenticated', 'public.queue_resident_invitation(uuid,uuid,text,text)', 'execute') as agregar_residente,
  has_function_privilege('authenticated', 'public.reveal_invitation_link(uuid,uuid)', 'execute') as ver_enlace,
  not has_function_privilege('authenticated', 'private.issue_invitation_token(uuid)', 'execute') as codigo_protegido;
