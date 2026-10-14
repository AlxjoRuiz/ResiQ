-- Run after 20261013233000_finance_payment_evidence.sql.
-- All columns should be true. Read-only; no test records are created.
select
  to_regclass('public.finance_payment_evidence') is not null as table_ready,
  coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.finance_payment_evidence')),false) as rls_enabled,
  coalesce(has_table_privilege('authenticated','public.finance_payment_evidence','SELECT'),false) as authenticated_can_read,
  not coalesce(has_table_privilege('authenticated','public.finance_payment_evidence','INSERT'),false) as browser_cannot_insert,
  not coalesce(has_table_privilege('authenticated','public.finance_payment_evidence','UPDATE'),false) as browser_cannot_update,
  not coalesce(has_table_privilege('anon','public.finance_payment_evidence','SELECT'),false) as anonymous_cannot_read,
  exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='finance_payment_evidence'
      and policyname='finance_payment_evidence_read'
      and cmd='SELECT'
  ) as read_policy_ready;
