# Invitaciones desde el censo: preparacion controlada

Alejandro aprobo preparar el envio de invitaciones al importar el Excel, con una sola persona principal elegida por apartamento. El envio debe permanecer desactivado hasta comprar y verificar el dominio, configurar Resend y probar la entrega con un caso controlado. Esta ampliacion funcional no cierra las etapas 19 ni 20.

## Decisiones y limites

- La vista previa permitira elegir a un residente principal por apartamento y confirmar si se invita como propietario o arrendatario. El texto original «Tipo de usuario» no se transforma automaticamente en un permiso. Los apartamentos sin nombre o correo verificable no pueden tener principal invitado.
- El mismo correo en dos apartamentos requiere resolucion manual: la funcion actual de invitaciones revoca enlaces pendientes anteriores del mismo correo dentro de la propiedad. El lote no debe enviar dos enlaces incompatibles.
- La importacion del censo conserva su comportamiento atomico e idempotente. La eleccion del principal se guarda junto a la fila; repetir el mismo archivo no cambia la eleccion silenciosamente.
- Guardar un principal **no** crea una cuenta, una invitacion, un trabajo de correo ni acceso a ResiQ. Tampoco interpreta el consentimiento del censo como permiso para enviar mensajes.
- Los enlaces de invitacion duran 72 horas. Se generaran solo cuando el dominio, remitente, URL publica, trabajador y prueba de entrega esten confirmados. Si el plan gratuito de Resend conserva un limite de 100 correos por dia, los lotes mayores necesitaran programacion escalonada sin crear enlaces que venzan antes del envio.

## Entrega 1: esquema sin envio

`20261021180000_census_primary_selection.sql` agrega los campos de principal y relacion, un indice unico por apartamento y una RPC que importa el censo y guarda la eleccion en una transaccion. La seleccion queda finalizada en el lote, incluso si no hay ningun destinatario elegible. No modifica la RPC antigua ni activa el correo. Despues de ejecutar la migracion completa en SQL Editor, `census_primary_catalog_readonly.sql` debe mostrar las siete columnas en `true`. Alejandro debe confirmar ese resultado antes de publicar una interfaz que llame a la nueva RPC.

En local pasaron las 20 pruebas de seguridad existentes y la revision de formato del diff. No hay instancia local de PostgreSQL para ejecutar la migracion; el SQL y la consulta de catalogo estan preparados, pero el resultado en Supabase sigue pendiente de Alejandro. La aplicacion desplegada mantiene la importacion anterior y no envia invitaciones.

## Pendiente para la entrega de envio

Faltan la interfaz de seleccion, una cola de invitaciones con comprobacion de vigencia y permisos justo antes del envio, la plantilla del enlace, deduplicacion, registro de errores y un interruptor de activacion que permanezca apagado hasta la prueba de correo. La importacion real del Excel y los correos a residentes estan pendientes de un caso controlado acordado con Alejandro. No usar el Excel real ni enviar a terceros en una prueba tecnica.
