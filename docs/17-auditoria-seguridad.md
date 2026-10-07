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
