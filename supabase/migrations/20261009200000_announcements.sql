begin;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  author_member_id uuid not null,
  subject text not null check (char_length(trim(subject)) between 5 and 160),
  body text not null check (char_length(trim(body)) between 10 and 4000),
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,id),
  foreign key(property_id,author_member_id) references public.property_members(property_id,id) on delete restrict,
  check ((status='published')=(published_at is not null))
);
create index announcements_property_created_idx on public.announcements(property_id,created_at desc);
create trigger announcements_set_updated_at before update on public.announcements for each row execute function private.set_updated_at();

create table public.announcement_recipients (
  property_id uuid not null,
  announcement_id uuid not null,
  member_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(announcement_id,member_id),
  foreign key(property_id,announcement_id) references public.announcements(property_id,id) on delete restrict,
  foreign key(property_id,member_id) references public.property_members(property_id,id) on delete restrict
);
create index announcement_recipients_member_idx on public.announcement_recipients(property_id,member_id,announcement_id);

create or replace function private.can_read_announcement(target_announcement_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.announcements a
    join public.properties p on p.id=a.property_id and p.status='active'
    join public.property_members pm on pm.property_id=a.property_id and pm.user_id=auth.uid() and pm.status='active'
    where a.id=target_announcement_id and (
      'administrator'=any(pm.roles) or
      (a.status='published' and exists(
        select 1 from public.announcement_recipients ar
        where ar.property_id=a.property_id and ar.announcement_id=a.id and ar.member_id=pm.id
      ))
    )
  );
$$;
revoke all on function private.can_read_announcement(uuid) from public,anon;
grant execute on function private.can_read_announcement(uuid) to authenticated;

alter table public.announcements enable row level security;
alter table public.announcement_recipients enable row level security;
create policy announcements_read_authorized on public.announcements for select to authenticated
using(private.can_read_announcement(id));
create policy announcement_recipients_read_authorized on public.announcement_recipients for select to authenticated
using(
  private.is_active_member(property_id,'administrator') or
  (exists(select 1 from public.property_members pm join public.properties p on p.id=pm.property_id and p.status='active' where pm.id=member_id and pm.property_id=announcement_recipients.property_id and pm.user_id=auth.uid() and pm.status='active')
   and exists(select 1 from public.announcements a where a.id=announcement_id and a.property_id=announcement_recipients.property_id and a.status='published'))
);
grant select on public.announcements,public.announcement_recipients to authenticated;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'pqrs_created','pqrs_updated','package_received','visit_authorized','visit_entered','visit_exited','visit_cancelled',
  'reservation_created','reservation_approved','reservation_rejected','reservation_cancelled','reservation_expired',
  'receivable_created','receivable_voided','payment_recorded','payment_voided','delinquency_notice',
  'attention_call_created','assembly_published','assembly_updated','assembly_cancelled','visit_requested','visit_rejected',
  'announcement_published'
));
alter table public.notifications drop constraint notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check check (target_type in (
  'pqrs','package','visitor','reservation','receivable','payment','attention_call','assembly','announcement'
));

create or replace function private.validate_announcement_audience(target_property_id uuid,target_recipient_ids uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare supplied_count integer; unique_count integer; active_count integer;
begin
  select count(*),count(distinct member_id) into supplied_count,unique_count
  from unnest(target_recipient_ids) as selected(member_id);
  if supplied_count not between 1 and 100 or unique_count<>supplied_count then raise exception 'invalid_recipients'; end if;
  select count(*) into active_count from public.property_members pm
  where pm.property_id=target_property_id and pm.id=any(target_recipient_ids) and pm.status='active';
  if active_count<>supplied_count then raise exception 'invalid_recipients'; end if;
  return supplied_count;
end;
$$;
revoke all on function private.validate_announcement_audience(uuid,uuid[]) from public,anon,authenticated;

create or replace function public.save_announcement_draft(
  target_property_id uuid,target_announcement_id uuid,target_subject text,target_body text,target_recipient_ids uuid[]
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor_member_id uuid; announcement_id uuid; recipient_count integer;
begin
  select pm.id into actor_member_id from public.property_members pm
  join public.properties p on p.id=pm.property_id and p.status='active'
  where pm.property_id=target_property_id and pm.user_id=auth.uid() and pm.status='active' and 'administrator'=any(pm.roles);
  if actor_member_id is null then raise exception 'not_authorized'; end if;
  if char_length(trim(coalesce(target_subject,''))) not between 5 and 160 or
     char_length(trim(coalesce(target_body,''))) not between 10 and 4000 then raise exception 'invalid_input'; end if;
  recipient_count:=private.validate_announcement_audience(target_property_id,target_recipient_ids);
  if target_announcement_id is null then
    insert into public.announcements(property_id,author_member_id,subject,body)
    values(target_property_id,actor_member_id,trim(target_subject),trim(target_body)) returning id into announcement_id;
  else
    select id into announcement_id from public.announcements
    where id=target_announcement_id and property_id=target_property_id and status='draft' for update;
    if announcement_id is null then raise exception 'invalid_transition'; end if;
    update public.announcements set subject=trim(target_subject),body=trim(target_body) where id=announcement_id;
    delete from public.announcement_recipients where property_id=target_property_id and announcement_id=target_announcement_id;
  end if;
  insert into public.announcement_recipients(property_id,announcement_id,member_id)
  select target_property_id,announcement_id,member_id from unnest(target_recipient_ids) as selected(member_id);
  perform private.write_property_audit(target_property_id,'announcement.draft_saved','announcement',announcement_id,jsonb_build_object('recipient_count',recipient_count));
  return announcement_id;
end;
$$;

create or replace function public.publish_announcement(target_announcement_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare a public.announcements%rowtype; recipient_count integer; active_count integer;
begin
  select * into a from public.announcements where id=target_announcement_id for update;
  if not found then raise exception 'not_found'; end if;
  if not private.is_active_member(a.property_id,'administrator') or
     not exists(select 1 from public.properties where id=a.property_id and status='active') then raise exception 'not_authorized'; end if;
  if a.status='published' then return; end if;
  if a.status<>'draft' then raise exception 'invalid_transition'; end if;
  select count(*),count(pm.id) into recipient_count,active_count
  from public.announcement_recipients ar
  left join public.property_members pm on pm.id=ar.member_id and pm.property_id=ar.property_id and pm.status='active'
  where ar.property_id=a.property_id and ar.announcement_id=a.id;
  if recipient_count=0 or active_count<>recipient_count then raise exception 'invalid_recipients'; end if;
  update public.announcements set status='published',published_at=now() where id=a.id;
  insert into public.notifications(property_id,recipient_member_id,type,subject,body,target_type,target_id,dedupe_key)
  select a.property_id,ar.member_id,'announcement_published',a.subject,a.body,'announcement',a.id,'announcement:'||a.id
  from public.announcement_recipients ar where ar.property_id=a.property_id and ar.announcement_id=a.id
  on conflict(property_id,recipient_member_id,dedupe_key) do nothing;
  perform private.write_property_audit(a.property_id,'announcement.published','announcement',a.id,jsonb_build_object('recipient_count',recipient_count));
end;
$$;

revoke all on function public.save_announcement_draft(uuid,uuid,text,text,uuid[]),public.publish_announcement(uuid) from public,anon;
grant execute on function public.save_announcement_draft(uuid,uuid,text,text,uuid[]),public.publish_announcement(uuid) to authenticated;

commit;
