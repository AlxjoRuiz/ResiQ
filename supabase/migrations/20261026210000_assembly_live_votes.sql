-- Asambleas: votaciones en vivo (docs/29 entrega 3, decisión de Alejandro, 26/10/2026).
-- Administración abre una votación Sí / No / Abstención durante la asamblea en curso. Solo vota
-- quien marcó su asistencia, un voto por convocado y no se cambia. Mientras está abierta solo
-- Administración ve el avance; al cerrar, los convocados ven los totales. Nadie ve en la app quién
-- eligió cada opción: los votos no tienen lectura directa y los totales salen por RPC.
-- No calcula quórum, coeficientes ni mayorías (Ley 675 de 2001): validar con asesor legal.
begin;

create table public.assembly_votes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  assembly_id uuid not null,
  question text not null check (char_length(trim(question)) between 4 and 300),
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete restrict,
  unique(property_id,id),
  foreign key(property_id,assembly_id) references public.assemblies(property_id,id) on delete restrict,
  check ((status='closed')=(closed_at is not null))
);
create index assembly_votes_assembly_idx on public.assembly_votes(property_id,assembly_id,created_at);
-- Una sola votación abierta por asamblea.
create unique index assembly_votes_one_open_idx on public.assembly_votes(assembly_id) where status='open';

create table public.assembly_vote_ballots (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  assembly_id uuid not null,
  vote_id uuid not null,
  attendee_id uuid not null references public.assembly_attendees(id) on delete restrict,
  choice text not null check (choice in ('yes','no','abstain')),
  cast_at timestamptz not null default now(),
  unique(vote_id,attendee_id),
  foreign key(property_id,vote_id) references public.assembly_votes(property_id,id) on delete restrict,
  foreign key(property_id,assembly_id) references public.assemblies(property_id,id) on delete restrict
);

alter table public.assembly_votes enable row level security;
alter table public.assembly_vote_ballots enable row level security;
create policy assembly_votes_read on public.assembly_votes for select to authenticated using (private.can_read_assembly(assembly_id));
-- Sin políticas de lectura para los votos: solo se consultan con get_assembly_votes.
grant select on public.assembly_votes to authenticated;
revoke all on public.assembly_votes,public.assembly_vote_ballots from anon;
revoke insert,update,delete,truncate,references,trigger on public.assembly_votes from authenticated;
revoke all on public.assembly_vote_ballots from authenticated;

create or replace function public.open_assembly_vote(target_assembly_id uuid,target_question text)
returns uuid language plpgsql security definer set search_path='' as $$
declare item public.assemblies%rowtype; clean_question text:=trim(coalesce(target_question,'')); new_id uuid;
begin
  select * into item from public.assemblies where id=target_assembly_id for update;
  if not found or auth.uid() is null or not private.is_active_member(item.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if item.status<>'in_progress' then raise exception 'assembly_not_in_progress'; end if;
  if char_length(clean_question) not between 4 and 300 then raise exception 'invalid_question'; end if;
  if exists(select 1 from public.assembly_votes where assembly_id=item.id and status='open') then raise exception 'vote_already_open'; end if;
  insert into public.assembly_votes(property_id,assembly_id,question,created_by)
  values(item.property_id,item.id,clean_question,auth.uid()) returning id into new_id;
  perform private.write_property_audit(item.property_id,'assembly.vote_opened','assembly_vote',new_id,jsonb_build_object('assembly_id',item.id));
  return new_id;
end;
$$;

create or replace function public.close_assembly_vote(target_vote_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare vote public.assembly_votes%rowtype;
begin
  select * into vote from public.assembly_votes where id=target_vote_id for update;
  if not found or auth.uid() is null or not private.is_active_member(vote.property_id,'administrator') then raise exception 'not_authorized'; end if;
  if vote.status<>'open' then raise exception 'vote_closed'; end if;
  update public.assembly_votes set status='closed',closed_at=now(),closed_by=auth.uid() where id=vote.id;
  perform private.write_property_audit(vote.property_id,'assembly.vote_closed','assembly_vote',vote.id,
    jsonb_build_object('ballots',(select count(*) from public.assembly_vote_ballots where vote_id=vote.id)));
end;
$$;

create or replace function public.cast_assembly_vote(target_vote_id uuid,target_choice text)
returns void language plpgsql security definer set search_path='' as $$
declare vote public.assembly_votes%rowtype; voter_id uuid;
begin
  if target_choice not in ('yes','no','abstain') then raise exception 'invalid_choice'; end if;
  -- Bloqueo compartido: un cierre simultáneo espera a que el voto termine o viceversa.
  select * into vote from public.assembly_votes where id=target_vote_id for share;
  if not found then raise exception 'not_authorized'; end if;
  if vote.status<>'open' or not exists(select 1 from public.assemblies a where a.id=vote.assembly_id and a.status='in_progress') then raise exception 'vote_closed'; end if;
  select aa.id into voter_id
  from public.assembly_attendees aa
  join public.property_members pm on pm.property_id=aa.property_id and pm.id=aa.member_id
  join public.unit_memberships um on um.property_id=aa.property_id and um.member_id=aa.member_id and um.unit_id=aa.unit_id
  where aa.property_id=vote.property_id and aa.assembly_id=vote.assembly_id
    and pm.user_id=auth.uid() and pm.status='active' and 'member'=any(pm.roles)
    and um.valid_from<=now() and (um.valid_to is null or um.valid_to>now());
  if voter_id is null then raise exception 'not_invited_or_inactive'; end if;
  if not exists(select 1 from public.assembly_attendees where id=voter_id and attendance_status='present') then raise exception 'attendance_required'; end if;
  insert into public.assembly_vote_ballots(property_id,assembly_id,vote_id,attendee_id,choice)
  values(vote.property_id,vote.assembly_id,vote.id,voter_id,target_choice);
  -- La auditoría registra que votó, no qué eligió.
  perform private.write_property_audit(vote.property_id,'assembly.vote_cast','assembly_vote',vote.id,jsonb_build_object('attendee_id',voter_id));
exception when unique_violation then raise exception 'already_voted';
end;
$$;

-- Totales: Administración siempre; los convocados solo cuando la votación está cerrada.
create or replace function public.get_assembly_votes(target_assembly_id uuid)
returns table(vote_id uuid,question text,vote_status text,opened_at timestamptz,closed_at timestamptz,yes_count integer,no_count integer,abstain_count integer,ballot_count integer,own_choice text)
language sql stable security definer set search_path='' as $$
  with access as (
    select a.property_id,private.is_active_member(a.property_id,'administrator') as is_admin
    from public.assemblies a where a.id=target_assembly_id and private.can_read_assembly(a.id)
  ), mine as (
    select aa.id from public.assembly_attendees aa
    join public.property_members pm on pm.property_id=aa.property_id and pm.id=aa.member_id
    where aa.assembly_id=target_assembly_id and pm.user_id=auth.uid() and pm.status='active'
  )
  select v.id,v.question,v.status,v.created_at,v.closed_at,
    case when x.is_admin or v.status='closed' then c.yes_count end,
    case when x.is_admin or v.status='closed' then c.no_count end,
    case when x.is_admin or v.status='closed' then c.abstain_count end,
    case when x.is_admin or v.status='closed' then c.ballot_count end,
    (select b.choice from public.assembly_vote_ballots b where b.vote_id=v.id and b.attendee_id in (select id from mine) limit 1)
  from public.assembly_votes v
  cross join access x
  cross join lateral (
    select count(*) filter (where b.choice='yes')::integer as yes_count,
      count(*) filter (where b.choice='no')::integer as no_count,
      count(*) filter (where b.choice='abstain')::integer as abstain_count,
      count(*)::integer as ballot_count
    from public.assembly_vote_ballots b where b.vote_id=v.id
  ) c
  where v.assembly_id=target_assembly_id and v.property_id=x.property_id
  order by v.created_at;
$$;

-- Al finalizar o cancelar la asamblea se cierran las votaciones abiertas.
create or replace function private.close_assembly_votes_on_end()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.assembly_votes set status='closed',closed_at=now(),closed_by=auth.uid()
  where assembly_id=new.id and status='open';
  return new;
end;
$$;
create trigger assemblies_close_votes_on_end after update of status on public.assemblies
for each row when (new.status in ('finished','cancelled') and old.status is distinct from new.status)
execute function private.close_assembly_votes_on_end();

revoke all on function private.close_assembly_votes_on_end() from public,anon,authenticated;
revoke all on function public.open_assembly_vote(uuid,text),public.close_assembly_vote(uuid),public.cast_assembly_vote(uuid,text),public.get_assembly_votes(uuid) from public,anon;
grant execute on function public.open_assembly_vote(uuid,text),public.close_assembly_vote(uuid),public.cast_assembly_vote(uuid,text),public.get_assembly_votes(uuid) to authenticated;

commit;

select
  (select relrowsecurity from pg_class where oid='public.assembly_vote_ballots'::regclass) and not has_table_privilege('authenticated','public.assembly_vote_ballots','select') as votos_privados,
  has_function_privilege('authenticated','public.cast_assembly_vote(uuid,text)','execute') and not has_function_privilege('anon','public.cast_assembly_vote(uuid,text)','execute') as votar_disponible,
  exists(select 1 from pg_indexes where indexname='assembly_votes_one_open_idx') as una_abierta,
  exists(select 1 from pg_trigger where tgname='assemblies_close_votes_on_end') as cierre_al_finalizar;
