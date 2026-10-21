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

Alejandro informó después que la ejecución completa devolvió `CENSUS_PRIMARY_SCHEMA_OK` y confirmó las siete columnas `true` de `census_primary_catalog_readonly.sql`. No se ha hecho una importación real ni una prueba funcional en producción.

## Entrega 2: seleccion visible, todavia sin envio

La vista previa agrupa respuestas por apartamento y exige elegir una fila principal con nombre y correo de la columna G. La relacion de acceso (propietario/arrendatario) se elige aparte; no cambia el correo destinatario. El servidor relee el Excel, valida la seleccion y rechaza el mismo correo como principal de dos apartamentos. La ficha identifica el principal guardado. Las unidades sin nombre o correo elegibles se conservan sin principal. No se generan invitaciones ni correos.

La interfaz depende de la migracion anterior; Alejandro confirmo las siete columnas `true` antes de publicarla. La importacion funcional queda pendiente de un caso de prueba controlado aprobado por Alejandro.

Verificación local de esta entrega: TypeScript y compilación aprobaron; siete pruebas del censo y 20 de seguridad aprobaron; ESLint terminó sin errores, con seis advertencias preexistentes en otros módulos. No hubo prueba de importación contra Supabase ni verificación visual en Vercel.

Codigo de interfaz: commit `535676b`, subido a `main` junto con la documentacion hasta `ed2a2f9`. El estado de GitHub para `ed2a2f9` reporto Vercel `success` y «Deployment has completed». Esto confirma despliegue, no que Alejandro haya importado o revisado la pantalla en produccion.

## Pendiente para la entrega de envio

Por solicitud de Alejandro, la pantalla de Propiedad ya no muestra la antigua sección manual «Invitaciones de residentes» ni su acceso de navegación. Se retiraron también sus consultas de torres y apartamentos de esa página. No se borraron invitaciones históricas ni se activó el envío desde el censo; el flujo subyacente permanece para una futura activación controlada.
Esta entrega pasó `npm run typecheck`, `npm run build` y las 20 pruebas de seguridad. ESLint terminó sin errores y con seis advertencias preexistentes fuera de esta página. La revisión visual en Vercel y la prueba de asistencia en Asambleas quedan pendientes de confirmación de Alejandro.
Código subido en `ce4c323`; GitHub informó `Vercel: success` y «Deployment has completed» para ese commit. Esto confirma el despliegue, no la revisión visual de Alejandro.

Faltan la interfaz de seleccion, una cola de invitaciones con comprobacion de vigencia y permisos justo antes del envio, la plantilla del enlace, deduplicacion, registro de errores y un interruptor de activacion que permanezca apagado hasta la prueba de correo. La importacion real del Excel y los correos a residentes estan pendientes de un caso controlado acordado con Alejandro. No usar el Excel real ni enviar a terceros en una prueba tecnica.
