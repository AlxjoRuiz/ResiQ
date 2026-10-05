# Etapa 13 — Llamados de atención

## Estado

Diseño aprobado e implementación completada el 2026-10-05. La etapa queda técnicamente validada y pendiente de aprobación explícita para cerrarla antes de iniciar la etapa 14.

## 1. Objetivo

Permitir que la administración registre llamados de atención privados para uno o varios miembros vinculados a un apartamento, adjunte evidencias, controle el estado del caso y notifique a cada destinatario. Cada destinatario podrá consultar únicamente los llamados dirigidos expresamente a su membresía vigente.

El módulo no impondrá multas, sanciones económicas, restricciones de servicios ni consecuencias legales automáticas. Tampoco sustituirá un proceso disciplinario o jurídico definido por cada propiedad.

## 2. Alcance propuesto

### Administración

- Crear un llamado seleccionando propiedad, apartamento y uno o varios destinatarios vigentes de esa unidad.
- Registrar categoría, motivo, descripción, fecha de emisión y administrador responsable.
- Adjuntar hasta cinco evidencias privadas en PDF, JPG o PNG, con máximo 10 MB por archivo, según P10.
- Consultar y filtrar por apartamento, destinatario, categoría, estado y fecha.
- Cambiar el estado mediante transiciones controladas y cerrar con una nota de cierre obligatoria.
- Consultar lectura por destinatario y estado operativo del correo sin exponer detalles técnicos innecesarios.

### Destinatario

- Consultar únicamente los llamados donde figure como destinatario explícito y conserve un vínculo vigente con la unidad.
- Abrir el detalle, consultar evidencias disponibles y marcar automáticamente su registro como leído.
- No editar el llamado, cambiar el estado, agregar destinatarios ni consultar llamados de otros ocupantes.

### Fuera de alcance

- Descargos o conversación dentro del llamado.
- Firma digital, aceptación de responsabilidad o acuse con valor jurídico.
- Multas, cobros, puntos, reincidencia automática o integración con cartera.
- Acceso para portería o superadministración de plataforma.
- Envíos por WhatsApp o SMS.

## 3. Datos y privacidad

- `attention_calls`: propiedad, unidad, categoría, motivo, descripción, fecha de emisión, responsable, estado, nota y fecha de cierre, creación y actualización.
- `attention_call_recipients`: llamado, miembro destinatario y fecha de lectura.
- `documents`: se amplía la tabla existente con un padre `attention_call_id`; los archivos continúan en el bucket privado `private-documents`.
- `activity_events`: se amplía con `attention_call_id` para registrar creación, notificación, paso a revisión, lectura y cierre.
- `notifications`, `email_jobs` y `email_logs`: se reutilizan con plantillas y claves de deduplicación del módulo.

El apartamento organiza el expediente, pero no concede visibilidad a todos sus ocupantes. La lectura depende de aparecer en `attention_call_recipients`, tener membresía activa en la propiedad y conservar un vínculo vigente con esa unidad. Un nuevo ocupante no hereda llamados de personas anteriores.

La administración de la propiedad puede consultar el expediente. Portería, miembros no destinatarios y superadministración de plataforma reciben cero filas, archivos, conteos y resultados de búsqueda.

## 4. Categorías y contenido

Para el MVP se propone un catálogo cerrado y estable:

- Convivencia
- Ruido
- Mascotas
- Residuos
- Uso de zonas comunes
- Seguridad
- Parqueaderos
- Incumplimiento administrativo
- Otro

La categoría `Otro` exige un motivo claro. El motivo tendrá entre 4 y 180 caracteres y la descripción entre 10 y 5.000. Todo contenido se mostrará como texto escapado; no se admite HTML arbitrario.

## 5. Estados y transiciones

```text
Creado → Notificado → En revisión → Cerrado
```

- **Creado:** el expediente y sus destinatarios existen; se crean las notificaciones internas y los trabajos de correo.
- **Notificado:** todos los destinatarios continúan autorizados y el proveedor aceptó el correo de cada uno. Los fallos permanecen reintentables y no se ocultan.
- **En revisión:** la administración registra que el caso está siendo atendido. La lectura del destinatario por sí sola no cambia este estado.
- **Cerrado:** estado final; requiere una nota de cierre de 4 a 1.000 caracteres y registra actor y fecha.

No se permiten saltos hacia atrás, edición del contenido emitido ni eliminación física desde la aplicación. Si un llamado se creó por error, la administración lo cierra con una nota explicativa y queda la auditoría completa.

## 6. Operaciones seguras

- `create_attention_call`: valida administrador, unidad activa, responsable, destinatarios vigentes y relación de cada destinatario con la unidad; crea llamado, destinatarios, actividad, auditoría, notificaciones y trabajos de correo en una transacción.
- `change_attention_call_status`: aplica únicamente transiciones válidas, registra actor, nota y actividad.
- `mark_attention_call_read`: deriva al destinatario desde `auth.uid()`, actualiza solo su fila y es idempotente.
- Preparación, validación y descarga de evidencia: reutiliza el flujo de documentos privados con autorización sobre el llamado, ruta generada por el sistema, firma de archivo, límite real y enlace firmado de cinco minutos.
- El trabajador de correo actualiza a `notified` únicamente después de verificar que todos los destinatarios autorizados tengan entrega aceptada por el proveedor.

Las tablas no concederán escrituras directas a `authenticated`; las mutaciones pasarán por RPC con auditoría. RLS y privilegios denegarán acceso por defecto.

## 7. Interfaz propuesta

### Administración

- Ruta `/panel/propiedades/[propertyId]/llamados` con métricas pequeñas, filtros y tabla.
- Ruta `/panel/propiedades/[propertyId]/llamados/nuevo` con selección dependiente de apartamento y destinatarios.
- Detalle con datos del caso, destinatarios, lectura, evidencias, historial y acciones de estado.

### Residente o propietario

- Ruta `/panel/llamados` con tarjetas o tabla optimizada para móvil.
- Detalle privado con estado, motivo, descripción, fecha, administrador responsable y evidencias autorizadas.
- Indicador de no leído en dashboard y navegación.

## 8. Pruebas de aceptación

- Un administrador crea un llamado con uno o varios destinatarios vigentes de la misma unidad.
- Se rechazan destinatarios de otra propiedad, otra unidad, vínculo vencido o rol no permitido.
- Otro ocupante de la unidad, portería y un usuario de otra propiedad reciben cero datos y no descargan evidencias aunque conozcan el UUID o la ruta.
- El destinatario puede leer su llamado y marcar solo su propia fila como leída.
- El estado respeta la secuencia y el cierre exige nota; no hay regresiones ni borrado de historial.
- El estado `notified` no se establece antes de la aceptación de todos los correos requeridos.
- Archivos inválidos, de tipo falso, mayores de 10 MB o por encima de cinco se rechazan.
- Cambiar o terminar el vínculo elimina inmediatamente el acceso histórico operativo.
- Creación y cambios generan actividad y auditoría; los reintentos no duplican avisos ni correos.
- TypeScript, ESLint, compilación, Deno, pruebas RLS y prueba transaccional remota finalizan correctamente.

## 9. Decisiones para aprobación

1. Usar el catálogo cerrado de nueve categorías propuesto.
2. Permitir uno o varios destinatarios explícitos, todos vinculados vigentemente al apartamento.
3. Mantener el flujo lineal `created → notified → in_review → closed`, sin retrocesos.
4. Exigir nota al cerrar y conservar el registro sin eliminación desde la aplicación.
5. Mantener descargos, multas y consecuencias jurídicas fuera de esta etapa.

## 10. Implementación y validación

- Se aplicó `20261003100000_attention_calls.sql` en Supabase con tablas, destinatarios explícitos, RLS, RPC, evidencias privadas, actividad, auditoría, notificaciones y cola de correo.
- Se añadieron listados y detalle por rol, creación administrativa, lectura del destinatario, evidencias y transiciones controladas.
- La prueba remota con `ROLLBACK` validó creación, rechazo de destinatario inválido, privacidad del destinatario y de una identidad ajena, preparación y rechazo de evidencia, lectura, aceptación del correo, secuencia de estados, cierre y actividad. No dejó datos de prueba.
- TypeScript, ESLint, compilación de producción y `deno check` finalizaron correctamente.
- `process-email-jobs` quedó desplegada con el formato vigente de Supabase y con la validación JWT heredada desactivada. El endpoint rechazó una llamada sin `x-worker-secret` con HTTP 401.
- Los secretos `EMAIL_WORKER_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` y `APP_URL` están configurados en Edge Functions Secrets; `project_url` y `email_worker_secret` permanecen cifrados en Vault. La función rechaza llamadas sin el secreto con HTTP 401.
- Una entrega controlada fue aceptada por Resend y quedó registrada en `email_jobs` y `email_logs`. El remitente de prueba solo permite el correo propietario de la cuenta; para otros destinatarios se requiere verificar un dominio.
- `20261005153000_schedule_email_worker.sql` habilita `pg_cron` y `pg_net` y ejecuta el worker cada minuto. Dos ejecuciones automáticas terminaron en `succeeded`, llamaron la función con HTTP 200 y encontraron la cola vacía después de la entrega.

## 11. Siguiente paso

La etapa 13 quedó técnicamente completa y pendiente de aprobación explícita. Antes de producción se debe verificar un dominio propio en Resend y sustituir el remitente de prueba. No iniciar la etapa 14 de asambleas sin una nueva aprobación.
