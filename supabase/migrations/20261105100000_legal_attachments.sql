-- Módulo jurídico (05/11/2026, pedido de Alejandro): archivos adjuntos en el requerimiento y en la conversación.
-- * La abogada adjunta archivos (PDF, JPG o PNG) al requerimiento de pago y a sus respuestas; van en el correo.
-- * Si el residente responde desde su correo con archivos, llegan a la conversación (los guarda el servidor).
-- * Los archivos se guardan en Storage (private-documents/<conjunto>/legal/...). La abogada los abre con un
--   enlace temporal, solo de conjuntos asignados, y cada apertura queda en auditoría.
begin;

create table public.legal_notice_attachments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.legal_collection_notices(id) on delete restrict,
  message_id uuid references public.legal_notice_messages(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  author text not null check (author in ('lawyer', 'resident')),
  object_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  provider_attachment_id text unique,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index legal_notice_attachments_notice_idx on public.legal_notice_attachments(notice_id, message_id, created_at);
alter table public.legal_notice_attachments enable row level security;
revoke all on public.legal_notice_attachments from public, anon, authenticated;

-- Guarda los adjuntos de un mensaje de la abogada. Cada archivo debe estar ya subido en la carpeta del conjunto.
create or replace function private.legal_insert_attachments(target_notice_id uuid, target_message_id uuid, target_property_id uuid,
  target_author text, items jsonb, actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare item jsonb;
begin
  if items is null or jsonb_typeof(items) <> 'array' then return; end if;
  if jsonb_array_length(items) > 5 then raise exception 'too_many_attachments'; end if;
  for item in select * from jsonb_array_elements(items) loop
    if coalesce(item ->> 'path', '') not like target_property_id::text || '/legal/%' or (item ->> 'path') like '%..%' then raise exception 'invalid_attachment'; end if;
    insert into public.legal_notice_attachments(notice_id, message_id, property_id, author, object_path, original_name, mime_type, size_bytes, created_by)
    values (target_notice_id, target_message_id, target_property_id, target_author, item ->> 'path', left(coalesce(nullif(trim(item ->> 'name'), ''), 'archivo'), 180),
      item ->> 'type', (item ->> 'size')::bigint, actor);
  end loop;
end;
$$;
revoke all on function private.legal_insert_attachments(uuid, uuid, uuid, text, jsonb, uuid) from public, anon, authenticated;

-- Adjuntos de un mensaje (o del requerimiento, si message es null) para mostrar en la conversación.
create or replace function private.legal_attachment_list(target_notice_id uuid, target_message_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.original_name, 'type', a.mime_type, 'size', a.size_bytes) order by a.created_at), '[]'::jsonb)
  from public.legal_notice_attachments a
  where a.notice_id = target_notice_id and a.message_id is not distinct from target_message_id;
$$;
revoke all on function private.legal_attachment_list(uuid, uuid) from public, anon, authenticated;

-- Las funciones de enviar cambian de firma (agregan los adjuntos): se quita la versión anterior.
drop function public.legal_send_collection_notice(uuid, uuid, uuid[], text, text, text);
drop function public.legal_post_message(uuid, text);
drop function public.legal_receive_reply(text, text, text, text);

create or replace function public.legal_send_collection_notice(target_property_id uuid, target_unit_id uuid, target_receivable_ids uuid[],
  target_recipient_email text, target_subject text, target_message text, target_attachments jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.legal_staff_id(); recipient text := lower(trim(coalesce(target_recipient_email, '')));
  clean_subject text := trim(coalesce(target_subject, '')); clean_message text := trim(coalesce(target_message, ''));
  recipient_label text; item_list jsonb; total_value numeric; notice_id uuid; live_value boolean;
  signer text; signer_email text; property_label text; unit_label text;
begin
  if auth.uid() is null or me is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.units where property_id = target_property_id and id = target_unit_id) then raise exception 'unit_not_found'; end if;
  if char_length(clean_subject) not between 3 and 150 or char_length(clean_message) not between 10 and 5000 then raise exception 'invalid_message'; end if;
  if coalesce(cardinality(target_receivable_ids), 0) = 0 or cardinality(target_receivable_ids) > 200 then raise exception 'no_debts_selected'; end if;
  select r.name into recipient_label from private.legal_unit_recipients(target_property_id, target_unit_id) r where r.email = recipient;
  if not found then raise exception 'recipient_not_allowed'; end if;

  select jsonb_agg(jsonb_build_object('receivable_id', d.id, 'concept', d.concept, 'due_on', d.due_on, 'outstanding', d.owed) order by d.due_on, d.concept), sum(d.owed)
  into item_list, total_value
  from (select ar.id, ar.concept, ar.due_on, private.receivable_outstanding(ar.id) as owed from public.accounts_receivable ar
        where ar.property_id = target_property_id and ar.unit_id = target_unit_id and ar.status = 'active' and ar.id = any(target_receivable_ids)) d
  where d.owed > 0;
  if item_list is null or jsonb_array_length(item_list) <> (select count(distinct x) from unnest(target_receivable_ids) x) then raise exception 'invalid_debts'; end if;

  select coalesce(p.display_name, 'Abogada de cobros'), lower(u.email::text) into signer, signer_email from public.profiles p join auth.users u on u.id = p.id where p.id = auth.uid();
  select p.name into property_label from public.properties p where p.id = target_property_id;
  select b.name || ' · ' || u.code into unit_label from public.units u join public.buildings b on b.property_id = u.property_id and b.id = u.building_id where u.id = target_unit_id;

  insert into public.legal_collection_notices(property_id, unit_id, staff_id, sent_by, recipient_email, recipient_name, subject, message, items, total)
  values (target_property_id, target_unit_id, me, auth.uid(), recipient, recipient_label, clean_subject, clean_message, item_list, total_value)
  returning id into notice_id;
  -- Archivos que adjuntó la abogada (05/11/2026); viajan en el correo del requerimiento.
  perform private.legal_insert_attachments(notice_id, null, target_property_id, 'lawyer', target_attachments, auth.uid());

  select live into live_value from private.invitation_delivery;
  insert into public.email_jobs(property_id, legal_notice_id, recipient_email, template_key, template_data, dedupe_key, status)
  values (target_property_id, notice_id, recipient, 'legal_collection_notice',
    jsonb_build_object('subject', clean_subject, 'message', clean_message, 'items', item_list, 'total', total_value, 'currency', 'COP',
      'signer_name', signer, 'property_name', property_label, 'unit_label', unit_label, 'recipient_name', recipient_label,
      'reply_token', private.legal_new_reply_token(notice_id)),
    'legal_notice:' || notice_id, case when coalesce(live_value, false) then 'queued' else 'held' end);

  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (target_property_id, auth.uid(), 'property', 'legal.collection_notice_sent', 'unit', target_unit_id,
    jsonb_build_object('notice_id', notice_id, 'debts', jsonb_array_length(item_list), 'total', total_value));
  return notice_id;
end;
$$;

create or replace function public.legal_post_message(target_notice_id uuid, message_body text, target_attachments jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare n public.legal_collection_notices%rowtype; clean_body text := trim(coalesce(message_body, '')); message_id uuid; live_value boolean;
  signer text; property_label text; unit_label text;
begin
  select * into n from public.legal_collection_notices where id = target_notice_id;
  if auth.uid() is null or not found or private.legal_staff_id() is null or not private.legal_can_view(n.property_id) then raise exception 'not_authorized'; end if;
  if char_length(clean_body) not between 2 and 5000 then raise exception 'invalid_message'; end if;
  insert into public.legal_notice_messages(notice_id, property_id, author, body, created_by, read_at)
  values (n.id, n.property_id, 'lawyer', clean_body, auth.uid(), now()) returning id into message_id;
  -- Archivos que adjuntó la abogada (05/11/2026); viajan en el correo de su respuesta.
  perform private.legal_insert_attachments(n.id, message_id, n.property_id, 'lawyer', target_attachments, auth.uid());
  select coalesce(p.display_name, 'Abogada de cobros') into signer from public.profiles p where p.id = auth.uid();
  select p.name into property_label from public.properties p where p.id = n.property_id;
  select b.name || ' · ' || u.code into unit_label from public.units u join public.buildings b on b.property_id = u.property_id and b.id = u.building_id where u.id = n.unit_id;
  select live into live_value from private.invitation_delivery;
  insert into public.email_jobs(property_id, legal_notice_id, recipient_email, template_key, template_data, dedupe_key, status)
  values (n.property_id, n.id, n.recipient_email, 'legal_notice_reply',
    jsonb_build_object('subject', 'Re: ' || n.subject, 'message', clean_body, 'signer_name', signer, 'property_name', property_label, 'unit_label', unit_label,
      'reply_token', private.legal_new_reply_token(n.id)),
    'legal_reply:' || message_id, case when coalesce(live_value, false) then 'queued' else 'held' end);
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (n.property_id, auth.uid(), 'property', 'legal.collection_reply_sent', 'unit', n.unit_id, jsonb_build_object('notice_id', n.id, 'message_id', message_id));
  return message_id;
end;
$$;

-- Solo el servidor: guarda una respuesta recibida por correo. Devuelve el mensaje creado (null si el código no existe).
create or replace function public.legal_receive_reply(reply_token text, sender_email text, reply_body text, provider_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare n public.legal_collection_notices%rowtype; created uuid;
begin
  select ln.* into n from public.legal_notice_reply_tokens t join public.legal_collection_notices ln on ln.id = t.notice_id
  where t.token_hash = encode(extensions.digest(lower(trim(coalesce(reply_token, ''))), 'sha256'), 'hex');
  if not found or char_length(trim(coalesce(reply_body, ''))) = 0 then return null; end if;
  insert into public.legal_notice_messages(notice_id, property_id, author, from_email, body, provider_message_id)
  values (n.id, n.property_id, 'resident', lower(left(trim(coalesce(sender_email, '')), 254)), left(trim(reply_body), 20000), nullif(provider_id, ''))
  on conflict (provider_message_id) do nothing returning id into created;
  return created;
end;
$$;

-- Solo el servidor: guarda un archivo que el residente adjuntó en su respuesta por correo.
create or replace function public.legal_add_inbound_attachment(target_message_id uuid, target_path text, target_name text, target_type text, target_size bigint, target_provider_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.legal_notice_messages%rowtype;
begin
  select * into m from public.legal_notice_messages where id = target_message_id and author = 'resident';
  if not found then raise exception 'message_not_found'; end if;
  if coalesce(target_path, '') not like m.property_id::text || '/legal/%' then raise exception 'invalid_attachment'; end if;
  insert into public.legal_notice_attachments(notice_id, message_id, property_id, author, object_path, original_name, mime_type, size_bytes, provider_attachment_id)
  values (m.notice_id, m.id, m.property_id, 'resident', target_path, left(coalesce(nullif(trim(target_name), ''), 'archivo'), 180), target_type, target_size, nullif(target_provider_id, ''))
  on conflict (provider_attachment_id) do nothing;
end;
$$;

create or replace function public.legal_thread(target_notice_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n public.legal_collection_notices%rowtype; result jsonb;
begin
  select * into n from public.legal_collection_notices where id = target_notice_id;
  if auth.uid() is null or not found or not private.legal_can_view(n.property_id) then raise exception 'not_authorized'; end if;
  select jsonb_build_object(
    'notice', jsonb_build_object('id', n.id, 'property_id', n.property_id, 'unit_id', n.unit_id, 'subject', n.subject, 'message', n.message, 'items', n.items, 'total', n.total,
      'recipient_email', n.recipient_email, 'recipient_name', n.recipient_name, 'created_at', n.created_at,
      'attachments', private.legal_attachment_list(n.id, null)),
    'property', (select p.name from public.properties p where p.id = n.property_id),
    'unit_label', (select b.name || ' · ' || u.code from public.units u join public.buildings b on b.property_id = u.property_id and b.id = u.building_id where u.id = n.unit_id),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'author', m.author, 'from_email', m.from_email, 'body', m.body, 'created_at', m.created_at,
        'delivery_status', (select j.status from public.email_jobs j where j.dedupe_key = 'legal_reply:' || m.id limit 1),
        'attachments', private.legal_attachment_list(n.id, m.id)) order by m.created_at)
      from public.legal_notice_messages m where m.notice_id = n.id), '[]'::jsonb)
  ) into result;
  update public.legal_notice_messages set read_at = now() where notice_id = n.id and author = 'resident' and read_at is null;
  return result;
end;
$$;

-- Abogada: archivo de un adjunto de un conjunto asignado (el servidor lo abre con un enlace temporal). Queda en auditoría.
create or replace function public.legal_attachment_file(target_attachment_id uuid)
returns table(object_path text, original_name text) language plpgsql security definer set search_path = '' as $$
declare a public.legal_notice_attachments%rowtype;
begin
  select * into a from public.legal_notice_attachments where id = target_attachment_id;
  if auth.uid() is null or not found or private.legal_staff_id() is null or not private.legal_can_view(a.property_id) then raise exception 'not_authorized'; end if;
  insert into public.audit_logs(property_id, actor_id, scope, action, entity_type, entity_id, metadata)
  values (a.property_id, auth.uid(), 'property', 'legal.attachment_viewed', 'legal_attachment', a.id, jsonb_build_object('notice_id', a.notice_id));
  return query select a.object_path, a.original_name;
end;
$$;

-- Solo el trabajador de correos: adjuntos de la abogada que van en un correo (requerimiento o respuesta).
create or replace function public.legal_job_attachments(target_job_id uuid)
returns table(object_path text, original_name text, mime_type text) language sql stable security definer set search_path = '' as $$
  select a.object_path, a.original_name, a.mime_type
  from public.email_jobs j
  join public.legal_notice_attachments a on a.notice_id = j.legal_notice_id and a.author = 'lawyer'
  where j.id = target_job_id and (
    (j.template_key = 'legal_collection_notice' and a.message_id is null)
    or (j.template_key = 'legal_notice_reply' and a.message_id::text = substring(j.dedupe_key from 'legal_reply:(.*)$')))
  order by a.created_at;
$$;

revoke all on function public.legal_send_collection_notice(uuid, uuid, uuid[], text, text, text, jsonb), public.legal_post_message(uuid, text, jsonb),
  public.legal_receive_reply(text, text, text, text), public.legal_add_inbound_attachment(uuid, text, text, text, bigint, text),
  public.legal_attachment_file(uuid), public.legal_job_attachments(uuid) from public, anon, authenticated;
grant execute on function public.legal_send_collection_notice(uuid, uuid, uuid[], text, text, text, jsonb), public.legal_post_message(uuid, text, jsonb),
  public.legal_attachment_file(uuid) to authenticated;
grant execute on function public.legal_receive_reply(text, text, text, text), public.legal_add_inbound_attachment(uuid, text, text, text, bigint, text),
  public.legal_job_attachments(uuid) to service_role;
notify pgrst, 'reload schema';

commit;

-- Debe dar true.
select exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'legal_notice_attachments')
  and not has_table_privilege('authenticated', 'public.legal_notice_attachments', 'select')
  and has_function_privilege('authenticated', 'public.legal_attachment_file(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.legal_add_inbound_attachment(uuid,text,text,text,bigint,text)', 'execute') as adjuntos_juridica;
