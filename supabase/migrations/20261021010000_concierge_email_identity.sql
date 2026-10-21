-- Sustituye la identidad telefonica no utilizada por un correo real.
-- La tabla aun no tiene cuentas: aborta si alguien creo una antes de este ajuste.
begin;

lock table public.concierge_accounts in access exclusive mode;

do $$
begin
  if exists (select 1 from public.concierge_accounts) then
    raise exception 'concierge_accounts_not_empty_review_before_migration';
  end if;
end;
$$;

alter table public.concierge_accounts
  add column email_normalized text not null unique
    check (email_normalized = lower(trim(email_normalized))
      and email_normalized ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  drop constraint concierge_accounts_phone_e164_key,
  drop column activation_token_hash,
  drop column activation_expires_at,
  drop column activation_consumed_at;

comment on column public.concierge_accounts.email_normalized is
  'Correo real usado solo como identidad interna de Supabase Auth; el portero entra con username.';
comment on column public.concierge_accounts.phone_e164 is
  'Telefono de contacto; no se utiliza para autenticacion.';

commit;
