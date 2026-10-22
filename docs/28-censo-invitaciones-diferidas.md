# Invitaciones desde el censo: preparacion controlada

Alejandro aprobo preparar el envio de invitaciones al importar el Excel, con una sola persona principal elegida por apartamento. El envio debe permanecer desactivado hasta comprar y verificar el dominio, configurar Resend y probar la entrega con un caso controlado. Esta ampliacion funcional no cierra las etapas 19 ni 20.

## Decisiones y limites

- La vista previa elige automáticamente al principal cuando hay una sola respuesta válida por apartamento; si hay varias, Administración lo selecciona. Por decisión posterior de Alejandro, «Tipo de usuario» del Excel determina la relación futura: Propietario/a → propietario; Residente o Arrendatario/a → residente. Un valor distinto bloquea esa selección hasta corregir el archivo. Los apartamentos sin nombre o correo verificable no pueden tener principal invitado.
- El mismo correo en dos apartamentos requiere resolucion manual: la funcion actual de invitaciones revoca enlaces pendientes anteriores del mismo correo dentro de la propiedad. El lote no debe enviar dos enlaces incompatibles.
- La importacion del censo conserva su comportamiento atomico e idempotente. La eleccion del principal se guarda junto a la fila; repetir el mismo archivo no cambia la eleccion silenciosamente.
- Guardar un principal **no** crea una cuenta, una invitacion, un trabajo de correo ni acceso a ResiQ. Tampoco interpreta el consentimiento del censo como permiso para enviar mensajes.
- Los enlaces de invitacion duran 72 horas. Se generaran solo cuando el dominio, remitente, URL publica, trabajador y prueba de entrega esten confirmados. Si el plan gratuito de Resend conserva un limite de 100 correos por dia, los lotes mayores necesitaran programacion escalonada sin crear enlaces que venzan antes del envio.

## Entrega 1: esquema sin envio

`20261021180000_census_primary_selection.sql` agrega los campos de principal y relacion, un indice unico por apartamento y una RPC que importa el censo y guarda la eleccion en una transaccion. La seleccion queda finalizada en el lote, incluso si no hay ningun destinatario elegible. No modifica la RPC antigua ni activa el correo. Despues de ejecutar la migracion completa en SQL Editor, `census_primary_catalog_readonly.sql` debe mostrar las siete columnas en `true`. Alejandro debe confirmar ese resultado antes de publicar una interfaz que llame a la nueva RPC.

En local pasaron las 20 pruebas de seguridad existentes y la revision de formato del diff. No hay instancia local de PostgreSQL para ejecutar la migracion; el SQL y la consulta de catalogo estan preparados, pero el resultado en Supabase sigue pendiente de Alejandro. La aplicacion desplegada mantiene la importacion anterior y no envia invitaciones.

Alejandro informó después que la ejecución completa devolvió `CENSUS_PRIMARY_SCHEMA_OK` y confirmó las siete columnas `true` de `census_primary_catalog_readonly.sql`. No se ha hecho una importación real ni una prueba funcional en producción.

## Entrega 2: seleccion visible, todavia sin envio

La vista previa agrupa respuestas por apartamento y conserva un único principal con nombre y correo de la columna G. Si hay una sola respuesta válida, se preselecciona; si hay varias, se elige una. La relación de acceso se deriva de «Tipo de usuario» en el servidor, sin selector adicional ni confiar en un valor enviado por el navegador. El servidor relee el Excel, valida la selección y rechaza el mismo correo como principal de dos apartamentos. La ficha identifica el principal guardado. Las unidades sin nombre o correo elegibles se conservan sin principal. No se generan invitaciones ni correos.

La interfaz depende de la migracion anterior; Alejandro confirmo las siete columnas `true` antes de publicarla. La importacion funcional queda pendiente de un caso de prueba controlado aprobado por Alejandro.

Verificación local de esta entrega: TypeScript y compilación aprobaron; siete pruebas del censo y 20 de seguridad aprobaron; ESLint terminó sin errores, con seis advertencias preexistentes en otros módulos. No hubo prueba de importación contra Supabase ni verificación visual en Vercel.

Codigo de interfaz: commit `535676b`, subido a `main` junto con la documentacion hasta `ed2a2f9`. El estado de GitHub para `ed2a2f9` reporto Vercel `success` y «Deployment has completed». Esto confirma despliegue, no que Alejandro haya importado o revisado la pantalla en produccion.

## Pendiente para la entrega de envio

En la revisión de la vista previa del 21/10, Alejandro pidió quitar el selector «Relación para acceso futuro». El cliente muestra el valor derivado de «Tipo de usuario» y preselecciona al único candidato válido de cada apartamento; el servidor vuelve a derivar la relación desde el archivo y no acepta la relación enviada por el navegador. Los tipos ambiguos impiden confirmar la importación. Pasaron ocho pruebas del censo, 20 de seguridad, TypeScript y compilación; ESLint no dio errores y conservó seis advertencias preexistentes de otros módulos. Aún no se importó el Excel ni se comprobó visualmente esta vista publicada.
Código `a03fcc2` subido a `main`; GitHub informó `Vercel: success` y «Deployment has completed». La revisión en la web sigue pendiente de Alejandro.

Por solicitud de Alejandro, la pantalla de Propiedad ya no muestra la antigua sección manual «Invitaciones de residentes» ni su acceso de navegación. Se retiraron también sus consultas de torres y apartamentos de esa página. No se borraron invitaciones históricas ni se activó el envío desde el censo; el flujo subyacente permanece para una futura activación controlada.
Esta entrega pasó `npm run typecheck`, `npm run build` y las 20 pruebas de seguridad. ESLint terminó sin errores y con seis advertencias preexistentes fuera de esta página. La revisión visual en Vercel y la prueba de asistencia en Asambleas quedan pendientes de confirmación de Alejandro.
Código subido en `ce4c323`; GitHub informó `Vercel: success` y «Deployment has completed» para ese commit. Esto confirma el despliegue, no la revisión visual de Alejandro.

Faltan la interfaz de seleccion, una cola de invitaciones con comprobacion de vigencia y permisos justo antes del envio, la plantilla del enlace, deduplicacion, registro de errores y un interruptor de activacion que permanezca apagado hasta la prueba de correo. La importacion real del Excel y los correos a residentes estan pendientes de un caso controlado acordado con Alejandro. No usar el Excel real ni enviar a terceros en una prueba tecnica.

## Capacidad y vista previa para censos grandes (22/10/2026)

Alejandro aprobó subir el límite a 4 MB y 2.000 respuestas por archivo, y que el principal de cada apartamento sea la primera fila con nombre y correo de la columna G. Si esa fila tiene un «Tipo de usuario» no reconocido, se preselecciona la siguiente fila elegible que sí lo tenga.

- Límites: `src/lib/census/parse.ts` concentra 2.000 filas, 4 MB y 80 columnas. El lector acotado del Excel recibe los límites por parámetro; Cartera conserva 500 filas y 2 MB. `next.config.ts` acepta envíos de hasta 4,5 MB, el máximo de Vercel. La migración `20261022120000_census_capacity_2000.sql` sube el tope de `census_imports` y de las dos funciones de importación sin cambiar su lógica; Alejandro confirmó `CENSUS_CAPACITY_2000_OK`.
- Prueba de carga: un Excel ficticio de 2.000 filas, 10 torres y 1.000 apartamentos (correos `@resiq.invalid`, generado en `outputs/`, fuera del repositorio) se importó en el piloto en Edificio Mirador ResiQ, dentro del límite de 8 segundos de Supabase. Las tres formas de escribir una torre («Torre A», «A», «torre a») crearon una sola torre. `supabase/operations/create_load_test_property.sql` creó «Conjunto Carga de Prueba», que quedó sin uso: las pruebas se hacen en Bosques y Mirador.
- Vista previa: por decisión de Alejandro se retiró la lista «Principal por apartamento» con su selector; se mantiene la tabla de respuestas. El principal es siempre la primera fila elegible, sin selección manual en pantalla, y el servidor vuelve a validarlo al importar.
- Fórmulas en celdas: no se modifican al importar, porque valores legítimos como teléfonos «+57…» empiezan con caracteres de fórmula. El riesgo existe solo al exportar a Excel o CSV; cualquier exportación futura debe neutralizar celdas que empiecen por `=`, `+`, `-`, `@`, tabulador o retorno de carro.

## Agregar residente en un apartamento vacío (23/10/2026)

En la ficha de un apartamento sin residente vinculado, con torre y apartamento activos, Administración puede abrir «Agregar residente», escribir el correo y el tipo (Propietario o Arrendatario) y crear una invitación de 72 horas con `create_resident_invitation`. ResiQ muestra el enlace para compartirlo; todavía no envía ni encola correos. Cuando exista la cola de invitaciones con modo de prueba, este formulario la usará en lugar de mostrar el enlace. La ficha del apartamento ahora lee hasta 2.000 respuestas del censo (antes 500).

## Una persona por apartamento (23/10/2026)

Alejandro decidió que cada apartamento guarde solo la respuesta de quien vive ahí, y que su tipo salga de «Tipo de usuario»: Propietario, o Residente para Residente y Arrendatario. Esto reemplaza las decisiones iniciales de guardar todas las filas y dejar sin invitación las adicionales.

- Si el Excel trae más de una fila para un mismo apartamento (torre + número, aunque la torre esté escrita distinto), la vista previa lo bloquea e indica las filas repetidas; el admin debe dejar una sola. El servidor aplica la misma validación y `20261023120000_census_one_record_per_unit.sql` agrega un índice único `census_records(property_id, unit_id)` como última barrera.
- La lista de apartamentos de Propiedad muestra el tipo junto al número, por ejemplo «Apartamento 101 · Propietario».
- El censo de prueba de Mirador tenía dos personas por apartamento. `supabase/operations/clean_mirador_census_test.sql` borra solo ese censo ficticio y sus torres y apartamentos (aborta si otro dato los usa) para reimportarlo con un Excel de 1.000 filas, una por apartamento.
- Volver a subir un Excel para actualizar datos existentes todavía no está disponible: una propiedad con torres no admite otra importación. Queda pendiente su diseño (actualizar el mismo apartamento sin crear otro).

## Cola de invitaciones con modo de prueba (23/10/2026)

Alejandro aprobó el diseño: las invitaciones se crean y encolan en `email_jobs`, nunca se envían directo, y el modo de prueba queda activo hasta tener dominio verificado.

- Base de datos (`20261023140000_invitation_queue_test_mode.sql`, confirmada por Alejandro con cinco columnas `true`): estado `held` en `email_jobs`, que el trabajador no reclama; interruptor `private.invitation_delivery` (apagado); plantilla `resident_invitation`; una invitación por principal al importar el censo. La invitación nace con un hash inutilizable: el código del enlace se genera al pulsar «Ver enlace» (o, más adelante, justo antes de enviar) con 72 horas de vigencia, tras revalidar que siga pendiente, que el apartamento esté activo y sin residente vigente y que el correo no tenga rol de administración o portería. El código no queda guardado en la cola. Ver enlace y crear invitación quedan en auditoría.
- Mirador importó su censo antes de la migración: `supabase/operations/backfill_census_invitations.sql` creó 1.000 invitaciones retenidas (confirmado por Alejandro).
- Pantalla: la ficha de un apartamento sin residente muestra el estado de su invitación (retenida, en cola, enviada, aceptada, cancelada o vencida) y «Ver enlace». «Agregar residente» usa la cola en lugar de mostrar el enlace al crear; una invitación nueva reemplaza a la pendiente del mismo apartamento o correo.
- Pendiente (entrega 3): que el trabajador genere el código y envíe el correo cuando se active el envío real, con lotes acordes al límite diario de Resend.
