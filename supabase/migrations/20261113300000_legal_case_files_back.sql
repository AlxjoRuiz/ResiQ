-- Expediente prejurídico de vuelta (13/11/2026, pedido de Alejandro). Estaba en pausa desde el 04/11
-- (20261104100000_legal_label_by_notice.sql quitó los disparadores; las tablas y funciones se conservaron).
-- * Se vuelven a crear los dos disparadores de 20261103100000: el requerimiento de pago enviado abre el expediente del
--   apartamento (si no había uno abierto) y queda anotado como gestión; cada respuesta del residente por correo queda
--   anotada en el expediente abierto.
-- * La etiqueta «En cobro jurídico» del admin no cambia: sigue saliendo por requerimiento enviado y mora.
-- Los requerimientos y respuestas de antes de hoy no se anotan hacia atrás.
begin;

drop trigger if exists legal_collection_notices_to_case on public.legal_collection_notices;
create trigger legal_collection_notices_to_case after insert on public.legal_collection_notices
for each row execute function private.legal_notice_to_case();

drop trigger if exists legal_notice_messages_to_case on public.legal_notice_messages;
create trigger legal_notice_messages_to_case after insert on public.legal_notice_messages
for each row execute function private.legal_reply_to_case();

commit;

-- Debe dar true.
select (select count(*) from pg_trigger where tgname in ('legal_collection_notices_to_case', 'legal_notice_messages_to_case')) = 2 as expediente_automatico;
