# Etapa 16 — Revisión inicial de seguridad

Fecha: 2026-10-07. Alejandro autorizó revisar los PR del colaborador y continuar con el paso 16. La etapa 15 mantiene su alcance aprobado, pero no se ha implementado; avanzar a esta revisión no equivale a cerrarla.

## Evidencia y límites
Se consultaron los ocho PR abiertos mediante la API de GitHub y se revisaron los cambios de autenticación, importación, las cinco migraciones de seguridad y las rutas de publicación de documentos. Las pruebas descritas por el autor son evidencia reportada, no pruebas ejecutadas por esta revisión. No se integraron ramas, ejecutaron migraciones remotas ni desplegaron cambios.

## Inventario
| PR | Cambio | Verificación pendiente antes de producción |
|---|---|---|
| #1 | Destinos de autenticación locales normalizados | Ejecutar regresión e invitación/OAuth sobre rama integrada |
| #2 | Autorizar antes de procesar Excel y limitar expansión ZIP/XML | Ejecutar regresiones y probar plantilla real |
| #3 | Revocar lectura de avisos financieros y evidencias al perder acceso | Probar RLS integrada y Storage real; enlaces ya firmados conservan su vencimiento |
| #4 | Bloquear lecturas y mutaciones en propiedades inactivas | Probar roles, invitaciones y RPC al suspender/reactivar |
| #5 | Publicación de archivos por servidor tras validar bytes | Configurar SUPABASE_SECRET_KEY privada; desplegar rutas y migración de forma coordinada; probar Storage real |
| #6 | Cupos serializados y limpieza segura de rechazados | Probar concurrencia y eliminación real vía Storage antes de liberar cupo |
| #7 | Revalidar destinatario antes de enviar correo | Revisar correos históricos e invitaciones y ejecutar pruebas combinadas |
| #8 | Actualizar dependencias | Instalar y verificar combinación; comprobar avisos de desarrollo reportados |

Fuentes: https://github.com/AlxjoRuiz/ResiQ/pull/1 a https://github.com/AlxjoRuiz/ResiQ/pull/8.

## Hallazgos de integración

### Correos financieros históricos en PR #7
La autorización de correo obtiene la unidad solo de template_data.unit_id. La migración de PR #3 mejora los correos nuevos, pero no rellena ese campo en trabajos antiguos; su función de lectura sí tiene alternativas por entidad o clave de deduplicación. Por tanto, un correo financiero anterior aún en cola puede ser cancelado como acceso revocado aunque el destinatario conserve permiso. Antes de integrar, resolver la unidad histórica de forma segura por entidad/propiedad o realizar una migración explícita de trabajos pendientes. Añadir regresión con un trabajo anterior sin unit_id y permiso válido, además de un caso sin permiso.

### Invitaciones en PR #7
La tabla email_jobs admite trabajos con invitation_id y sin notification_id. authorize_email_job solo busca notificaciones: un trabajo de invitación no obtiene actor y se cancela. La aplicación actual no demuestra uso activo de esa cola para invitaciones en la revisión realizada, por lo que se registra como incompatibilidad del contrato y no como un fallo observado de envío. Definir y probar autorización específica de invitaciones antes de introducirlas en esta cola.

### Despliegue coordinado de archivos en PR #5
Revocar complete_*_document antes de publicar las rutas nuevas rompe las cargas antiguas. Publicar las rutas nuevas sin RPC o sin SUPABASE_SECRET_KEY también impide finalizar archivos. Preparar configuración privada y un procedimiento de publicación coordinado con comprobación de carga válida e inválida. Nunca configurar esta clave como NEXT_PUBLIC ni incluirla en Git.

### Worker compartido
PR #6, #7 y #8 modifican process-email-jobs/index.ts. La integración debe preservar limpieza, autorización de destinatarios, plantillas actuales y configuración de importaciones. No basta con validar cada rama individual; ejecutar pruebas del worker combinado y comprobar Cron.

## Orden de trabajo propuesto
1. Corregir o resolver los casos históricos e invitaciones de #7 con su autor, sin enviar mensajes en su nombre desde esta revisión.
2. Integrar en una rama de revisión aislada: #1 y #2; migraciones #3 a #7 en orden cronológico; #8 conservando todos los cambios del worker.
3. Ejecutar pruebas Node/Deno, TypeScript, lint, compilación y regresiones SQL en entorno descartable. Configurar Storage real de prueba para los casos no cubiertos por fixtures del autor.
4. Documentar configuración privada y despliegue coordinado antes de aplicar cambios a producción.
5. Revisar el resto de la matriz de etapa 16: permisos de escritura sobre avisos, registros de auditoría, rutas, archivos, secretos y aislamiento multi-tenant.

## Estado de cierre
Etapa 16 iniciada, revisión inicial entregada; no está completa. No se declara seguridad integral ni se consideran desplegadas las correcciones de los PR. La falta de dominio Resend sigue pendiente para recepción real por otros destinatarios. Diseño visual diferido por el usuario.

## Segunda entrega: permisos efectivos y catálogo
Se revisaron notifications, audit_logs, privilegios de colas y funciones internas del código actual. El grant explícito de notificaciones limita UPDATE a read_at; auditoría tiene una política SELECT de administración y write_property_audit revoca ejecución a roles de navegador. Esto es evidencia estática, no prueba del estado remoto.

Se añadió supabase/tests/stage16_security_catalog_readonly.sql: transacción de solo lectura, sin datos personales ni secretos, que inspecciona RLS, privilegios efectivos de tabla y columna, políticas y funciones privilegiadas. Revisa TRUNCATE porque RLS no lo protege. Debe ejecutarse en Supabase para detectar permisos heredados/default que no se deducen de los GRANT explícitos del repositorio. Un true en permisos de escritura requiere evaluación; no demuestra por sí solo un bypass RLS para INSERT/UPDATE/DELETE.

La consulta no se ejecutó remotamente en esta entrega. No se introdujeron cambios de permisos basados en suposiciones ni se modificaron los PR del colaborador.

## Integración de los ocho PR — 2026-10-07
Rama aislada codex/integracion-seguridad en ResiQ-seguridad. Se combinaron las ocho ramas del colaborador conservando sus commits; conflicto del worker resuelto manteniendo limpieza, autorización y versión fijada. Se reutilizó can_read_finance_notification para correos históricos sin unit_id y se adaptó su regresión SQL. Los trabajos de invitación siguen sin soporte de plantilla en el worker actual: no se habilitan envíos de invitación nuevos en esta integración.

Verificación propia: seis pruebas Node de redirección, bytes, limpieza y Excel pasaron; tres pruebas Deno con proveedor simulado pasaron. npm audit --omit=dev reportó cero vulnerabilidades. La instalación completa reporta cinco alertas altas de dependencias de desarrollo; no se ejecutó audit fix --force. Se añadió npm run test:security para Node 22.14 con soporte TypeScript explícito. Deno se verificó con dependencias locales (--node-modules-dir=manual) después de un fallo de preparación de la caché global.

Las pruebas SQL del autor, la nueva regresión histórica y la consulta de catálogo permanecen pendientes de ejecución integrada. No se consideran verificadas por las pruebas Node/Deno.

Alejandro confirmó que SUPABASE_SECRET_KEY aún no está configurada en Vercel. No actualizar main hasta configurar esa variable exclusivamente en servidor, coordinar migraciones y rutas, y redesplegar el worker con las cinco migraciones aplicadas en orden. No copiar claves al chat, archivos versionados ni variables NEXT_PUBLIC. Navegador automatizado sigue agotando tiempo de espera, por lo que no se verificó configuración remota.

La verificación completa de la integración terminó correctamente: TypeScript, ESLint y compilación Next 16.4 con Webpack. Alejandro confirmó que guardó SUPABASE_SECRET_KEY como secreto de Producción en Vercel el 2026-10-07; no se leyó ni almacenó su valor. La comprobación inicial de catálogo en Supabase mostró que las RPC y guardas nuevas aún no estaban aplicadas.

Cinco migraciones de seguridad aplicadas en una transacción en Supabase, resultado stage16_security_migrations_applied. Antes de aplicar se ejecutaron las migraciones combinadas con regresiones de access_revocation y property_status, resultado stage16_integrated_rls_passed y rollback completo. Archivos con Storage real, concurrencia y regresión histórica de correos pendientes.

La revisión automática rechazó el push directo a main porque evitaba el PR de borrador. Main no se actualizó. La migración de finalización ya restringe RPC antiguas: la publicación de adjuntos requiere desplegar las rutas nuevas del PR #9. Solicitar confirmación explícita para fusionar el PR por GitHub y activar producción; no eludir el rechazo con otro push. Worker actualizado todavía pendiente de despliegue.

## Publicación y auditoría remota — 2026-10-07
PR #9 fusionado por GitHub tras autorización explícita; main a262498. Vercel confirmó success para ese commit. La carpeta Desktop/ResiQ se actualizó por fast-forward; las notas anteriores se conservaron además en stash como respaldo, ya incorporadas al repositorio.

Worker desplegado en Supabase: index.ts y cleanup-documents.ts comparados por contenido desde el editor. El editor web solo admitió archivos .ts, por lo que se usaron imports npm:@supabase/supabase-js@2.117.3 equivalentes al mapeo de deno.json del repositorio. El panel mostró despliegue reciente. La consulta de salud mostró tres ejecuciones Cron succeeded y respuestas HTTP 200; no acredita entrega de correos ni prueba archivos reales.

La auditoría de permisos efectivos detectó grants heredados: authenticated podía modificar todas las columnas de notifications y anon/authenticated tenían TRUNCATE en varias tablas públicas. RLS no protege TRUNCATE; la presencia del grant no prueba que exista un endpoint público de truncado. Se aplicó 20261007190000_restrict_effective_browser_grants.sql para limitar edición a read_at y retirar TRUNCATE de roles de navegador y PUBLIC. La regresión de catálogo terminó con stage16_effective_grants_passed.

Pendiente antes del cierre de etapa 16: prueba de adjuntos con Storage real y rutas publicadas; concurrencia remota de cupos; autorización SQL de correos históricos; repaso integral del resto de permisos/RPC y auditoría. No se declara etapa completa. Dominio Resend sigue pendiente para otros destinatarios.

## Prueba de archivos reales en producción — 2026-10-07
Desde la cuenta administradora de Bosques, usando la asamblea ya identificada como prueba (25777224-2bc0-4892-89ef-06b19b65b933), se cargaron dos archivos sintéticos sin información personal. Un PNG de 68 bytes fue publicado y la interfaz confirmó Documento cargado y validado; documento 2fee4d7e-4622-4244-afca-98b549fee35c. Un texto de 60 bytes con extensión PNG fue rechazado con El contenido no coincide con un PDF, JPG o PNG válido y no apareció como documento publicado. Esto acredita el flujo real preparar/Storage/finalizar de asambleas y validación básica por firma, no un análisis antivirus o un decodificador completo de imágenes.

No se cambiaron convocatoria, asistentes ni permisos. El soporte válido permanece en el expediente de prueba; el rechazo queda sujeto a limpieza segura del worker, cuya eliminación aún no se verificó. Para probar el límite de cinco archivos se necesita PQRS, llamado o evidencia de representación: los soportes generales de asamblea no tienen ese límite acumulado en la RPC actual. Pendientes: cuota de PQRS y concurrencia; revocación de descarga real; limpieza del rechazo y pruebas de correos históricos.

## Cuota real de PQRS con residente y concurrencia — 2026-10-07
Cuenta residente del apartamento 101 en Bosques. Se creó la PQRS sintética PRUEBA TÉCNICA — límite de adjuntos (55bd84dd-3af6-42f9-86ea-d8fbe2c7a332). Dos pestañas mostraban inicialmente cinco cupos; se seleccionaron tres PNG válidos de 68 bytes por pestaña y se iniciaron ambos lotes con acciones concurrentes. Un lote completó tres archivos; el otro completó dos y recibió La PQRS ya tiene 5 adjuntos al intentar el sexto. La recarga confirmó exactamente cinco enlaces de documentos publicados y Ya alcanzaste el máximo de 5 adjuntos sin control de carga. Se observaron archivos intercalados de ambas pestañas. Es una regresión real de dos lotes concurrentes, no una prueba de carga masiva ni garantía de todas las intercalaciones posibles.

No se modificaron permisos ni registros previos. La PQRS y sus cinco imágenes sintéticas se conservan como evidencia de prueba. Se detectó además que la pestaña cuyo lote falló mantiene el contador visual anterior hasta recargar; el servidor sí bloquea el sexto archivo. Revisar actualización del contador tras fallo parcial y conteo de pendientes/rechazados antes del cierre. Permanecen pendientes la limpieza real del rechazo de asamblea, revocación de descarga y correos históricos.

## Revocación sobre Storage real y estado de limpieza — 2026-10-07
Se ejecutó stage16_real_storage_revocation_transaction.sql en Supabase sobre el PNG sintético de asamblea publicado. Con el rol authenticated y el identificador del residente, documento y objeto eran visibles antes de simular el vencimiento del vínculo al apartamento; dejaron de ser visibles tras el vencimiento. Resultado real_storage_revocation_passed; la transacción termina con ROLLBACK, sin cambios persistentes de membresía ni permisos. Es una prueba de RLS sobre objeto real, no una prueba HTTP con revocación persistente. Las URL firmadas previamente emitidas conservan sus cinco minutos de validez.

Consulta de solo lectura del PNG inválido: documento 155b8f5c-bdbf-48f9-aa62-15575b6e7191, status rejected, upload_rejected_at 2026-10-07 19:41:01.471802 UTC, cleanup_due false, object_exists true. La eliminación se habilita después de 16:46:01 hora de Colombia, tras el plazo de 2 horas y 5 minutos. No se adelantó la fecha ni se eliminó el objeto manualmente. Verificar con una consulta posterior que el worker retire el objeto y cambie status a deleted; sigue pendiente.

## Correos financieros históricos — 2026-10-07
Se ejecutó stage16_historical_email_transaction.sql en Supabase, resultado historical_email_access_passed. El trabajo sintético carece de unit_id tanto en template_data como en el payload de notificación. Se comprobó autorización histórica válida, rechazo del worker con lease distinto, cancelación al revocar finance_access y restauración del contexto del actor. La transacción terminó con ROLLBACK; no se enviaron correos ni se conservaron usuarios, propiedades, deudas o trabajos sintéticos.

La variante hospedada limita todas las modificaciones de jobs/notificaciones a la propiedad de fixtures y prepara directamente un lease sintético; no llama claim_email_jobs sobre la cola real. La prueba SQL original queda para entorno descartable. No acredita recepción real en Resend, dominio verificado ni soporte de invitaciones en la cola.

## Corrección del contador de adjuntos de PQRS — 2026-10-07
La pantalla usaba solo documentos publicados y no actualizaba al fallar parcialmente un lote. Se añadió pqrs_attachment_slots_used, una RPC de solo consulta que verifica membresía activa y lectura de la PQRS, cuenta pending/available/rejected del padre y sus respuestas, y devuelve solo un entero. No amplía RLS de documents ni Storage. La página no habilita cargas si falla la consulta de cupos. El componente actualiza la ruta también tras un fallo, conserva el mensaje cuando se agotan los cupos y deshabilita el control durante la actualización.

Regresión SQL ejecutada con rollback: tres cupos entre pending/available/rejected incluyendo una respuesta; deleted excluido; rejected sigue oculto; cuenta ajena recibe not_authorized. Resultado pqrs_attachment_slots_passed. Migración 20261007210000_pqrs_attachment_slots.sql aplicada, resultado pqrs_quota_migration_applied. TypeScript, lint y compilación Next 16.4 con Webpack pasaron. La primera compilación aislada no tenía variables públicas de Supabase; la repetición con configuración pública completó correctamente. PR #11 fusionado y Vercel confirmó despliegue de producción exitoso para 05778e0.


Verificación visual en producción: PQRS sintética d46cac2a-c658-4053-81de-cc7fbb93e7c1, lote de PNG válido más texto con extensión PNG. Sin recarga manual, se publicó un solo archivo, se conservó el mensaje de rechazo y se mostraron tres cupos restantes: disponible más rechazado ocupan dos. La prueba conserva sus registros sintéticos y el rechazo espera el plazo de limpieza seguro. Etapa 16 permanece abierta para limpieza y repaso final.

## Repaso de catálogo y limpieza pendiente — 2026-10-07
stage16_final_catalog_readonly.sql se ejecutó remotamente con begin read only/rollback: ninguna tabla pública regular/particionada sin RLS; ninguna función security definer de public/private sin search_path fijo; ninguna RPC interna listada accesible a anon/authenticated; ningún TRUNCATE para roles de navegador; solo read_at actualizable en notifications. No hay políticas PERMISSIVE de escritura en audit_logs, documents, email_jobs o email_logs. Las guardas active_property_access son RESTRICTIVE y no conceden por sí solas escritura. Esta revisión comprueba ese catálogo concreto, no garantiza ausencia de defectos en toda función de negocio.

Los dos rechazos sintéticos siguen rejected con objeto presente y cleanup_due=false. Asamblea: 155b8f5c-bdbf-48f9-aa62-15575b6e7191, limpieza habilitada después de 16:46:01 Colombia. PQRS contador: fbf52248-c08e-4d70-8e97-665e0948c9ce, después de 17:40:38 Colombia. No se forzó la limpieza ni se alteró el plazo. Verificar posteriormente deleted y ausencia del objeto; etapa 16 aún abierta.

## Continuación: limpieza y permisos de visitas — 2026-10-07
Consulta remota de solo lectura a las 22:08:57 UTC (17:08:57 Colombia): el rechazo de asamblea 155b8f5c-bdbf-48f9-aa62-15575b6e7191 figura deleted y no tiene objeto en storage.objects. Esto confirma que el worker completó la limpieza real después del plazo seguro. El rechazo de PQRS fbf52248-c08e-4d70-8e97-665e0948c9ce sigue rejected, objeto presente y cleanup_due=false; elegible después de las 17:40:38 Colombia. No se forzó la eliminación ni se alteraron fechas. Falta comprobar su eliminación y la liberación del cupo en interfaz.

Se repitió visit_requests_transaction.sql en Supabase, acotando explícitamente la selección de fixtures a Bosques. Resultado PASS: solicitudes, decisiones, permisos y movimientos; datos revertidos. Residente puede solicitar pero no revisar; administrador puede decidir pero no crear ni registrar ingreso; portería puede registrar ingreso/salida de visita autorizada pero no crear/revisar ni ingresar una rechazada. ROLLBACK restaura todos los registros y el cambio temporal de rol de la prueba. Es una prueba de RPC, no una sesión visual real de cada rol ni una verificación completa de todos los módulos.

npm.cmd run test:security pasó las seis regresiones Node en el checkout aislado con las dependencias fijadas: redirecciones, bytes de archivos, liberación de cuota tras eliminación y límites de Excel. No hubo cambios de código ni de permisos persistentes. Etapa 16 permanece abierta; no se declara cerrada la revisión integral. Logo pendiente de revisar después de estas verificaciones.

## Aislamiento de lectura del piloto — 2026-10-07
Ejecutado stage16_pilot_tenant_readonly.sql en Supabase: resident_cross_tenant_and_anonymous_read_checks_passed. La sesión SQL del residente piloto conserva acceso a Bosques y no ve otras propiedades; se recorrieron las tablas públicas regulares/particionadas con columna property_id y privilegio SELECT efectivo para comprobar que ninguna devuelve filas de otra comunidad. Con rol anon se comprobó que esas tablas accesibles no devuelven filas. Transacción begin read only/rollback, sin datos ni permisos modificados. Esta prueba cubre lectura del piloto y estado actual de tablas con property_id; no reemplaza revisión de escrituras, RPC de negocio, relaciones sin property_id, sesiones visuales o casos futuros.

Consulta de limpieza a las 22:30:28 UTC (17:30:28 Colombia): asamblea deleted y objeto ausente; PQRS rejected, objeto presente, cleanup_due=false. Logo pospuesto por Alejandro; no se modificaron marca ni estilos. Sigue pendiente comprobar el rechazo de PQRS después del plazo y cerrar los restantes puntos de la matriz del prompt maestro.

## Limpieza real completada y cupo recuperado — 2026-10-07
A las 22:42:03 UTC (17:42:03 Colombia), consulta remota begin read only/rollback confirmó ambos rechazos sintéticos en status deleted y object_exists=false: asamblea 155b8f5c-bdbf-48f9-aa62-15575b6e7191 y PQRS fbf52248-c08e-4d70-8e97-665e0948c9ce. Se observó la eliminación normal por el worker, sin forzar fechas ni borrar manualmente.

La RPC pqrs_attachment_slots_used ejecutada con el contexto authenticated del residente piloto devuelve 1 usado y 4 restantes para la PQRS d46cac2a-c658-4053-81de-cc7fbb93e7c1. La pantalla de esa PQRS, comprobada con la sesión administradora disponible, muestra solo el archivo válido y Máximo 4 archivo(s) restante(s). La sesión visual residente no estaba activa en esta comprobación; su autorización y contador se verificaron en SQL. Queda cerrado el pendiente específico de limpieza real y recuperación de cupo, no toda la etapa 16. Permanecen el repaso de formularios/API/logs/auditoría y los límites ya documentados de las pruebas por rol.

## Revisión de API y formularios — 2026-10-07
Las siete rutas actuales incluyen tres POST de adjuntos, tres GET de descarga y una plantilla Excel vacía sin datos de usuarios. Adjuntos verifican origen cuando se presenta, usuario, campos, RPC con contexto del actor y bytes; finalización privilegiada revalida al actor. Descargas consultan documents por RLS antes de emitir URL de cinco minutos. Hallazgo corregido: JSON null provocaba acceso a payload.action y error 500 en las tres rutas. readJsonObject rechaza null, arrays y primitivos dentro del manejo 400 existente. Dos regresiones nuevas con Request real; ocho pruebas Node PASS y TypeScript correcto. No cambia RLS, permisos ni UI. Revisión de formularios muestreada (reservas/autenticación): validación servidor y errores genéricos; no equivale a probar todas las acciones. Sin console.* en fuente app/worker durante la búsqueda; eso no acredita los registros hospedados. Auditoría registra eventos desde RPC, pero revisión integral de cobertura y payloads permanece pendiente. No se declara etapa 16 completa.

## Regresión de auditoría de visitas — 2026-10-07
stage16_visit_audit_transaction.sql ejecutado en Supabase con fixtures acotados a Bosques, resultado PASS: permisos y auditoría de visitas, actores y motivos; datos revertidos. Comprueba cuatro eventos para la visita aceptada (requested/authorized/entered/exited), dos para la rechazada, actor correcto, propiedad y motivo de rechazo. Los intentos no autorizados y transiciones inválidas del escenario no añaden eventos exitosos. ROLLBACK revierte registros y rol temporal. No acredita registro de intentos denegados ni todos los flujos de auditoría.

Repaso de formularios: las acciones de PQRS validan UUID, tipo y categoría, límites de asunto/descripción/respuesta y estados admitidos antes de RPC; la autorización no depende de esos campos ni de controles de interfaz, sino de las RPC con auth.uid(). Reservas y asambleas también delegan autorización y transiciones en RPC. Confirmación estática de complete_verified_document: restablece contexto del actor tanto en éxito como en excepción y delega publicación en funciones que emiten eventos de adjuntos. No se detectó un fallo nuevo en este repaso; no se cambió código productivo.

La cobertura funcional demostrada aquí es visitas. Sigue pendiente completar regresiones específicas de auditoría en cartera, reservas, PQRS y asambleas y revisar registros hospedados; etapa 16 continúa abierta. No se confunde revisión de código con pruebas ejecutadas.

## Auditoría: PQRS, obligaciones, reservas y asambleas — 2026-10-07
Tres scripts nuevos ejecutados en Supabase, todos PASS y con ROLLBACK:
- stage16_pqrs_finance_audit_transaction.sql: PQRS creada, respuesta del residente, cambio de estado administrativo; actores, propiedad, categoría/tipo, message_id y transición. Creación y anulación de obligación sintética: monto, unidad, actor y motivo. Residente no puede anular ni cambiar estado; intentos rechazados no agregan eventos de éxito. Se usaron fixtures de Bosques y se revirtieron registros/colas.
- stage16_assembly_audit_transaction.sql: convocatoria creada/publicada, RSVP del residente, cambios de estado y dos registros de asistencia (incluyendo corrección). Verifica actores y metadatos además de las guardas funcionales de la prueba existente; solo asamblea sintética y tablas temporales, todo revertido. Aviso del editor sobre RLS correspondía a CREATE TEMP TABLE; no se alteró RLS de tablas públicas.
- stage16_reservation_audit_transaction.sql: fixtures sintéticos independientes, zona con horarios, solicitud pendiente, aprobación administrativa y cancelación por residente; tres eventos con actores y motivo correctos. Decisión del residente bloqueada. Sin datos de prueba persistentes ni correos enviados.

No se detectó un fallo nuevo en estos escenarios ni se modificó código productivo. La cobertura es explícita: no incluye pagos/aplicaciones/importaciones/anulaciones de pagos, expiración automática de reservas, todas las transiciones, auditoría de cada módulo o inspección de registros hospedados. Etapa 16 permanece abierta para esos límites y consolidación de matriz; la etapa 17 no se inicia por estas regresiones de seguridad.

## Pagos y registros hospedados — revisión de 2026-10-07
stage16_payment_audit_transaction.sql ejecutado en Supabase: payment_balance_permissions_audit_passed_rollback. Fixtures sintéticos: obligación 200000 COP, pago/aplicación de 80000, saldo 120000; duplicado por idempotency_key rechazado, distribución superior al pago y aplicación superior al saldo rechazadas. Residente no puede anular; anulación administrativa restaura saldo 200000. Auditoría payment.recorded/payment.voided con actor, monto, aplicación y motivo; solo un pago y dos eventos para ese pago. ROLLBACK, sin deudas/pagos/avisos sintéticos persistentes ni correos enviados.

Registros hospedados revisados por interfaz: Supabase Unified Logs, Edge Function + Error 5xx, Last 60 minutes, resultado final No results found. Se esperó el resultado filtrado porque la tabla inicialmente conservaba filas 200 de la consulta anterior. Vercel resi-q Logs, Last 30 minutes: cinco líneas GET visibles de módulos con HTTP 200, contadores Warning/Error/Fatal en cero y sin más filas en esa ventana. En las líneas visibles no se mostraron contraseñas ni claves. Esta muestra no acredita ausencia de secretos en todos los metadatos, registros históricos o demás servicios; tampoco confirma entregas de correo.

Sin cambios productivos. La etapa 16 continúa abierta para importaciones financieras, casos restantes y consolidación de la matriz completa del prompt maestro. No se solicitan secretos al usuario ni se descargan registros masivos.

## Importaciones financieras y matriz consolidada — 2026-10-07
stage16_import_audit_transaction.sql ejecutado en Supabase: import_authorization_atomicity_audit_passed_rollback. Comprueba carga administrativa de un lote, vínculo a propiedad/unidad/actor, referencia duplicada rechazada, reversión completa del lote si una fila es inválida, intento del residente rechazado y evento receivable.batch_imported con identificador y número de filas. Fixtures sintéticos y ROLLBACK; no quedaron obligaciones, usuarios ni notificaciones de esta prueba.

Revisión estática del formulario de importación: requirePropertyAdmin precede la lectura del archivo; límites de tamaño/expansión y filas, cabeceras, fechas, montos, referencias y unidades activas de la propiedad se validan antes de RPC. La prueba SQL cubre la RPC y su atomicidad; no simula una carga Excel en el navegador.

### Matriz del alcance revisado
| Punto del prompt maestro | Evidencia disponible | Límite o pendiente |
| --- | --- | --- |
| RLS y multi-tenancy | Catálogo remoto, lectura del residente entre comunidades/anon, suspensión y revocación con rollback | Estado actual y escenarios descritos; no todos los usuarios futuros |
| Roles y permisos | Visitas residente/admin/portería; denegaciones en reservas, cartera, PQRS y archivos | Completar recorrido visual real de administración y portería |
| Archivos | Validación de bytes, publicación privada, cuotas concurrentes, revocación y limpieza real; cupo recuperado | URL firmada existente conserva hasta cinco minutos de validez |
| Formularios y API | Repaso de rutas/acciones, cuerpos JSON no objeto rechazados, límites de Excel, ocho regresiones Node e importación válida por interfaz seguida de anulación (confirmación del usuario) | Recorrido visual de portería pendiente; revisión muestreada de formularios |
| Autenticación | Corrección y regresión de redirecciones; acceso privado comprobado en piloto | No se repitió cada variante de recuperación o proveedor en esta entrega |
| Logs | Muestras hospedadas Vercel y Supabase descritas arriba | Ventanas acotadas; no certifica todo el historial ni metadatos |
| Auditoría | Actores, propiedad, motivos y eventos de visitas, PQRS, reservas, asambleas, obligaciones, pagos e importaciones | No acredita cada transición automática ni cada módulo |
| Intentos no autorizados | Rechazos de RPC y lectura ajena/anon en escenarios documentados | No equivale a una prueba de penetración exhaustiva |

Conclusión: importación financiera verificada sin hallazgo nuevo; entrega de regresiones y matriz lista para revisión. Etapa 16 permanece abierta por los pendientes delimitados de esta tabla; no se inicia etapa 17. La centralización de notificaciones de etapa 15 y la entrega a residentes sin dominio de correo verificado siguen pendientes funcionales separados. Próxima entrega sugerida: recorrido visual por rol y carga Excel sintética en una transacción/entorno descartable, antes de solicitar cierre de etapa 16.

## Recorrido visual de residente — 2026-10-07
Sesión real alejoruizm11 (roles member), comprobada en producción en pestaña independiente para no navegar la del usuario. Dashboard muestra perfil residente y apartamento 101. Cartera muestra una cuenta Torre 1 · 101, sin Importar Excel, nueva obligación, política ni controles de acceso financiero. Abrir directamente /cartera/importar devuelve 404 de aplicación; no expone formulario al residente. Visitas permite Solicitar visita; detalle de solicitud aceptada propia ofrece cancelación con motivo e historial, sin aceptar/rechazar ni registrar ingreso/salida. No se pulsaron acciones de escritura ni se modificaron registros.

Esta comprobación cubre residente y las pantallas indicadas, no una prueba visual de administrador/portería ni el envío de Excel. Para continuar esos escenarios se requiere una sesión administrativa y una cuenta de portería de prueba, manteniendo los roles actuales sin ampliarlos. Captura de cartera residente conservada como evidencia. La matriz anterior sigue vigente con esta cobertura adicional.

## Importación Excel por interfaz administrativa — 2026-10-07
Sesión real Alejo Ruiz, roles administrator, comprobada en /panel. Formulario /cartera/importar accesible con navegación administrativa. Descarga real de plantilla-cartera-resiq.xlsx correcta. Al seleccionarla vacía, alerta Incluye entre 1 y 500 filas de datos y Confirmar importación deshabilitado. Fixture derivado de esa plantilla con encabezados válidos, una fila sintética PRUEBA NO GUARDAR y monto -1: vista previa muestra fila y permite enviar; servidor devuelve Corrige Fila 2 sin redirigir a éxito. Revisión de acción confirma validación completa previa a import_receivables, por lo que este caso no invoca escritura de lote. Sin cambios de permisos ni código productivo.

Evidencia etapa16-excel-rechazo-servidor.png. Esta prueba acredita descarga, selección, vista previa y rechazo servidor; no acredita una importación exitosa por interfaz. La importación exitosa/duplicados/atomicidad ya se verificó por RPC con rollback. Queda pendiente un archivo válido por interfaz en entorno descartable o con un procedimiento de reversión definido, y recorrido visual de portería con su sesión real. No se crean obligaciones en el piloto para simular ese éxito sin preparar la reversión.


## Importación Excel válida por interfaz — 2026-10-08
La sesión administradora importó una fila desde una copia de la plantilla para Torre 1 · 101, con monto 1.000 COP, referencia `RESIQ-PRUEBA-CARTERA-20261008-01`, tipo `obligacion` y vencimiento futuro. La URL mostró `?imported=1`; Alejandro confirmó que luego la cuenta quedó bien en la sección Cartera tras cerrar la prueba. Esta comprobación de pantalla se basa en la confirmación del usuario y no en lectura independiente de la base de datos. La fila se anuló mediante el flujo normal, que deja estado y motivo auditables y encola una notificación al residente; no se comprobó la entrega de ese aviso. El archivo plantilla original no fue alterado. Importación válida de interfaz cerrada; falta el recorrido visual de portería y el resto de la matriz. La etapa 16 no se declara completa.

## Visitas: captura de portería y corrección de horario — 2026-10-08
Evidencia visual del usuario: listado con rol Portería, navegación operativa sin Cartera/PQRS/Miembros y sin crear/aprobar/rechazar visitas; detalle de Laura rechazada con historial y sin registrar movimientos. No se considera comprobado el recorrido positivo de ingreso/salida.

Reporte: rechazo genérico al usar dígitos iguales del documento. La regla vigente acepta 2–6 dígitos repetidos o campo vacío; no se encontró unicidad del sufijo. Hallazgo independiente en createVisit: datetime-local era convertido en la zona del servidor, desplazando cinco horas el horario de Colombia en un servidor UTC. Corrección local: conversión con zona del conjunto consultada en servidor, comprobación de ventana de 24 horas y tolerancia de 15 minutos, errores específicos y campos controlados para conservar datos tras rechazo. Se mantiene la autorización de residente y la RPC/RLS como validación final.

Regresiones: 12 pruebas Node PASS (cuatro nuevas para documento, conversión horaria, horas ambiguas/inexistentes y límites de ventana), typecheck PASS. No hay reproducción del caso exacto en producción ni confirmación de despliegue de esta corrección. Pendiente reintento con horario vigente y dígitos repetidos, aprobación administrativa y recorrido positivo de Portería.

Verificación adicional de la corrección de visitas: lint PASS. La compilación webpack superó compilación, TypeScript y generación de páginas; resultado final de empaquetado aún pendiente al registrar esta nota.

Resultado final: build webpack PASS (páginas generadas y rutas compiladas); test:security 12/12 PASS, typecheck PASS y lint PASS. Corrección aún local, pendiente de publicación y prueba del caso reportado.

2026-10-08: corregida presentación de fechas de Visitas en listado, detalle, movimientos e historial usando properties.timezone. Hallazgo tras reporte 16:45–22:00 mostrado 21:45–03:00 del día siguiente: el formateador omitía timeZone y usaba la zona del servidor. Regresión de ida y vuelta Colombia/UTC cruzando medianoche PASS; 13 pruebas, typecheck y lint PASS. Commit cd16d0f subido a main; sin cambio de datos almacenados. Despliegue en comprobación.

## Recorrido funcional de Portería — 2026-10-08
Alejandro confirmó desde su sesión real de Portería que registró la salida de la visita ca101c5d-30ae-45df-bcee-4d0044376af0 y que el detalle muestra las horas de ingreso y salida. Esta comprobación es testimonio del usuario; no se inspeccionó la sesión ni se leyó la fila remota de visitor_entries de forma independiente porque el acceso automatizado al navegador fue denegado. El flujo positivo de ingreso/salida queda confirmado por usuario. Sigue pendiente ejecutar la regresión transaccional específica del nuevo ingreso fuera del horario de referencia y revisar su auditoría remota antes de cerrar la etapa 16.

## Evidencia visual de Portería aportada por Alejandro — 2026-10-08
La captura del detalle de la visita ca101c5d-30ae-45df-bcee-4d0044376af0 muestra estado «Salió», horario programado 8/10/2026 5:00–8:00 p. m., sección Movimientos con horas de ingreso y salida, e Historial con solicitud creada/aceptada, ingreso y salida. Esto corrobora visualmente el recorrido positivo y las dos horas mostradas; el ingreso ocurrió dentro del horario, por lo que la captura no valida todavía la nueva regla de entrada anticipada o posterior. La prueba transaccional específica permanece preparada y no ejecutada.

## Revisión estática del ingreso fuera de horario — 2026-10-08
Se compararon las migraciones vigentes de visitas, la función `register_visit_entry`, las políticas RLS y las acciones de servidor. Quitar el límite temporal no amplía el rol: la función con `security definer` sigue comprobando membresía activa con rol `concierge` en la propiedad activa; exige `authorized` y bloquea la fila `for update`. Tras el ingreso cambia el estado a `entered`, de modo que un segundo intento no supera la transición. La salida exige rol de portería, estado `entered` y movimiento abierto. `visitors` y `visitor_entries` solo conceden SELECT al navegador, protegido por `private.can_read_visitor`; no se otorgó escritura directa. La auditoría de ingreso registra actor, propiedad, hora real y relación con el horario planificado.

Esta revisión es estática. La captura real de Alejandro acredita el flujo aceptada → dentro → salió en horario, no el ingreso adelantado o tardío. La prueba transaccional `supabase/tests/visit_entry_reference_schedule_transaction.sql` cubre acceso residente denegado, ingreso dos horas antes, ingreso dos horas después, auditoría de hora/actor, rechazo de segundo ingreso, bloqueo de estados no aceptados y salida; está preparada, sin ejecución remota confirmada. Hasta verla pasar no se cierra ese punto de la etapa 16. Por decisión de Alejandro, la entrega de correo a residentes y el dominio de Resend se posponen sin impedir continuar la revisión de seguridad.


## Prueba remota de ingreso fuera de horario — 2026-10-08
Alejandro aportó captura del resultado del SQL Editor: `PASS: ingreso antes/después, rol, hora real, auditoría y movimiento único; datos revertidos`. El script de la prueba contiene BEGIN/ROLLBACK y comprueba ingreso anticipado y tardío con rol de portería, denegación al residente, hora real y relación con la agenda en auditoría, segundo ingreso bloqueado, estados no aceptados bloqueados y salida. La evidencia es el resultado visible de la ejecución del usuario; no se inspeccionaron por separado las filas transitorias. El caso de horario queda cerrado dentro de la etapa 16; otros límites de la matriz siguen abiertos. Correo a residentes pospuesto por decisión de Alejandro hasta contar con dominio verificado.

## Reserva pendiente al vencer — prueba preparada 2026-10-08
Revisión estática: `private.refresh_reservation_states` vence una reserva pendiente con `hold_expires_at <= now()`, libera `blocks_slot`, registra evento, auditoría y aviso; una llamada repetida no debería duplicarlos. La actualización se ejecuta al consultar Reservas mediante `refresh_reservations` y antes de reservar o decidir. No hay evidencia de que un proceso periódico independiente marque el vencimiento sin una interacción; por ello la hora exacta de cambio de estado/notificación puede depender de la próxima operación. La disponibilidad de la zona se refresca antes de crear una reserva. `stage16_reservation_expiration_transaction.sql` prepara un fixture descartable, fuerza el vencimiento, comprueba liberación, auditoría única, decisión tardía rechazada y reutilización del horario; finaliza con ROLLBACK. Aún no ejecutado en Supabase. No involucra dominio de correo ni envíos reales.

## Vencimiento de reservas validado en Supabase — 2026-10-08
Alejandro aportó captura del SQL Editor de producción ResiQ con resultado `reservation_expiration_slot_audit_passed_rollback` para `stage16_reservation_expiration_transaction.sql`. El script usa fixtures sintéticos y `ROLLBACK`. Comprueba que, al invocar `refresh_reservations` con la solicitud vencida, su estado pasa a `expired`, se libera el horario, se escribe un único evento y auditoría, una segunda actualización no duplica el evento, la aprobación tardía se rechaza y puede crearse otra reserva del mismo horario. La evidencia es el resultado mostrado por el editor; no se inspeccionaron por separado las filas transitorias. Este caso de vencimiento al refrescar queda cerrado en la etapa 16. La prueba no demuestra un proceso periódico que cambie el estado en ausencia de lecturas u operaciones; ese comportamiento continúa como límite operativo a decidir antes del cierre general.

## Cron de vencimiento preparado — 2026-10-08
`20261008230000_schedule_reservation_refresh.sql` programa cada minuto `private.refresh_reservation_states` para las propiedades con reservas pendientes ya vencidas o aprobadas cuyo horario terminó. Se reutiliza la transición ya probada, que actualiza estado, libera el horario y registra auditoría y notificación una sola vez. Dos índices parciales limitan la búsqueda a estados relevantes. La migración no crea rutas públicas ni expone una función nueva a usuarios autenticados.

Alejandro ejecutó la migración en el SQL Editor de Supabase y aportó una captura con resultado `schedule = 2`; esto confirma que `cron.schedule` aceptó la definición. Falta comprobar `reservation_refresh_cron_check.sql`: trabajo activo y ejecuciones `succeeded`. Hasta esa verificación no se declara probado el vencimiento periódico en producción. El cambio puede tardar hasta la siguiente ejecución de un minuto; los accesos interactivos siguen refrescando antes de consultar o decidir. La entrega externa de correo permanece diferida hasta verificar el dominio.

Verificación posterior aportada por Alejandro: `reservation_refresh_cron_check.sql` muestra cuatro ejecuciones consecutivas `succeeded` (22:43–22:46 UTC) con `return_message = 0 rows`. Esto confirma que el trabajo programado se ejecuta cada minuto sin error; no había propiedades vencidas que procesar en esas cuatro corridas. La transición de vencimiento, liberación e idempotencia se había comprobado por separado con fixture transaccional y rollback. No se ha observado todavía una expiración real impulsada por cron; queda como límite de la evidencia, no como fallo conocido.

## Consolidación de etapa 16 — 2026-10-08

La matriz anterior era una fotografía del 7 de octubre. Estado actualizado tras las pruebas posteriores:

| Área | Evidencia cerrada | Límite vigente |
| --- | --- | --- |
| RLS y aislamiento | Catálogo SQL, lectura anónima y entre propiedades, suspensión y revocación con rollback | Pruebas de escenario, no demostración formal de toda combinación futura |
| Roles y permisos | Residente, administrador y Portería revisados con sesiones reales o capturas; denegaciones SQL en módulos sensibles | La revisión visual no sustituye pruebas de todas las rutas directas |
| Archivos | Storage real, revocación de lectura, cuota concurrente, limpieza de rechazados y recuperación del cupo | Enlaces firmados ya emitidos conservan hasta cinco minutos de vigencia |
| Formularios y API | Revisión de rutas, cuerpos JSON inválidos, límites de Excel e importación válida con anulación posterior | Formularios revisados por muestra; faltan variantes completas de interacción |
| Autenticación | Redirección local segura, acceso privado e invitación por correo/contraseña o Google | No hay flujo de recuperación de contraseña en la app; entrega de correo diferida por dominio |
| Multi-tenancy | Lectura ajena y anónima denegada; referencias compuestas y RLS comprobadas en catálogo | La cobertura remota corresponde al piloto y fixtures indicados |
| Logs | Muestras hospedadas de Vercel y Supabase sin errores en ventanas acotadas | No certifica todo el historial ni metadatos |
| Auditoría | Regresiones transaccionales de visitas, PQRS, asambleas, reservas, cartera, pagos e importaciones | No cubre cada transición automática; cron ejecuta, pero sin expiración real observada |
| Operación periódica | Cron de reservas con cuatro ejecuciones consecutivas `succeeded`; transición de vencimiento validada con rollback | `0 rows` no acredita una expiración real por cron |

`npm.cmd run test:security` pasó 13/13 regresiones locales el 8 de octubre; aparecieron advertencias informativas de Node sobre type stripping y detección de módulos, sin fallos. No se cambió código productivo en esta consolidación. La etapa 16 permanece abierta para decidir la recuperación de contraseña con correo verificado y, si se exige evidencia de extremo a extremo del cron, observar una expiración real controlada. La etapa 17 no se inicia sin aprobación de Alejandro.

## Acciones del servidor y prueba del cron aplazada — 2026-10-08

Alejandro pospuso la prueba de una expiración real causada por cron; queda anotada para una sesión posterior. Las cuatro ejecuciones `succeeded` y la regresión transaccional siguen siendo la evidencia actual, sin presentar la prueba diferida como realizada.

Repaso estático de las nueve unidades `actions.ts`: 46 llamadas RPC distintas, todas con definición en las migraciones. Los cambios de datos de negocio pasan por esas RPC; la única actualización directa observada en las acciones es el nombre del perfil propio, filtrado por `user.id` y protegido por `profiles_update_own`. La lectura directa adicional de unidades en la importación Excel ocurre después de `requirePropertyAdmin` y filtra por propiedad. `createClient` usa la clave publicable y las cookies de la sesión, no una clave de servicio. Este inventario no demuestra por sí solo que cada rama interna de las 46 RPC sea correcta; las regresiones por módulo y el catálogo remoto documentados arriba aportan la comprobación de escenarios y permisos. No se encontró una escritura de negocio directa desde estas acciones ni se modificó código productivo.
