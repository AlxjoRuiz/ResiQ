begin;

-- A resident's receipt is evidence for review, never a posted payment.
create table public.finance_payment_evidence (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  unit_id uuid not null,
  receivable_id uuid not null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  bucket text not null default 'private-documents' check (bucket = 'private-documents'),
  object_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  created_at timestamptz not null default now(),
  foreign key (property_id,receivable_id,unit_id)
    references public.accounts_receivable(property_id,id,unit_id) on delete restrict,
  unique (receivable_id,uploaded_by)
);

create index finance_payment_evidence_account_idx
  on public.finance_payment_evidence(property_id,unit_id,created_at desc);

alter table public.finance_payment_evidence enable row level security;
create policy finance_payment_evidence_read on public.finance_payment_evidence
  for select to authenticated
  using (private.can_access_unit_finance(property_id,unit_id));

revoke all on public.finance_payment_evidence from public,anon,authenticated;
grant select on public.finance_payment_evidence to authenticated;

notify pgrst,'reload schema';
commit;
