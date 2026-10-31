-- Módulo jurídico (31/10/2026, pedido de Alejandro): conversación del requerimiento de pago.
-- * Cada correo de la abogada sale con una dirección de respuesta única (respuesta+código@dominio). Si el
--   residente responde desde su correo (Gmail u otro), Resend lo recibe y la app lo guarda aquí; la
--   abogada lo ve en «Respuestas» y contesta desde la app (le llega al residente por correo, con la misma
--   dirección de respuesta, así la conversación sigue).
-- * Solo se guarda el código cifrado (sha256); el código original va únicamente en el correo.
-- * Recibir respuestas lo hace solo el servidor (service_role) después de validar la firma de Resend.
begin;

create table public.legal_notice_reply_tokens (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.legal_collection_notices(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);
alter table public.legal_notice_reply_tokens enable row level security;
revoke all on public.legal_notice_reply_tokens from public, anon, authenticated;

create table public.legal_notice_messages (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.legal_collection_notices(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  author text not null check (author in ('resident', 'lawyer')),
  from_email text,
  body text not null check (char_length(body) between 1 and 20000),
  provider_message_id text unique,
  read_at timestamptz,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index legal_notice_messages_notice_idx on public.legal_notice_messages(notice_id, created_at);
alter table public.legal_notice_messages enable row level security;
revoke all on public.legal_notice_messages from public, anon, authenticated;

alter table public.email_jobs drop constraint email_jobs_template_key_check;
alter table public.email_jobs add constraint email_jobs_template_key_check check (template_key in ('pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled','reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired','receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice','attention_call_created','assembly_published','assembly_reminder','assembly_updated','assembly_cancelled','visit_requested','visit_rejected','resident_invitation','legal_collection_notice','legal_notice_reply'));

-- Código nuevo de respuesta para un requerimiento (se guarda cifrado; devuelve el original para el correo).
create or replace function private.legal_new_reply_token(target_notice_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text := encode(extensions.gen_random_bytes(18), 'hex');
begin
  insert into public.legal_notice_reply_tokens(notice_id, token_hash) values (target_notice_id, encode(extensions.digest(raw_token, 'sha256'), 'hex'));
  return raw_token;
end;
$$;
revoke all on function private.legal_new_reply_token(uuid) from public, anon, authenticated;

-- Abogada: envía el requerimiento de pago (igual que antes, ahora con el código de respuesta).
create or replace function public.legal_send_collection_notice(target_property_id uuid, target_unit_id uuid, target_receivable_ids uuid[],
  target_recipient_email text, target_subject text, target_message text)
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

-- Solo el servidor: guarda una respuesta recibida por correo. Devuelve false si el código no existe.
create or replace function public.legal_receive_reply(reply_token text, sender_email text, reply_body text, provider_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n public.legal_collection_notices%rowtype;
begin
  select ln.* into n from public.legal_notice_reply_tokens t join public.legal_collection_notices ln on ln.id = t.notice_id
  where t.token_hash = encode(extensions.digest(lower(trim(coalesce(reply_token, ''))), 'sha256'), 'hex');
  if not found or char_length(trim(coalesce(reply_body, ''))) = 0 then return false; end if;
  insert into public.legal_notice_messages(notice_id, property_id, author, from_email, body, provider_message_id)
  values (n.id, n.property_id, 'resident', lower(left(trim(coalesce(sender_email, '')), 254)), left(trim(reply_body), 20000), nullif(provider_id, ''))
  on conflict (provider_message_id) do nothing;
  return true;
end;
$$;

-- Abogada: conversaciones con respuestas, de sus conjuntos asignados.
create or replace function public.legal_list_threads()
returns table(notice_id uuid, property_id uuid, property_name text, unit_id uuid, unit_label text, recipient_email text, recipient_name text,
  subject text, last_message text, last_author text, last_at timestamptz, unread integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.legal_staff_id() is null then raise exception 'not_authorized'; end if;
  return query
  select n.id, n.property_id, p.name, n.unit_id, b.name || ' · ' || u.code, n.recipient_email, n.recipient_name, n.subject,
    last.body, last.author, last.created_at,
    (select count(*)::integer from public.legal_notice_messages m where m.notice_id = n.id and m.author = 'resident' and m.read_at is null)
  from public.legal_collection_notices n
  join public.properties p on p.id = n.property_id
  join public.units u on u.property_id = n.property_id and u.id = n.unit_id
  join public.buildings b on b.property_id = u.property_id and b.id = u.building_id
  join lateral (select m.body, m.author, m.created_at from public.legal_notice_messages m where m.notice_id = n.id order by m.created_at desc limit 1) last on true
  where private.legal_can_view(n.property_id)
    and exists(select 1 from public.legal_notice_messages m where m.notice_id = n.id and m.author = 'resident')
  order by last.created_at desc;
end;
$$;

-- Abogada: respuestas sin leer (para la barra izquierda).
create or replace function public.legal_unread_replies()
returns integer language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.legal_staff_id() is null then return 0; end if;
  return (select count(*)::integer from public.legal_notice_messages m where m.author = 'resident' and m.read_at is null and private.legal_can_view(m.property_id));
end;
$$;

-- Abogada: una conversación completa (el requerimiento y los mensajes). Marca como leídas las respuestas.
create or replace function public.legal_thread(target_notice_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n public.legal_collection_notices%rowtype; result jsonb;
begin
  select * into n from public.legal_collection_notices where id = target_notice_id;
  if auth.uid() is null or not found or not private.legal_can_view(n.property_id) then raise exception 'not_authorized'; end if;
  select jsonb_build_object(
    'notice', jsonb_build_object('id', n.id, 'property_id', n.property_id, 'unit_id', n.unit_id, 'subject', n.subject, 'message', n.message, 'items', n.items, 'total', n.total,
      'recipient_email', n.recipient_email, 'recipient_name', n.recipient_name, 'created_at', n.created_at),
    'property', (select p.name from public.properties p where p.id = n.property_id),
    'unit_label', (select b.name || ' · ' || u.code from public.units u join public.buildings b on b.property_id = u.property_id and b.id = u.building_id where u.id = n.unit_id),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'author', m.author, 'from_email', m.from_email, 'body', m.body, 'created_at', m.created_at,
        'delivery_status', (select j.status from public.email_jobs j where j.dedupe_key = 'legal_reply:' || m.id limit 1)) order by m.created_at)
      from public.legal_notice_messages m where m.notice_id = n.id), '[]'::jsonb)
  ) into result;
  update public.legal_notice_messages set read_at = now() where notice_id = n.id and author = 'resident' and read_at is null;
  return result;
end;
$$;

-- Abogada: contesta desde la app; al residente le llega por correo con una dirección de respuesta nueva.
create or replace function public.legal_post_message(target_notice_id uuid, message_body text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare n public.legal_collection_notices%rowtype; clean_body text := trim(coalesce(message_body, '')); message_id uuid; live_value boolean;
  signer text; property_label text; unit_label text;
begin
  select * into n from public.legal_collection_notices where id = target_notice_id;
  if auth.uid() is null or not found or private.legal_staff_id() is null or not private.legal_can_view(n.property_id) then raise exception 'not_authorized'; end if;
  if char_length(clean_body) not between 2 and 5000 then raise exception 'invalid_message'; end if;
  insert into public.legal_notice_messages(notice_id, property_id, author, body, created_by, read_at)
  values (n.id, n.property_id, 'lawyer', clean_body, auth.uid(), now()) returning id into message_id;
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

-- Requerimientos enviados de un apartamento: ahora también con cuántas respuestas tiene cada uno.
drop function public.legal_unit_notices(uuid, uuid);
create function public.legal_unit_notices(target_property_id uuid, target_unit_id uuid)
returns table(notice_id uuid, created_at timestamptz, recipient_email text, recipient_name text, subject text, total numeric, debt_count integer, delivery_status text, replies integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.legal_can_view(target_property_id) then raise exception 'not_authorized'; end if;
  return query
  select n.id, n.created_at, n.recipient_email, n.recipient_name, n.subject, n.total, jsonb_array_length(n.items),
    coalesce((select j.status from public.email_jobs j where j.dedupe_key = 'legal_notice:' || n.id limit 1), 'held'),
    (select count(*)::integer from public.legal_notice_messages m where m.notice_id = n.id and m.author = 'resident')
  from public.legal_collection_notices n
  where n.property_id = target_property_id and n.unit_id = target_unit_id
  order by n.created_at desc;
end;
$$;

revoke all on function public.legal_receive_reply(text, text, text, text), public.legal_list_threads(), public.legal_unread_replies(),
  public.legal_thread(uuid), public.legal_post_message(uuid, text), public.legal_unit_notices(uuid, uuid) from public, anon, authenticated;
grant execute on function public.legal_list_threads(), public.legal_unread_replies(), public.legal_thread(uuid), public.legal_post_message(uuid, text),
  public.legal_unit_notices(uuid, uuid) to authenticated;
grant execute on function public.legal_receive_reply(text, text, text, text) to service_role;
notify pgrst, 'reload schema';

commit;

-- Debe dar 3 veces true.
select
  exists(select 1 from information_schema.tables where table_schema = 'public' and table_name = 'legal_notice_messages') as conversaciones_creadas,
  not has_table_privilege('authenticated', 'public.legal_notice_messages', 'select')
    and not has_table_privilege('authenticated', 'public.legal_notice_reply_tokens', 'select') as conversaciones_protegidas,
  has_function_privilege('service_role', 'public.legal_receive_reply(text,text,text,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.legal_receive_reply(text,text,text,text)', 'execute') as solo_servidor_recibe;
