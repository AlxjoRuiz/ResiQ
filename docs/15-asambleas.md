# Etapa 14 — Asambleas

## 1. Objetivo

Implementar convocatorias de asamblea privadas por propiedad, con agenda, documentos, confirmación de asistencia, registro de presencia, representación y notificaciones por correo. La solución conservará evidencia y trazabilidad sin interpretar automáticamente reglas legales de voto, coeficientes, quórum o mayorías.

## 2. Alcance de esta etapa

Incluye:

- Creación administrativa de asambleas ordinarias y extraordinarias.
- Publicación para una audiencia explícita.
- Orden del día ordenado y auditable.
- Documentos privados de convocatoria, soporte y acta.
- Respuesta `Asistiré` o `No asistiré` por cada convocado.
- Registro administrativo de asistencia efectiva.
- Registro y validación de representación con evidencia.
- Correos de convocatoria, cambios, cancelación y recordatorios.
- Historial funcional y auditoría.

No incluye votación electrónica, padrón electoral, coeficientes, quórum, mayorías, resultados vinculantes ni interpretación jurídica automática.

## 3. Propuesta para P09

### 3.1 Convocatoria y audiencia

1. La asamblea se crea inicialmente como borrador mediante `status = scheduled` y `published_at = null`.
2. Administración selecciona destinatarios explícitos entre miembros activos de la propiedad. Cada destinatario conserva el contexto de la unidad con la que fue convocado.
3. El sistema muestra una revisión de cobertura por apartamentos antes de publicar, pero no decide quién tiene derecho legal a voz o voto.
4. Publicar congela la lista inicial de convocados y crea notificaciones y correos individuales. Las altas o retiros posteriores se realizan mediante operaciones auditadas; no se sobrescribe silenciosamente la convocatoria original.
5. Un miembro que pierde su vínculo deja de tener acceso operativo, conforme a P06. Administración conserva el expediente para auditoría.

### 3.2 Confirmación y asistencia

1. Cada convocado puede responder `yes` o `no`; el valor inicial es `pending`.
2. La respuesta puede cambiarse hasta `starts_at`. La administración puede corregirla después solo con motivo obligatorio y auditoría.
3. RSVP no registra asistencia, representación, voto, coeficiente ni quórum.
4. La asistencia efectiva la registra administración durante la asamblea. Toda corrección posterior exige motivo y genera actividad y auditoría.
5. La lista de asistentes no es pública para los demás residentes.

### 3.3 Representación

1. Una representación corresponde a una asamblea, una unidad y un otorgante identificado.
2. El representante puede ser otro miembro activo de la propiedad o una persona externa identificada por nombre. Un representante externo no recibe cuenta ni acceso a ResiQ.
3. Se permite una representación activa por otorgante, unidad y asamblea. Copropietarios distintos de la misma unidad pueden registrar expedientes separados; el sistema no consolida derechos legales.
4. La solicitud requiere evidencia privada. Se aceptan PDF, JPG y PNG, máximo 10 MB por archivo y hasta cinco archivos, conforme a P10.
5. Administración valida, rechaza o revoca con nota obligatoria. La evidencia no es visible para otros asistentes.
6. Una representación validada solo documenta el poder; no concede automáticamente voto, coeficiente, quórum ni mayoría.

### 3.4 Conservación de evidencia

1. Convocatoria, agenda publicada, soportes, poderes y acta se almacenan en Supabase Storage privado.
2. Los enlaces firmados vencen en cinco minutos.
3. Los documentos se conservan durante cinco años, según P10. Antes de producción se requiere respaldo de Supabase y copia externa.
4. Los archivos publicados no se reemplazan físicamente. Una corrección crea una nueva versión y conserva la anterior para administración y auditoría.
5. El acta puede publicarse después de finalizar la asamblea sin crear resultados de votación dentro de esta etapa.

### 3.5 Recordatorios

1. Al publicar se envía `assembly_published` a cada convocado.
2. Se programan recordatorios idempotentes siete días y veinticuatro horas antes, únicamente cuando esas fechas aún sean futuras.
3. Cambios relevantes de fecha, hora, lugar o cancelación generan un aviso nuevo y auditable.
4. No se envían listas visibles de destinatarios ni correos grupales con direcciones expuestas.

## 4. Estados y transiciones

```text
Borrador derivado: scheduled + published_at nulo

Borrador → Programada publicada → En curso → Finalizada
                              └──────→ Cancelada
```

- **Borrador:** editable por administración; invisible para residentes.
- **Programada:** publicada para convocados; los cambios relevantes generan versión, actividad y notificación.
- **En curso:** agenda y audiencia quedan bloqueadas; administración registra asistencia.
- **Finalizada:** permite publicar acta y consultar el expediente; no crea resultados electorales.
- **Cancelada:** exige motivo, conserva todo el historial y notifica a los convocados.

No existe eliminación física desde la aplicación.

## 5. Modelo previsto

### `assemblies`

Mantiene tipo, título, inicio, lugar, descripción, estado, creador, publicación, límite de RSVP, finalización y cancelación. Todas las filas llevan `property_id`.

### `assembly_agenda`

Puntos con posición única dentro de la asamblea. El reordenamiento es atómico. Después de iniciar queda bloqueada.

### `assembly_attendees`

Convocado explícito, unidad de contexto, RSVP, respuesta, asistencia efectiva y actor que registró la presencia. RSVP y asistencia permanecen separados.

### `assembly_representations`

Otorgante, unidad, representante miembro o externo, estado de validación, notas y responsable administrativo. No contiene campos de voto ni coeficiente.

### Extensiones transversales

- `documents`: padres `assembly_id` o `representation_id`, tipo documental y versión.
- `notifications`, `email_jobs` y `email_logs`: plantillas de asamblea y recordatorios idempotentes.
- `activity_events` y `audit_logs`: publicación, cambios, RSVP, asistencia, representación, cancelación y cierre.

La arquitectura conserva IDs estables para una futura etapa de votaciones, pero no crea tablas de preguntas, opciones, padrón, votos, resultados o quórum.

## 6. Operaciones seguras

- `create_assembly`: solo administración activa de la propiedad.
- `publish_assembly`: valida campos obligatorios, agenda, audiencia explícita y fecha futura; crea avisos en una transacción.
- `update_assembly`: en borrador permite edición; publicada limita campos y notifica cambios relevantes.
- `change_assembly_status`: aplica únicamente transiciones permitidas y exige motivo al cancelar.
- `set_assembly_rsvp`: deriva al miembro desde `auth.uid()` y modifica solo su convocatoria.
- `record_assembly_attendance`: solo administración; registra actor, fecha y motivo de corrección cuando corresponda.
- `submit_assembly_representation`: valida otorgante, unidad, asamblea y representante; no habilita voto.
- `review_assembly_representation`: solo administración; valida, rechaza o revoca con nota.
- Carga y descarga de documentos reutilizan Storage privado, firma de archivo, límites reales y enlaces firmados de cinco minutos.

Las tablas operativas no conceden escrituras directas a `authenticated`; las mutaciones pasan por RPC auditadas y RLS deniega por defecto.

## 7. Interfaz propuesta

### Administración

- `/panel/propiedades/[propertyId]/asambleas`: próximas, en curso, finalizadas y canceladas.
- `/panel/propiedades/[propertyId]/asambleas/nueva`: datos, agenda, audiencia y revisión antes de publicar.
- Detalle administrativo: resumen, agenda, documentos, convocados, RSVP, asistencia, representaciones, entrega de correos e historial.

### Residente o propietario

- `/panel/asambleas`: asambleas publicadas en las que está convocado.
- Detalle privado: información, agenda, documentos autorizados, RSVP propio y representación relacionada.
- No se muestran otros asistentes, poderes ajenos ni destinatarios de correo.

Portería no obtiene acceso al módulo en esta etapa.

## 8. Pruebas de aceptación

- Administración crea un borrador, agenda y audiencia explícita de su propiedad.
- No se publica sin título, tipo, fecha futura, lugar, agenda o convocados.
- Un usuario de otra propiedad y un miembro no convocado reciben cero datos.
- Un convocado cambia únicamente su RSVP antes del inicio; no puede marcar asistencia.
- RSVP `yes` no establece `attended_at` ni genera derechos electorales.
- Administración registra asistencia con actor y fecha; una corrección deja auditoría.
- La representación exige otorgante y exactamente un representante miembro o externo.
- Poderes y documentos privados no se descargan conociendo UUID o ruta sin autorización.
- Publicación, cambio relevante, cancelación y recordatorios generan correos individuales idempotentes.
- Las transiciones inválidas, regresiones y eliminación física se rechazan.
- No existen columnas o tablas que calculen votos, coeficientes, quórum, mayorías o resultados.
- TypeScript, ESLint, compilación, Deno, pruebas RLS y prueba transaccional remota finalizan correctamente.

## 9. Decisiones solicitadas

Para implementar la etapa 14 se requiere aprobar P09 con estas decisiones:

1. Audiencia explícita seleccionada por administración y revisión de cobertura por unidades, sin inferir derecho legal.
2. RSVP modificable hasta el inicio y separado de asistencia efectiva.
3. Asistencia registrada por administración, con correcciones auditadas.
4. Una representación activa por otorgante, unidad y asamblea; copropietarios pueden tener expedientes separados.
5. Evidencia obligatoria y privada para representación, con límites y retención de P10.
6. Recordatorios automáticos siete días y veinticuatro horas antes.
7. Documentos publicados versionados, sin sobrescritura física.
8. Votación, coeficientes, quórum, mayorías y resultados fuera de alcance.

El usuario aprobó explícitamente P09 con «si dale, me parece bien» el 2026-10-05.

## 10. Implementación entregada

- Migraciones `20261005190000_assemblies.sql` y `20261005200000_fix_assembly_required_notes.sql` aplicadas al proyecto Supabase ResiQ.
- Tablas con RLS: `assemblies`, `assembly_agenda`, `assembly_attendees` y `assembly_representations`.
- Operaciones RPC para borrador, publicación, cambios relevantes, estados, RSVP, asistencia, representación y documentos.
- Convocatoria individual y recordatorios idempotentes a siete días y veinticuatro horas en `email_jobs`.
- Worker `process-email-jobs` desplegado con plantillas de publicación, recordatorio, cambio y cancelación.
- Documentos privados versionados para convocatoria, soportes, acta y evidencias de representación; enlaces firmados por cinco minutos.
- Rutas administrativas y privadas por propiedad, más `/panel/asambleas` para la vista consolidada del residente.
- Prueba transaccional en `supabase/tests/assemblies_transactional.sql` con rollback completo.

## 11. Verificación

- TypeScript y ESLint finalizaron correctamente.
- La compilación de producción con Webpack finalizó correctamente usando una carpeta aislada, porque el servidor de desarrollo mantenía `.next` abierto.
- La prueba remota terminó con `stage14_transactional_checks_passed` y confirmó publicación, tres correos programados, RSVP, RLS, representación sin evidencia rechazada, asistencia, corrección con nota y cierre.
- La prueba detectó y permitió corregir la validación SQL de notas `NULL` antes del cierre técnico.

La etapa 14 queda técnicamente completa y pendiente de aprobación funcional del usuario antes de iniciar la etapa 15.
