-- Las tablas financieras solo se modifican mediante RPC auditadas.

revoke all on table public.accounts_receivable, public.payments, public.payment_allocations from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.accounts_receivable, public.payments, public.payment_allocations
  from authenticated;

grant select on table public.accounts_receivable, public.payments, public.payment_allocations to authenticated;

notify pgrst, 'reload schema';
