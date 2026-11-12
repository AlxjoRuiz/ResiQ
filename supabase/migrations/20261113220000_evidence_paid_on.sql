-- Fecha exacta del pago en el comprobante (13/11/2026, pedido de Alejandro). El residente ya no elige solo el mes:
-- elige el día en que pagó. Esa fecha llena «Fecha del pago» cuando la administración acepta el comprobante, y así
-- la abogada y el informe jurídico ven el pago con la fecha que puso el residente.
-- paid_period (el mes) se sigue guardando igual (primer día del mes de esa fecha) para lo que ya lo usa.
begin;

alter table public.finance_payment_evidence add column if not exists paid_on date;

commit;

-- Debe dar true.
select exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'finance_payment_evidence' and column_name = 'paid_on') as fecha_del_pago_en_comprobantes;
