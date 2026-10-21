-- Base aislada para cuentas de Porteria con usuario permanente.
-- No cambia el login existente ni crea cuentas por si sola.
begin;

alter table public.property_members
  add constraint property_members_property_user_member_key unique (property_id, user_id, id);

create table public.concierge_accounts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  member_id uuid not null unique,
  username text not null unique check (username ~ '^[a-z0-9]+$'),
  full_name text not null check (char_length(full_name) between 2 and 120),
  document_number text not null check (document_number ~ '^[0-9]{5,20}$'),
  birth_date date not null check (birth_date >= date '1900-01-01'),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  address text check (address is null or char_length(address) between 1 and 180),
  photo_path text,
  vehicles jsonb not null default '[]'::jsonb check (jsonb_typeof(vehicles) = 'array'),
  status text not null default 'pending' check (status in ('pending','active','suspended','removed')),
  activation_token_hash text unique check (activation_token_hash is null or activation_token_hash ~ '^[0-9a-f]{64}$'),
  activation_expires_at timestamptz,
  activation_consumed_at timestamptz,
  removed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, id),
  foreign key (property_id, user_id, member_id) references public.property_members(property_id, user_id, id) on delete restrict,
  check ((status = 'removed') = (removed_at is not null)),
  check ((activation_token_hash is null) = (activation_expires_at is null)),
  check (status <> 'active' or activation_consumed_at is not null)
);

create index concierge_accounts_property_status_idx on public.concierge_accounts(property_id, status);

create function private.keep_concierge_username()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.username <> old.username then raise exception 'concierge_username_immutable'; end if;
  return new;
end;
$$;
revoke all on function private.keep_concierge_username() from public, anon, authenticated;
create trigger concierge_username_immutable before update on public.concierge_accounts
  for each row execute function private.keep_concierge_username();

alter table public.concierge_accounts enable row level security;
revoke all on public.concierge_accounts from public, anon, authenticated;
grant select on public.concierge_accounts to authenticated;
create policy concierge_accounts_admin_read on public.concierge_accounts
  for select to authenticated
  using (private.is_active_member(property_id, 'administrator'));

commit;
