-- Pagos importados en Excel antes de guardar su origen (13/11/2026, pedido de Alejandro). Desde 20261113460000 cada pago
-- subido con «Importar pagos» queda con origin = 'excel'; los que se importaron antes salían como «Registrado a mano».
-- Se reconocen porque cada importación deja en la auditoría «payment.batch_imported» con la MISMA hora exacta que sus
-- pagos (todo ocurre en una misma operación). Solo se marcan esos pagos; los registrados a mano no se tocan.
begin;

update public.payments p set origin = 'excel'
where p.origin is null and p.credit_id is null
  and exists (select 1 from public.audit_logs a
              where a.property_id = p.property_id and a.action = 'payment.batch_imported' and a.occurred_at = p.created_at);

commit;

-- Cuántos pagos quedaron marcados como subidos en Excel.
select count(*) as pagos_de_excel from public.payments where origin = 'excel';
