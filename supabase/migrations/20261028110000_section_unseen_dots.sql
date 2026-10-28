-- Punto en la barra lateral (28/10/2026): una sección muestra un punto cuando la cuenta tiene una
-- notificación sin leer de esa sección que llegó después de la última vez que la abrió. Al abrir la
-- sección se guarda la hora y el punto desaparece. No cambia si la notificación está leída o no.
begin;

create table public.section_views (
  property_id uuid not null references public.properties(id) on delete restrict,
  member_id uuid not null,
  section text not null check (section in ('cartera','pqrs','paquetes','visitas','reservas','llamados','asambleas','comunicados','notificaciones')),
  seen_at timestamptz not null default now(),
  primary key (member_id, section),
  foreign key (property_id, member_id) references public.property_members(property_id, id) on delete restrict
);
alter table public.section_views enable row level security;
revoke all on public.section_views from public, anon, authenticated;

-- Sección de la barra lateral a la que pertenece cada tipo de notificación.
create or replace function private.notification_section(target_type text)
returns text language sql immutable set search_path = '' as $$
  select case target_type
    when 'receivable' then 'cartera' when 'payment' then 'cartera' when 'pqrs' then 'pqrs'
    when 'package' then 'paquetes' when 'visitor' then 'visitas' when 'reservation' then 'reservas'
    when 'attention_call' then 'llamados' when 'assembly' then 'asambleas' when 'announcement' then 'comunicados' end;
$$;
revoke all on function private.notification_section(text) from public, anon, authenticated;

create or replace function public.get_unseen_sections(target_property_id uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  with me as (
    select pm.id from public.property_members pm
    where pm.property_id = target_property_id and pm.user_id = auth.uid() and pm.status = 'active'
  ), pending as (
    select private.notification_section(n.target_type) as section, n.created_at from public.notifications n
    where n.property_id = target_property_id and n.recipient_member_id = (select id from me) and n.read_at is null
    union all
    select 'notificaciones', n.created_at from public.notifications n
    where n.property_id = target_property_id and n.recipient_member_id = (select id from me) and n.read_at is null
  )
  select coalesce(array_agg(distinct p.section), '{}') from pending p
  left join public.section_views v on v.member_id = (select id from me) and v.section = p.section
  where p.section is not null and (v.seen_at is null or p.created_at > v.seen_at);
$$;

create or replace function public.mark_section_seen(target_property_id uuid, target_section text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid;
begin
  select pm.id into me from public.property_members pm
  where pm.property_id = target_property_id and pm.user_id = auth.uid() and pm.status = 'active';
  if me is null then raise exception 'not_authorized'; end if;
  if target_section not in ('cartera','pqrs','paquetes','visitas','reservas','llamados','asambleas','comunicados','notificaciones') then return; end if;
  insert into public.section_views(property_id, member_id, section, seen_at) values (target_property_id, me, target_section, now())
  on conflict (member_id, section) do update set seen_at = excluded.seen_at;
end;
$$;

revoke all on function public.get_unseen_sections(uuid), public.mark_section_seen(uuid, text) from public, anon;
grant execute on function public.get_unseen_sections(uuid), public.mark_section_seen(uuid, text) to authenticated;

commit;

select
  has_function_privilege('authenticated', 'public.get_unseen_sections(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.get_unseen_sections(uuid)', 'execute') as puntos_disponibles,
  has_function_privilege('authenticated', 'public.mark_section_seen(uuid,text)', 'execute') as marcar_vista_disponible;
