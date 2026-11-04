-- Comprobantes de cuotas del acuerdo (04/11/2026, pedido de Alejandro): el residente elige una o varias
-- deudas que paga con la cuota. Cada deuda se llena hasta su saldo en el orden elegido y la última recibe lo
-- que queda (abono). Ese reparto se guarda con el comprobante para que el admin lo encuentre ya llenado en
-- «Registrar pago»; el admin lo revisa antes de registrar. Formato: [{"receivable_id": uuid, "amount": número}].
begin;

alter table public.finance_payment_evidence add column planned_allocations jsonb
  check (planned_allocations is null or (jsonb_typeof(planned_allocations) = 'array' and jsonb_array_length(planned_allocations) between 1 and 50));

notify pgrst, 'reload schema';
commit;

-- Debe dar true.
select exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'finance_payment_evidence' and column_name = 'planned_allocations') as reparto_de_cuotas;
