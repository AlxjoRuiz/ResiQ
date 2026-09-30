# Etapa 3 — Seguridad

Estado: aprobado por el usuario con «aprobado sigamos». Fecha: 2026-09-28. Este documento registra el diseño aprobado en la etapa 3; en ese momento todavía no había SQL, políticas ejecutadas ni aplicación inicializada. La etapa 5 ya implementó y verificó el subconjunto de autenticación, perfiles, membresías e invitaciones. El resto de la matriz continúa pendiente de sus etapas funcionales y de la auditoría integral de la etapa 16.

## 1. Objetivo

Especificar permisos, RLS, rutas, operaciones de negocio y acceso a Storage. Aislar propiedades y datos personales dentro de cada propiedad. Preparar escenarios verificables con las dos propiedades ficticias de veinte apartamentos.

## 2. Decisiones y límites de confianza

### Identidad y autorización

La identidad se obtiene de una sesión Supabase verificada, nunca de user_id, email, roles o property_id enviados por el cliente. La propiedad elegida en ruta es un parámetro no confiable. auth.uid() identifica al actor en base de datos; la membresía y su vigencia se consultan en tablas, no en user_metadata editable ni en roles antiguos del token.

Una sesión válida sin membresía solo permite editar el perfil propio y canjear una invitación válida. No permite consultar datos operativos. Se comprueba el estado operativo de la propiedad además de la membresía. Suspendida/archivada: no acceso operativo por defecto; la pantalla de estado muestra solo información mínima a miembros y plataforma. Cualquier excepción posterior deberá definirse expresamente.

En solicitudes nuevas, una membresía revocada deja de autorizar. Una operación ya iniciada se resuelve según sus bloqueos y orden transaccional; no prometer revocación retroactiva. Archivos descargados, correos enviados y enlaces firmados emitidos no pueden hacerse desaparecer con una revocación.

### Roles

- Superadmin: gestión de propiedades, administradores iniciales, planes y métricas operativas agregadas. Sin lectura de PQRS, cartera, llamados ni archivos privados.
- Administrador: permisos operativos de su propiedad. No administra platform_admins, secretos ni planes comerciales.
- Portería: paquetes, visitas y movimientos; agenda de reservas y directorio mínimo.
- Miembro: capacidades por autoría, destinatario, convocatoria y vínculo vigente con unidad.
- Propietario/residente: tipos de vínculo, no permisos globales. Ser propietario de A no da derechos en B.

Si hay varios roles activos en una misma propiedad, se combinan sus permisos autorizados; se audita el actor real. Cambiar de vista no elimina privilegios ya concedidos ni crea otros. No usar selección de rol del navegador como control.

### Reglas P02/P06/P08

Se propone un comportamiento conservador mientras se aclaran reglas de negocio:

- Cartera: solo vínculo vigente con finance_access concedido explícitamente por administración. No autoasignar por ser residente o propietario. La política definitiva de quién debe recibirlo continúa pendiente P02.
- Mudanza: P06 aprobada el 2026-09-30. Un vínculo vencido deja de permitir operaciones y datos de esa unidad, incluidos históricos, aunque la persona siga siendo miembro de otra unidad. Administración conserva el registro para auditoría y retención.
- PQRS/llamados: autor o destinatario explícito, no todo el apartamento. Se requiere membresía y vínculo vigente con la unidad para acceso operativo del miembro.
- Paquetes: destinatario explícito y vinculado. Si no hay miembro destinatario, visible solo a administración/portería hasta vincularlo mediante operación autorizada. Compartir entre ocupantes pendiente P08.

Estas restricciones permiten avanzar en diseño; no se presentan como decisiones de negocio ya respondidas. Antes de habilitar los flujos correspondientes se cerrarán con el usuario.

## 3. Predicados de autorización

Nombres descriptivos, no funciones SQL creadas:

| Predicado | Condición |
|---|---|
| identidad_actual | Token/sesión verificados, uid no nulo |
| miembro_activo(P) | Perfil actual tiene property_members activa en P y P operativa |
| administrador(P) | miembro_activo(P) con rol administrator |
| porteria(P) | miembro_activo(P) con rol concierge |
| vinculo_actual(P,U) | Membresía propia y unit_memberships de U con valid_from <= ahora y valid_to nulo o > ahora |
| acceso_financiero(P,U) | administrador(P), o vinculo_actual(P,U) con finance_access autorizado |
| autor(P,R) | miembro_activo(P), autor/requester/host del registro y vínculo vigente con su unidad |
| destinatario(P,R) | miembro_activo(P), destinatario explícito y vínculo requerido con unidad |
| convocado(P,A) | miembro_activo(P) e invitación individual en assembly_attendees |
| plataforma | Usuario actual en platform_admins activo; no equivale a administrador(P) |

Helpers de membresía no deben consultar tablas cuya política vuelva a invocarlos en un ciclo. Lecturas mínimas de autorización podrán usar helpers privados SECURITY DEFINER que devuelvan solo booleanos/ID del miembro actual. Tendrán search_path fijo vacío, objetos cualificados y propietario controlado. Un propietario sin bypass sobre una tabla con política recursiva NO resuelve por sí solo la recursión: verificarlo con pruebas de integración y privilegios reales.

No aceptar user_id arbitrario en helpers públicos. No exponer roles privilegiados ni helpers privados como RPC de propósito general. Limitar EXECUTE, revocando concesiones por defecto a PUBLIC/anon. Un helper que deba evaluar la política para authenticated recibe solo el permiso mínimo necesario y no devuelve datos privados.

## 4. Matriz RLS y operaciones por tabla

### Regla común de escritura

Propuesta para evitar eludir validaciones transaccionales: authenticated no recibe INSERT/UPDATE/DELETE directo en tablas de negocio. Las escrituras se realizan mediante operaciones específicas autorizadas en base de datos, expuestas únicamente cuando corresponda. No API genérica que reciba nombre de tabla, SQL o actor.

Las operaciones privilegiadas verifican identidad, propiedad, rol, vínculo y estado dentro de la transacción. Las SECURITY DEFINER necesarias usan privilegios restringidos y acceso a tablas concretas; no confiar en RLS si su propietario puede omitirla. Se usan restricciones/FK como segunda defensa y pruebas de llamada directa a RPC como criterio obligatorio.

Para lecturas ordinarias se conserva la sesión del usuario y RLS. Tablas que contienen columnas con distinta audiencia no se exponen completas: proyección autorizada explícita o función con lista fija de columnas. Una vista por sí sola no concede permisos ni elimina necesidad de RLS. Preferir vistas security_invoker donde corresponda.

En la siguiente tabla, SELECT indica quién puede obtener datos y por qué superficie. Todas las mutaciones son operaciones controladas; DELETE directo siempre denegado. Los procesos internos no tienen permiso universal implícito.

| Tabla | SELECT permitido | Operaciones de escritura autorizadas |
|---|---|---|
| profiles | Propio; A/G solo directorio mínimo de P mediante proyección | Usuario edita nombre/avatar propios; alta por proceso Auth |
| platform_admins | Propio estado mínimo; gestión fuera de interfaz ordinaria | Proceso de plataforma restringido; sin autoalta |
| properties | Miembros propia P; plataforma datos SaaS | Plataforma crea/suspende; A cambia solo nombre/dirección/configuración autorizada |
| property_members | Propio; A miembros de P; G proyección operativa | A gestiona member/concierge; designación de administrator por plataforma; sin autoescalación |
| buildings | Miembros activos de P | A crea/actualiza/desactiva |
| units | A/G de P; miembro unidades vinculadas | A crea/actualiza/desactiva |
| unit_memberships | Propios; A de P; G proyección de ocupantes vigentes | A vincula/termina vínculo y concede finanzas explícitamente |
| invitations | A proyección sin token_hash; destinatario no lista | A invita member/concierge, revoca; plataforma invita administrador; destinatario canjea |
| property_policies | A completa; miembros/G configuración operativa mínima | A cambia opciones autorizadas y auditadas |
| amenities | Miembros/G/A de P | A crea/actualiza/desactiva |
| amenity_hours | Hereda zona de P | A configura horarios |
| amenity_blackouts | A completo; miembros/G cierre sin notas sensibles | A crea/cancela cierre y resuelve reservas afectadas |
| reservations | A completo; autor propia; G agenda mínima; miembros solo disponibilidad anónima | Miembro crea/cancela propia; A decide; sistema expira |
| pqrs | A y autor con vínculo actual | Autor crea; A asigna/cambia estado; contenido enviado no editable libremente |
| pqrs_messages | Hereda PQRS | Autor/A responden, identidad derivada; no editar mensajes enviados |
| packages | A/G; destinatario autorizado | A/G registra y entrega; sistema marca notificación sin retroceder entrega |
| visitors | A/G proyección operativa; anfitrión propio | Anfitrión autoriza/cancela; A/G registra con autorización comprobada |
| visitor_entries | Hereda visita, sin datos extra de documentos | A/G abre/cierra movimiento, sin reescribir historial |
| accounts_receivable | acceso_financiero(P,U) | A registra/anula obligaciones con auditoría |
| payments | acceso_financiero(P,U) | A registra/anula pagos; sin autoacreditación por residente |
| payment_allocations | acceso_financiero(P,U) | A distribuye/reajusta en transacción con bloqueo |
| attention_calls | A y destinatario con vínculo vigente | A crea/cambia estado |
| attention_call_recipients | A y propio destinatario | A asigna; destinatario solo marca leído |
| assemblies | A; convocado para publicadas | A crea/publica/cambia estado |
| assembly_agenda | Hereda asamblea | A gestiona orden del día |
| assembly_attendees | A y miembro sobre registro propio | A convoca/registra presencia; miembro cambia solo RSVP propio |
| assembly_representations | A; otorgante o representante miembro autorizado de P | A registra/valida/rechaza/revoca según reglas pendientes |
| announcements | A todos; miembros activos publicados | A redacta/publica/archiva |
| documents | Usuario autorizado al padre y status available; cargador solo estado de su pending | Operación de carga y proceso de inspección; sin cambio de padre ni publicación arbitraria |
| notifications | Destinatario activo propio | Proceso crea; destinatario marca leído sin modificar contenido/objetivo |
| email_jobs | Solo proceso de correo; A resumen autorizado | Proceso encola/reclama/reintenta/cancela según permisos del evento |
| email_logs | Proceso; A proyección de entrega de sus módulos | Procesador añade intento; webhook verificado actualiza resultado |
| activity_events | Permiso del padre y proyección según audiencia | Operación de negocio añade; nadie edita/borra desde app |
| audit_logs | A eventos autorizados de P; plataforma solo globales | Mecanismo interno registra; sin edición/borrado aplicativo |
| plans | Plataforma; A proyección de su plan | Plataforma, diferido a etapa 20 |
| property_plan_assignments | Plataforma; A plan de P | Plataforma, diferido a etapa 20 |

Tablas con funciones de lectura privilegiada siguen con RLS y sin SELECT base para roles que no deban verlas. No crear una política permisiva para authenticated solo para hacer funcionar una proyección.

### Semántica de políticas

- SELECT: USING comprueba identidad y autorización sobre cada fila existente.
- Si en implementación se justifica conceder INSERT directo, WITH CHECK debe validar propiedad, actor y padres; se requiere revisar este diseño, no abrirlo como solución rápida.
- UPDATE directo permanece denegado. Si se habilitara excepcionalmente, necesita USING sobre fila original y WITH CHECK sobre resultado, más inmutabilidad de property_id, autor y padres protegidos.
- No política FOR ALL abierta. Varias políticas permisivas se combinan y pueden ampliar acceso: revisar la unión efectiva, no solo cada política aislada.
- RLS no sustituye privilegios de tabla/columna, FK compuestas ni restricciones de estados. No protege frente a propietario/bypass/credencial de servicio: no usar esos contextos para pruebas de residentes.

## 5. Contratos de operaciones sensibles

### Invitaciones y administradores

1. Crear invitación requiere A de P; roles member/concierge limitados. Administradores iniciales y cambios de rol administrator quedan reservados a plataforma mediante operación explícita. La plataforma no puede usar esa operación para darse acceso silencioso a sí misma; rechazar autoasignación como administrador de propiedad.
2. Token aleatorio de alta entropía, hash en invitations. Límite de vigencia y tasa configurable; parámetros exactos se fijan antes de etapa 5.
3. Para correo asíncrono, el secreto necesario se guarda solo cifrado en un payload protegido de email_jobs, con clave separada del almacén. Ni token ni enlace con token en logs, historial o respuestas administrativas. Añadir este detalle de almacenamiento al modelo antes de implementar el envío, sin tabla nueva.
4. Canje autenticado: obtener email verificado desde Auth, comparar con invitación normalizada, revisar vencimiento, revocación, propiedad y roles autorizados del invitador.
5. Bloquear invitación, crear/vincular membresía y unidad válidas, marcar aceptación y auditar en una sola transacción. Repetición no crea doble vínculo ni eleva roles existentes. Revocación/vencimiento tienen prioridad antes de canje.
6. No reactivar un usuario revocado por coincidir su correo ni transferir vínculos por un cambio de email. Un correo no verificado no es prueba de identidad.
7. Retirar último administrador activo se rechaza salvo transferencia controlada y auditada de plataforma. El usuario nunca edita su rol, finance_access ni pertenencia desde perfil.

### Reservas y cartera

Crear reserva verifica miembro/vínculo actual, zona activa, fechas, horarios, capacidad y cierres. Deriva estado inicial y blocks_slot de política aprobada. Si falta configuración necesaria, responder configuración pendiente, sin asumir disponibilidad. No aceptar state/blocks_slot desde navegador.

La comprobación de mora usa acceso interno mínimo, devuelve permitido/denegado al solicitante sin revelar deuda de otros ocupantes. Para no reservar sobre un resultado financiero obsoleto, la reserva y actualizaciones de cartera deben seguir un protocolo de bloqueo común por unidad y zona, con orden fijo documentado y revalidación de política. Exclusión de rangos resuelve carreras entre reservas exclusivas.

Pagos y aplicaciones: comprobar misma unidad/propiedad/moneda; bloquear pago y obligaciones en orden estable; evitar sobreaplicación; registrar auditoría y notificación en la misma transacción. Ningún importe o condición legal se inventa automáticamente.

### Visitas, paquetes y comunicaciones

Portería puede registrar visitas según autorización identificable del anfitrión/administración, no simular consentimiento. Entrada y salida respetan estado y ventana permitida; identificador de anfitrión debe pertenecer a P y unidad correspondiente. La evidencia de autorización y ventana exacta se especifican antes de etapa 10.

Entrega de paquete registra actor real, fecha y receptor. Un webhook tardío no cambia delivered a notified. Notificaciones generadas por el negocio no admiten que el cliente elija destinatario arbitrario o plantilla con contenido ajeno.

Asistencia y representación: RSVP no marca asistencia; ninguna operación concede voto, coeficiente o quórum por confirmar asistencia. Se mantiene fuera de alcance la votación real.

## 6. Rutas, API y sesión

Rutas propuestas, sin archivos creados:

| Ruta conceptual | Control |
|---|---|
| /login y /auth/callback | Flujo Auth; no datos de propiedad |
| /access-pending | Identidad válida sin acceso operativo |
| /select-property | Solo membresías propias disponibles |
| /p/[propertyId]/home | miembro_activo sobre propiedad solicitada |
| /p/[propertyId]/admin/* | administrador(P), permiso en cada consulta/operación |
| /p/[propertyId]/concierge/* | porteria(P) o administrador(P), datos mínimos |
| /platform/* | plataforma; sin privilegio tenant implícito |

El control de navegación y proxy/middleware ayuda a redirigir, pero cada Server Action, Route Handler y operación de datos verifica permisos independientemente. No confiar en haber entrado a un layout protegido.

Validar esquema/tamaño de entradas en servidor, lista permitida de campos, consultas parametrizadas y errores sin SQL, tokens ni IDs privados. Obtener propiedad del registro y compararla con contexto validado; no modificar property_id por cambios de formulario. Respuesta de recurso inaccesible no confirma si existe; listados vacíos y 404/403 coherentes según contexto.

OAuth: URL de retorno permitida, PKCE/state mediante integración oficial, no redirecciones arbitrarias suministradas por usuario. Cookies y refresco según SDK compatible; HTTPS en entorno público. Logout invalida sesión local y usa revocación disponible; operaciones vuelven a verificar identidad y estado. No inventar que borrar una cookie revoca todos los tokens emitidos.

Mutaciones sin GET, comprobación de origen/CSRF en endpoints basados en cookies y CORS acotado. Webhooks verifican firma sobre cuerpo original, timestamp cuando exista y protección contra repetición. Rate limiting en canje de invitaciones, creación, subida y endpoints costosos, usando almacén compartido apropiado al entorno; cifras pendientes de configuración.

Datos privados sin caché pública/compartida. Si se añade caché, debe estar particionada por usuario, propiedad y permisos y resolver invalidación; MVP prioriza consultas privadas sin esa caché. No dejar datos del conjunto anterior al cambiar de propiedad/cerrar sesión. No almacenar documentos o cartera offline en MVP.

Renderizar texto escapado; no HTML arbitrario de PQRS ni comunicados. Si se añade texto enriquecido, sanitización y reglas explícitas. Exports, búsquedas, conteos, Realtime futuro y métricas heredan permisos; un contador también puede filtrar información.

## 7. Storage

1. Buckets privados. documents identifica el padre permitido mediante FK compuesta, no solo una ruta con property_id.
2. Crear registro pending y ruta generada en servidor después de validar derecho a adjuntar. Token/URL de subida restringido a ese objeto cuando se use.
3. No permitir overwrite/upsert ni mover objeto de una propiedad a otra. Reemplazar archivo crea nueva carga/versionado autorizado; no heredar acceso por owner_id de Storage solamente.
4. Verificar límite real de bytes, MIME y contenido; rechazar tipos peligrosos, archivos comprimidos inesperados y nombres con rutas. No cargar HTML/SVG activo como documento público. Límites exactos e inspección se cierran antes de módulo de archivos.
5. Solo proceso de validación marca available. Pending no se sirve como evidencia normal. Fallo deja rejected y limpieza programada sin revelar bytes.
6. Lectura: sesión válida + membresía/vínculo + permiso del padre + available. Listados de objetos y metadatos reciben la misma protección.
7. Para PQRS, llamados, representación y documentos financieros privados se propone descarga autenticada, con autorización en cada petición. Los enlaces firmados solo donde se apruebe su ventana de exposición; no son revocables automáticamente por cambiar membresía y no deben aparecer en logs ni correos sensibles.
8. DELETE/move/update sobre storage.objects no se concede al navegador. Eliminación mediante operación autorizada y proceso de Storage, sin borrar directamente metadatos administrados por Supabase ni saltar política de retención.

No hay transacción única entre bytes y PostgreSQL: manejar estados pending/available/rejected/deleted y limpieza idempotente para cargas huérfanas. Cambiar permisos o padre del documento no se admite como UPDATE genérico.

## 8. Procesos internos, secretos y auditoría

Correo: reclamar trabajo con lease, revalidar destinatario vigente, enviar usando clave de idempotencia si proveedor lo permite y registrar intento. No aceptar job payload arbitrario desde cliente. No incluir datos de otros residentes. Autenticación de scheduler y de worker obligatoria; Edge Function publicada no equivale a endpoint interno protegido.

Credenciales secretas en entorno servidor, nunca NEXT_PUBLIC ni repositorio. Separar proyectos y credenciales de pruebas/producción, sin datos reales en fixtures. Clave de servicio solo donde sea imprescindible; preferir operaciones estrechas con permisos concretos. Comprometer un worker con credencial amplia es un riesgo residual que debe minimizarse y registrarse.

Auditoría de operaciones aceptadas se escribe en su transacción; actor y propiedad derivados de sesión/registro. Intentos denegados se registran en telemetría protegida fuera de una transacción que se revierte, con request_id y datos mínimos. El usuario no proporciona metadata arbitraria para forjar auditoría.

Sin tokens, secretos, documentos completos ni cuerpos privados en logs técnicos. No afirmar auditoría inmutable frente al propietario de la base de datos: la protección prevista impide alteraciones por usuarios de la aplicación; acceso operativo a infraestructura también necesita control.

Soporte: no se incluye permiso universal de emergencia. Cualquier futura sesión de soporte deberá definir autorización, duración, alcance y auditoría antes de implementarse. La creación de administradores por superadmin también se audita para evitar que funcione como vía de acceso privado no justificado.

## 9. Plan de pruebas de seguridad

### Datos ficticios

Dos propiedades A/B, veinte unidades cada una. Identidades distintas: residente A, vecino A, residente B, usuario con vínculos válidos en A y B, propietario no residente, portero A, administrador A, administrador B, superadmin sin membresía, usuario sin invitación y miembro revocado. No usar información real.

### Casos y resultados exigidos

| ID | Intento | Resultado esperado |
|---|---|---|
| SEC-01 | Residente A consulta registros B cambiando property_id | Sin filas ni datos derivados |
| SEC-02 | Administrador A exporta datos B por API directa | Denegado, sin archivo generado |
| SEC-03 | Portero A consulta cartera/PQRS/llamados | Sin acceso a tablas, RPC ni documentos |
| SEC-04 | Vecino de misma unidad abre PQRS ajena | Denegado salvo autor autorizado |
| SEC-05 | Superadmin sin membresía solicita archivo privado A | Denegado; rol SaaS no autoriza |
| SEC-06 | Usuario sin invitación accede después de Google OAuth | Solo perfil/acceso pendiente |
| SEC-07 | Usuario canjea token válido con email distinto | Denegado sin consumir invitación |
| SEC-08 | Token vencido, revocado o usado se reutiliza | Denegado; sin roles nuevos |
| SEC-09 | Dos canjes simultáneos | Un único efecto; no duplicados |
| SEC-10 | Miembro edita roles, finance_access o user_id | CRUD denegado y RPC valida actor |
| SEC-11 | Cliente inserta directamente una reserva aprobada | Denegado por privilegios, no solo frontend |
| SEC-12 | RPC recibe padre de otra propiedad | Denegado por autorización/FK compuesta |
| SEC-13 | Dos reservas simultáneas solapadas | Una válida, otra conflicto controlado |
| SEC-14 | Pago y reserva concurren durante cambio de mora | Resultado consistente con orden transaccional |
| SEC-15 | Miembro revocado mantiene JWT | Nuevas consultas/escrituras operativas denegadas |
| SEC-16 | Termina vínculo A, conserva vínculo B | No datos de antigua unidad A; B sigue funcionando |
| SEC-17 | Archivo B solicitado por ruta, ID o listado conocido | Sin metadatos ni bytes |
| SEC-18 | Carga declara PDF pero contiene HTML o supera tamaño | Rechazo/aislamiento, nunca available |
| SEC-19 | Cliente mueve/sobrescribe archivo o cambia padre | Denegado |
| SEC-20 | Usuario A ve respuesta cacheada de B | Nunca ocurre; probar navegador, servidor y CDN |
| SEC-21 | RPC protegida llamada fuera de Next.js | Mismos permisos que desde interfaz |
| SEC-22 | Webhook falso/repetido/tardío | Firma rechazada o actualización idempotente sin regresión |
| SEC-23 | Correo en cola tras revocación de destinatario | Revalidación cancela si perdió autorización |
| SEC-24 | Usuario cambia RSVP incluyendo attended_at | Solo RSVP permitido; asistencia permanece intacta |
| SEC-25 | Consulta helper RLS causa recursión | No recursión; resultado limitado y sin expansión de acceso |
| SEC-26 | Lista, búsqueda, conteo o reporte de registros ajenos | Sin filtración lateral por datos derivados |
| SEC-27 | Intento CSRF o redirect externo en callback | Rechazado |
| SEC-28 | Usuario intenta editar auditoría o estados de correo | Denegado |
| SEC-29 | Administrador intenta concederse superadmin | Denegado |
| SEC-30 | Superadmin se invita como administrador para leer privados | Rechazado; soporte no habilitado implícitamente |

### Método de ejecución futuro

- Unitarias: permisos puros, validaciones y transiciones.
- Integración con PostgreSQL/Supabase: identidades reales de prueba, JWT por usuario y llamada directa a API/RPC/Storage; no testear RLS como dueño/service_role.
- Transaccionales: concurrencia real en reservas, invitaciones y pagos con barreras de sincronización.
- E2E: navegación, rutas directas, logout, cambio de propiedad, formularios, móvil/desktop.
- Inspección de grants, políticas efectivas, privilegios de funciones y configuración de buckets en CI/entorno de pruebas.

Cada prueba registra resultado esperado/obtenido y evidencia sin datos privados. Estado actual de SEC-01–SEC-30: NO EJECUTADAS. El análisis conceptual identifica barreras, no demuestra su implementación.

## 10. Archivos e implementación

Creado este documento; actualizados seguimiento, aprobación del modelo y README. Sin dependencias nuevas, tablas reales, claves ni archivos de aplicación. Propuestas que concretan etapa 2: escrituras solo por operaciones controladas, designación de administradores por plataforma y payload secreto cifrado de invitación; requieren aprobación de esta etapa antes de implementación.

## 11. Checklist

- [x] Roles y alcance por propiedad definidos.
- [x] Matriz de lectura/escritura para las 36 tablas.
- [x] Contratos de autorización, RLS, rutas y Storage documentados.
- [x] Escenarios de aislamiento, concurrencia y escalación identificados.
- [x] Pendientes de negocio conservados, sin aprobación implícita.
- [x] Aprobación de etapa 3.
- [ ] Funcionalidad implementada: no corresponde en esta etapa.
- [ ] Seguridad/RLS verificadas mediante ejecución: pendiente.
- [ ] Responsive, errores y pruebas ejecutadas: pendiente de implementación.

## 12. Siguiente etapa

Etapa 4 — inicialización de Next.js, TypeScript, Tailwind, shadcn/ui, integración base de Supabase, plantilla de variables sin secretos y estructura de carpetas. Solo después de aprobación del usuario. No implementar módulos completos ni afirmar autenticación funcional en etapa 4.

## Referencias oficiales

- [Next.js: autenticación y autorización](https://nextjs.org/docs/app/guides/authentication).
- [Next.js: mutaciones y verificación en cada Server Function](https://nextjs.org/docs/app/getting-started/mutating-data).
- [Supabase: RLS, helpers y precauciones](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase: funciones y privilegios de ejecución](https://supabase.com/docs/guides/database/functions).
- [Supabase: funciones privadas para políticas](https://supabase.com/docs/guides/troubleshooting/do-i-need-to-expose-security-definer-functions-in-row-level-security-policies-iI0uOw).
- [Supabase: buckets privados](https://supabase.com/docs/guides/storage/buckets/fundamentals).
- [Supabase: descargas autenticadas y enlaces firmados](https://supabase.com/docs/guides/storage/serving/downloads).

Consulta técnica realizada el 2026-09-28; comprobar compatibilidad con versiones elegidas al implementar.
