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
- Pantalla: la ficha de un apartamento sin residente muestra el estado de su invitación (retenida, en cola, enviada, aceptada, cancelada o vencida) y «Ver enlace». «Agregar residente» usa la cola en lugar de mostrar el enlace al crear. Si el apartamento ya tiene invitación pendiente, en su lugar aparece «Cambiar correo de la invitación» dentro del mismo recuadro; la nueva reemplaza a la pendiente del mismo apartamento o correo.
- Pendiente (entrega 3): que el trabajador genere el código y envíe el correo cuando se active el envío real, con lotes acordes al límite diario de Resend.
- Entrega 3 (envío real, apagado): `20261023160000_invitation_delivery_worker.sql` limita el reclamo de invitaciones al envío activo y a un máximo diario configurable (90), agrega `issue_invitation_for_job` (solo el trabajador) y el interruptor `private.set_invitation_delivery`. El worker genera el código justo antes de enviar y guarda el texto sin el enlace. Pruebas Deno: 6 aprobadas. Activar solo con dominio verificado en Resend, empezando con 1 a 3 correos propios en una propiedad de prueba.

## Editar un apartamento desde su ficha (23/10/2026)

Alejandro pidió poder corregir los datos de un apartamento (vehículos, mascotas, familia, contacto) sin subir otro Excel. En la ficha, «Editar» convierte la pestaña activa en campos editables; TORRE y APARTAMENTO no se pueden cambiar, y la base de datos lo vuelve a comprobar. `20261023180000_census_record_editing.sql` agrega `update_census_record` y el historial `census_record_changes` (quién, cuándo, celdas antes y después), legible solo por administración.

- Si el apartamento no tiene residente vinculado y cambian el correo de la columna G o el tipo de usuario, la invitación pendiente se reemplaza por una nueva, retenida en modo de prueba. Si queda sin nombre o correo, la invitación pendiente se cancela. Un correo ya invitado en otro apartamento se rechaza.
- Con residente vinculado solo cambian los datos del censo; la cuenta no se toca.
- Por eso se retiró «Cambiar correo de la invitación» del recuadro de la invitación: el correo se cambia editando la pestaña Residente. «Agregar residente» sigue disponible en apartamentos sin invitación pendiente.

## Correo de acceso y correo de facturas (23/10/2026)

- Al editar, el campo «Correo electrónico» explica que es el correo de la invitación y del acceso a ResiQ. Si el apartamento ya tiene residente con cuenta y cambian el correo, Alejandro decidió (23/10/2026) que al guardar se desvincule al residente actual, igual que «Desvincular del apartamento», y se cree la invitación para el correo nuevo; antes de guardar aparece un aviso y después un mensaje con lo ocurrido (`20261023220000_census_email_replaces_resident.sql`, confirmada con dos `true`). Si el correo nuevo es el de la cuenta vinculada, no se desvincula a nadie. La cuenta del residente anterior no cambia de correo: queda sin ese apartamento y, si era el último, suspendida, como al desvincular a mano.
- «¿A qué correo se le hace el envío de las facturas?» ahora se usa: `20261023200000_census_billing_email.sql` hace que cada aviso de cartera del apartamento llegue también a ese correo, además de las cuentas con acceso a la cartera, solo si «¿Autoriza recibir las facturas de administración por correo?» dice Sí (autorización de datos, ley 1581; validar con asesor legal). No se duplica si coincide con el correo de una cuenta. Al ser un correo sin cuenta, sigue el interruptor de envío real: en modo de prueba queda retenido. Justo antes de enviar, `authorize_billing_email_job` comprueba que la autorización siga en Sí y que el correo no haya cambiado; si cambió, ese aviso se cancela y los siguientes van al correo nuevo. Pruebas Deno: 7 aprobadas.

## Pruebas pendientes para cuando haya dominio verificado

Alejandro probó en el piloto (23/10/2026) la edición de apartamentos y el cambio de correo en modo de prueba. Quedan pendientes, en este orden, cuando el dominio esté verificado en Resend y `RESEND_FROM_EMAIL` use ese dominio:

1. Volver a desplegar la Edge Function `process-email-jobs` (acumula invitaciones y correo de facturas).
2. Invitaciones reales: activar con `select private.set_invitation_delivery(true, false);` y probar con 1 a 3 correos propios en una propiedad de prueba (Conjunto Carga de Prueba): recibir el correo, abrir el enlace, aceptar y entrar. Revisar que `email_logs` no guarde el enlace.
3. Cartera al correo de facturas: con un apartamento cuyo censo tenga «¿Autoriza recibir las facturas…?» = Sí y un correo de facturas propio, registrar un cobro y un pago y comprobar que llegan a la cuenta del residente y al correo de facturas. Cambiar el correo de facturas y comprobar que el siguiente aviso llega al nuevo; poner la autorización en No y comprobar que deja de llegar.
4. Solo después, decidir si se liberan las invitaciones retenidas de los conjuntos reales (`set_invitation_delivery(true, true)`), respetando el límite diario.
5. SMTP propio para Supabase Auth (anotado el 24/10/2026): configurar en Authentication › SMTP Settings el envío por Resend con el dominio verificado. Sin eso, crear cuenta con correo y contraseña desde una invitación falla («No fue posible crear la cuenta…»): Supabase necesita enviar el correo de confirmación y su servicio básico solo permite pocos envíos, normalmente a correos del equipo. Con Google sí funciona, porque Google ya verifica el correo; así lo comprobó Alejandro el 24/10/2026 al aceptar una invitación de Bosques Torre A · 101.
6. Con el SMTP propio, probar: crear cuenta con contraseña desde una invitación y confirmar el correo; aceptar la invitación con esa cuenta; activar `PASSWORD_RECOVERY_ENABLED` y probar «¿Olvidaste tu contraseña?» de punta a punta.
7. Auxiliar de administración (anotado el 26/10/2026 a pedido de Alejandro): desde Propiedad › Auxiliares › «Nuevo auxiliar», registrar uno con un correo propio y verificar el recorrido completo: que llegue el enlace, crear la cuenta con contraseña, aceptar, que entre con Administración, que aparezca «Activo» con sus datos, y que «Suspender acceso» y «Reactivar acceso» funcionen. Probar igual la invitación de administrador desde Plataforma › Administradores. Hoy ambas entregan el enlace en pantalla, sin enviar correo.

## Apartamento libre y nueva invitación (24/10/2026)

«Desvincular del apartamento» (tarjeta del residente vinculado) quita el acceso y cierra el vínculo con historial; el apartamento nunca se borra. Cuando un apartamento queda sin residente ni invitación pendiente, su ficha solo muestra en el centro un ícono de persona con «+», «Apartamento sin residente» y el botón «+ Nueva invitación»; no muestra pestañas, campos ni datos anteriores (quedan en el historial). El botón abre la edición con los campos en blanco salvo torre y apartamento; Cancelar vuelve al mensaje. Al guardar nombre, correo y tipo de usuario se crea la invitación, aunque sea el mismo correo de antes; los datos anteriores quedan en el historial (`20261024100000_census_vacant_unit_invitation.sql`). El recuadro de la invitación solo se muestra si está pendiente, y «Agregar residente» queda para apartamentos sin datos del censo. La sección «Vinculaciones y acceso a ResiQ» solo aparece si hay residente vinculado, invitación pendiente o un apartamento sin datos del censo; en los demás casos el aviso de apartamento libre la reemplaza.

## Desvincular junto a Editar (24/10/2026)

Alejandro probó la invitación de punta a punta en Bosques Torre A · 101: aceptó con Google y el apartamento quedó vinculado. A su pedido, en apartamentos con datos del censo «Desvincular» está junto a «Editar» y pide confirmación en una ventana centrada sobre la ficha, con el fondo desenfocado («¿Seguro que quieres desvincular a…? Perderá el acceso…») antes de usar `end_unit_membership`; la tarjeta aparte del residente se retiró de «Vinculaciones y acceso a ResiQ» para tener menos tarjetas. Esa tarjeta solo se mantiene en apartamentos sin datos del censo. Al desvincular, la ficha vuelve al mensaje «Apartamento sin residente» con «+ Nueva invitación».

## Actualizar el censo subiendo otro Excel (24/10/2026)

Alejandro aprobó las reglas: el mismo apartamento (torre + número) se actualiza; un apartamento nuevo se crea, con su torre si hace falta, y con su invitación retenida; los que no vienen en el Excel no se tocan y nunca se borra nada. Un cambio de correo sigue la regla de «Editar»: sin residente reemplaza la invitación; con residente lo desvincula e invita al correo nuevo. Torre y apartamento conservan el texto ya guardado. Las columnas deben ser las mismas del censo existente, pero se comparan por nombre y no por posición, y la de autorización se reconoce aunque su texto cambie; si falta o sobra una, el mensaje la nombra.

`20261024120000_census_update_from_excel.sql` agrega `update_census_from_excel`, que reutiliza `update_census_record` por apartamento. Con `dry_run` aplica todo, cuenta el resultado y lo deshace, así que la vista previa es exacta: apartamentos actualizados, nuevos, sin cambios, torres nuevas, invitaciones y la lista de residentes que se desvincularían. Un apartamento con datos idénticos no se toca, para no volver a invitar a quien ya no vive ahí. Un error en una fila se informa con su número y no guarda nada. En la página de Propiedad, cuando ya hay torres, aparece «Excel actualizado» con «Revisar cambios» y luego «Confirmar actualización». Para probar en Mirador hay un Excel ficticio en `outputs/carga-2000/censo-actualizacion-mirador.xlsx` (10 placas cambiadas en Torre A y 5 apartamentos nuevos en Torre K).
- Prueba en Mirador (24/10/2026): la vista previa mostró 10 actualizados, 5 nuevos, 990 sin cambios, 1 torre nueva y 5 invitaciones. Al confirmar fallaba porque React vacía el campo de archivo después de cada envío; ahora el formulario guarda el archivo elegido y lo envía en los dos pasos. A pedido de Alejandro, la vista previa también lista en una tabla cada apartamento que cambia (torre, apartamento, residente, actualizado o nuevo, e invitación nueva, reemplazada o con residente desvinculado), como en la primera importación (`20261024140000_census_update_change_list.sql`).
