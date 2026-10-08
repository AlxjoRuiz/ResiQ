# Seguimiento del proyecto

Actualizado: 2026-10-08. Fuente de autoridad: `00-prompt-maestro.md` y aprobaciones explícitas del usuario en esta conversación.

## Estado de etapas

| Etapa | Entregable | Estado |
|---|---|---|
| 0 | Análisis, alcance, riesgos y MVP | Aprobada por el usuario: «si te apruebo la propuestas» |
| 1 | Arquitectura | Aprobada: «esta aprobado, pero recuerda el promt que te pase, lleva ese seguimiento» |
| 2 | Modelo de datos y ER | Aprobada: «esta perfecto, aprobado. sigamos» |
| 3 | Diseño detallado de seguridad y RLS | Aprobada: «aprobado sigamos» |
| 4 | Inicialización del proyecto | Aprobada por el usuario al ordenar continuar y configurar Supabase |
| 5 | Autenticación e invitaciones | Aprobada por el usuario: «aprobado, seguimos mañana» |
| 6 | Multi-tenancy funcional | Aprobada por el usuario al solicitar continuar con los pasos restantes |
| 7 | Dashboards | Aprobada por el usuario: «ya lo revise esta correcto, sigamos con el paso 8» |
| 8 | PQRS | Aprobada por el usuario: «si esta bien seguimos mas tarde» |
| 9 | Paquetes | Aprobada por el usuario: «vale, quedó aprobada. sigamos amigos» |
| 10 | Visitas y mantenimiento | Aprobada por el usuario: «listo, todo aprobado sigamos» |
| 11 | Zonas y reservas | Aprobada por el usuario: «aprobado, sigamos con los siguientes pasos» |
| 12 | Cartera | Aprobada por el usuario al solicitar continuar el 2026-10-03 |
| 13 | Llamados de atención | Aprobada por el usuario el 2026-10-05 después de confirmar la recepción real del correo |
| 14 | Asambleas | Implementada y validada; pendiente de aprobación funcional del usuario |
| 15 | Notificaciones y comunicaciones | Alcance preparado; correo a residentes pospuesto hasta contar con dominio verificado |
| 16 | Auditoría integral y seguridad | En curso: PR de seguridad integrados, migraciones y auditoría de permisos aplicadas; cierre pendiente |
| 17 | Testing integral | No iniciada |
| 18 | Responsive y UX integral | No iniciada |
| 19 | Deploy | No iniciada |
| 20 | Preparación comercial SaaS | No iniciada |

## Revisión contra el prompt maestro — 2026-09-29

La etapa 5 quedó implementada, verificada y aprobada. Las etapas 0–5 están cerradas. La etapa 6 fue autorizada, implementada y validada; queda pendiente la aprobación explícita del usuario para cerrarla e iniciar la etapa 7.

### Para cerrar la etapa 5

- [x] Comprobar cierre de sesión y renovación de sesión desde el navegador.
- [x] Editar el perfil propio y comprobar que otro usuario no pueda editarlo ni leerlo fuera de la proyección autorizada.
- [x] Completar una invitación desde la interfaz con una segunda cuenta real.
- [x] Comprobar aislamiento RLS con usuarios reales vinculados a propiedades distintas.
- [x] Presentar resultados y recibir aprobación explícita de la etapa 5.

### Trabajo funcional restante

| Etapa | Trabajo principal pendiente |
|---|---|
| 15 | Notificaciones internas, comunicaciones y correo centralizado |
| 16 | Auditoría integral y revisión de seguridad |
| 17 | Pruebas unitarias, integración, RLS y E2E integrales |
| 18 | Revisión responsive, accesibilidad y experiencia completa |
| 19 | Despliegue público, variables, dominio y comprobaciones de producción |
| 20 | Planes, límites, operación y preparación comercial SaaS |

### Capacidades transversales pendientes

- Completar la biblioteca visual: formularios, tablas, diálogos, navegación, avisos, paginación, fechas, carga de archivos y estados vacíos/carga/error.
- Storage privado, validación de archivos y descargas autorizadas están implementados; queda configurar respaldo externo antes de producción.
- La cola y los registros de correo con Resend, reintentos e idempotencia están implementados; la etapa 15 consolidará la experiencia de comunicaciones.
- Los módulos implementados generan actividad y auditoría; la etapa 16 realizará la revisión integral.
- Crear la administración de plataforma, planes y asignaciones prevista para la etapa 20.
- Incorporar una suite de pruebas automatizadas; actualmente no hay casos en `tests` ni comandos de pruebas en `package.json`.

### Decisiones que deben cerrarse antes de implementar

- P01 y P06 quedaron resueltas antes de implementar la etapa 6.
- P04, P05, P07 y P08 quedaron aprobadas antes de implementar la etapa 11.
- Antes de la etapa 12: P02 y P03 para visibilidad y carga de cartera.
- P09 quedó aprobada antes de implementar la etapa 14.
- Antes del primer módulo con archivos o correo: P10 para proveedor, dominio, límites y retención.
- Antes de la etapa 20: P11 para planes, límites y alcance comercial.

## Aprobaciones y alcance

- Stack solicitado: Next.js, React, TypeScript, Tailwind, shadcn/ui y Supabase; Google OAuth. Vercel previsto para despliegue.
- Seguridad multi-tenant desde el inicio; backend y base de datos protegen las operaciones.
- Correo como único canal externo; notificaciones internas permitidas. Sin WhatsApp ni SMS.
- Dos propiedades ficticias con veinte apartamentos cada una, aprobados con «esta bien, empecemos».
- MVP propuesto y aprobado en etapa 0: identidad, estructura, roles, dashboards, PQRS, paquetes, visitas, reservas y cartera básica, con correo, archivos y auditoría asociados. Llamados, asambleas y comunicaciones completan la versión siguiente, respetando las etapas.
- El piloto real propuesto de 10–20 apartamentos necesita seguridad y preparación de producción; no autoriza despliegue automático ni garantiza capacidad por número de apartamentos.
- Arquitectura aprobada: aplicación modular, PostgreSQL compartido con RLS, Storage privado, tareas de correo persistentes, separación de entornos.
- No se implementarán votaciones ni facturación automática antes de definir sus reglas.

## Ajustes de dependencias aprobados en etapa 0

1. Base de correo antes del primer módulo que lo utiliza; etapa 15 centraliza y completa el sistema.
2. Restricción por mora de reservas se completa al integrar cartera en etapa 12.
3. Base mínima de membresías e invitaciones seguras en etapa 5; gestión completa en etapa 6.
4. Pruebas, seguridad, auditoría y responsive acompañan cada módulo; etapas finales son revisiones integrales.
5. Documentos compartidos en etapa 14, comunicados en etapa 15 y reportes junto a cada módulo.
6. Identidad y catálogos globales no llevan propiedad ficticia; los registros operativos sí llevan property_id.

## Pendientes de negocio: NO asumir aprobación por silencio

| ID | Decisión | Situación / bloqueo |
|---|---|---|
| P01 | Permitir múltiples propiedades/unidades por usuario | Aprobada: una persona puede pertenecer a varias propiedades y tener varios vínculos de unidad vigentes |
| P02 | Cartera visible a residentes además del propietario | Aprobada: acceso expreso por vínculo vigente mediante `finance_access` |
| P03 | Carga de cartera manual, Excel o integración | Aprobada: registro manual e importación `.xlsx` con vista previa y lote transaccional; sin integración externa |
| P04 | Reservas pendientes ocupan horario y vencen | Aprobada: bloquean 24 horas por defecto, configurable entre 60 minutos y 48 horas, sin superar el inicio |
| P05 | Reserva exclusiva o por cupos | Aprobada: reserva exclusiva en el MVP; capacidad limita asistentes |
| P06 | Acceso histórico al mudarse o perder membresía | Aprobada: retirar de inmediato el acceso operativo e histórico del antiguo miembro; administración conserva los registros para auditoría |
| P07 | Mora: umbral, saldo, fecha de cómputo y reglas aplicables | Aprobada para etapa 11: configuración inactiva; cálculo y bloqueo real se implementan con cartera en etapa 12 |
| P08 | Destinatarios compartidos de paquetes y visibilidad de reservas para portería | Aprobada: paquetes conservan destinatario explícito; en reservas, residentes ajenos ven sólo ocupación anónima, portería ve agenda operativa y administración el detalle completo |
| P09 | Convocatoria de asambleas, representación y conservación de evidencia | Aprobada el 2026-10-05: audiencia explícita, RSVP separado, asistencia administrativa, representación con evidencia, recordatorios y documentos versionados; sin voto o quórum automático |
| P10 | Correo, dominio, límites de archivos, conservación y respaldo | Aprobada: Resend en modo de prueba hasta tener dominio; Storage privado; PDF/JPG/PNG; 10 MB y 5 archivos; validación de firma; enlaces de 5 min; retención de 5 años; respaldo de Supabase y copia externa antes de producción |
| P11 | Planes, límites, pago electrónico, contabilidad completa | No definidos; no implementar facturación ni pasarela |

## Seguimiento de requisitos

| Secciones del prompt | Entregable de diseño / etapa funcional |
|---|---|
| 1–4, 21–24 | Arquitectura; identidad, propiedades, roles y tablas en modelo; seguridad en etapa 3 |
| 5–8, 25–26 | Sistema visual y dashboards, etapas 7 y 18 |
| 9 | pqrs, mensajes y adjuntos; etapa 8 |
| 10 | packages y eventos; etapa 9 |
| 11 | notifications, email_jobs, email_logs; base temprana y etapa 15 |
| 12–13 | amenities, horarios, reservas y política; etapas 11–12 |
| 14–15 | visitors y visitor_entries; mantenimiento como tipo; etapa 10 |
| 16 | accounts_receivable, payments y aplicaciones; etapa 12 |
| 17 | attention_calls, destinatarios y adjuntos; etapa 13 |
| 18–19 | assemblies, agenda, documentos, asistentes y representación; etapa 14; voto futuro |
| 20 | documents y asociaciones; Storage privado |
| 23 | audit_logs y eventos funcionales; base desde primeros módulos |
| 27–31 | Este registro y entregas por aprobación |

## Protocolo al continuar

- Leer el prompt y este registro antes de retomar trabajo.
- Presentar objetivo, decisiones, archivos, implementación, pruebas, checklist y siguiente etapa.
- Documentar nuevas respuestas sin convertir recomendaciones antiguas en aprobaciones.
- Detenerse al terminar cada etapa y esperar aprobación. No crear código ni migraciones durante las etapas de diseño.
- Etapa 2 aprobada: diccionario de 36 tablas, consolidaciones y diagramas; no implica resolución de los pendientes P01–P11 expresamente reservados en el documento.
- Etapa 3: ver `04-seguridad.md`, matriz de permisos, contratos de operaciones y casos de prueba. No hay políticas ejecutadas ni aplicación.
- Etapa 3 aprobada. Etapa 4 entregada y verificada en `05-inicializacion.md`; mantener P02 pendiente y denegación conservadora.
- Etapa 4 aprobada. Etapa 5 autorizada explícitamente el 2026-09-28 al solicitar continuar después del restablecimiento de uso.
- El 2026-09-29 se aplicó `20260929003500_auth_and_invitations.sql` al proyecto Supabase ResiQ. La consulta de verificación devolvió las siete tablas esperadas (`profiles`, `properties`, `property_members`, `buildings`, `units`, `unit_memberships`, `invitations`) con RLS activo.
- El 2026-09-29 se habilitó Google OAuth en Supabase con el cliente web de ResiQ. TypeScript, ESLint y la compilación de producción finalizaron correctamente; `/panel` redirige a `/login`, `/login` responde y Supabase genera la autorización de Google con callback `http://localhost:3000/auth/callback`.
- El 2026-09-29 se ejecutó el bootstrap controlado para el usuario autenticado: `Conjunto Bosques de ResiQ` y `Edificio Mirador ResiQ`, cada uno con una torre, veinte unidades activas y membresía de administrador.
- Las pruebas remotas detectaron y corrigieron una ambigüedad PL/pgSQL en `accept_invitation`. Después de aplicar `20260929220000_fix_accept_invitation_member_id.sql`, pasaron siete casos transaccionales sin persistir datos: válida, reutilizada, revocada, vencida, correo diferente, rol alterado y rollback limpio.
- El 2026-09-29 se completó el flujo real con una segunda cuenta de Google: creación desde la interfaz, selección explícita de cuenta, OAuth, aceptación y acceso únicamente a `Conjunto Bosques de ResiQ` como `member`.
- El cierre de sesión redirigió al login y la sesión de la cuenta invitada sobrevivió a una recarga del panel.
- La prueba RLS como la segunda identidad devolvió un perfil, una membresía de propiedad, un vínculo de unidad y cero membresías de la propiedad ajena. La ruta administrativa de la segunda propiedad respondió 404.
- La prueba transaccional de perfiles permitió una actualización propia y cero actualizaciones ajenas; finalizó con rollback.
- El 2026-09-30 el usuario aprobó P01 y P06 y autorizó la etapa 6. Se implementaron formularios y RPC de administración para datos de la propiedad, torres, apartamentos, miembros, roles y vínculos, con auditoría transaccional y denegación del historial al terminar un vínculo.
- El 2026-09-30 se aplicó `20260930100000_multitenancy_management.sql` al proyecto Supabase ResiQ. TypeScript, ESLint y la compilación de producción finalizaron correctamente. La prueba transaccional final quedó pendiente porque el editor SQL de Supabase presentó una incidencia técnica y dejó de responder.
- El 2026-09-30 se completó la validación de P01/P06 con la sesión real del miembro: acceso simultáneo a los apartamentos 101 y 102, pérdida inmediata del 102 al terminar el vínculo, conservación administrativa del historial y dos eventos de auditoría. La RPC administrativa devolvió `not_authorized` para el miembro y la ruta administrativa respondió 404. Queda la comprobación visual final de los formularios administrativos antes de solicitar el cierre de la etapa 6.
- El 2026-09-30 se completó la comprobación visual administrativa: los formularios de propiedad, Torre 1 y apartamento 101 confirmaron sus actualizaciones con los valores vigentes, sin alterar la estructura. La etapa 6 quedó técnicamente validada y pendiente de aprobación explícita.
- El 2026-09-30 el usuario aprobó continuar, cerrando la etapa 6 y autorizando la etapa 7. Se implementaron dashboards separados para residente, portería, administración y plataforma, con navegación derivada de roles y protección en servidor. La migración de identidad de plataforma y métricas agregadas fue aplicada; quedan pendientes la designación explícita del primer superadmin y las validaciones visuales finales.
- El 2026-09-30 el usuario revisó y aprobó la etapa 7 y autorizó la etapa 8. También aprobó P10 con Resend, Storage privado, formatos PDF/JPG/PNG, máximo de 10 MB y 5 archivos, verificación de contenido, enlaces firmados de 5 minutos, retención de 5 años y respaldo externo antes de producción.
- El 2026-10-01 se aplicó `20260930220000_pqrs.sql` al proyecto Supabase ResiQ. Las tablas `pqrs`, `pqrs_messages`, `documents`, `notifications` y `activity_events` respondieron correctamente mediante la API. TypeScript, ESLint y la compilación de producción finalizaron sin errores; las rutas protegidas `/panel` y `/panel/propiedades/[propertyId]/pqrs` respondieron y redirigieron al inicio de sesión cuando no había sesión. El envío real queda condicionado a configurar Resend y desplegar `process-email-jobs`, tal como se documenta en `09-pqrs.md`.
- El 2026-10-01 el usuario aprobó el cierre técnico de la etapa 8 y autorizó continuar con la etapa 9. P08 debe resolverse explícitamente antes de implementar paquetes.
- El 2026-10-01 el usuario aprobó P08 para paquetes y el alcance de la etapa 9: destinatario explícito, privacidad entre ocupantes, registro de remitente y origen, entrega a una persona identificada y estado notificado únicamente cuando el proveedor acepte el correo. El registro de entradas y salidas de visitantes pertenece a la etapa 10.
- El 2026-10-01 se aplicó `20261001100000_packages.sql` al proyecto Supabase ResiQ. La tabla `packages` quedó con RLS activa y las RPC de directorio, recepción, asociación y entrega quedaron disponibles. Se registró y entregó un paquete de prueba para el apartamento 101; el historial conservó ambos eventos, el destinatario autenticado obtuvo un registro y una identidad no asociada obtuvo cero. TypeScript, ESLint y la compilación de producción finalizaron correctamente. La etapa 9 queda pendiente de aprobación explícita antes de iniciar visitas y mantenimiento.
- El 2026-10-01 el usuario aprobó la etapa 9 y autorizó continuar con la etapa 10. Para visitas se adopta una ventana explícita de inicio/fin de máximo 24 horas, un solo ingreso por autorización, documento completo no almacenado y evidencia textual obligatoria cuando portería o administración registra la autorización en nombre del anfitrión.
- El 2026-10-01 se aplicó `20261001150000_visitors.sql` al proyecto Supabase ResiQ. `visitors` y `visitor_entries` quedaron publicadas con RLS activa; la API anónima devolvió listas vacías y la RPC de ingreso rechazó llamadas sin sesión. Una prueba transaccional autorizó mantenimiento, creó ingreso, registró salida y comprobó visibilidad 1/0 para anfitrión/identidad ajena, revirtiendo todos los datos de prueba. TypeScript, ESLint y la compilación finalizaron correctamente. La revisión visual confirmó el listado, filtros, formulario, dependencia apartamento-anfitrión, restricciones HTML y adaptación móvil sin desbordamiento. El aviso observado provino exclusivamente de la extensión MetaMask del navegador. La etapa 10 queda técnicamente validada y pendiente de aprobación explícita.
- El 2026-10-01 el usuario aprobó la etapa 10 y autorizó continuar con la etapa 11. Se documentó en `12-zonas-reservas.md` una propuesta conjunta para P04, P05, P07 y P08; no se crean migraciones ni código de reservas hasta recibir aprobación explícita de esas decisiones.
- El 2026-10-01 el usuario aprobó P04, P05, P07 y P08. Se implementaron zonas, horarios, cierres y reservas exclusivas con vencimiento configurable, separación por roles, RLS, auditoría, notificaciones y correo en cola. Se aplicó `20261001190000_reservations.sql`; TypeScript, ESLint, compilación y Deno finalizaron correctamente. La prueba remota creó y aprobó una solicitud temporal, rechazó un cruce y terminó con `stage11_transactional_checks_passed` y rollback. La etapa 11 queda técnicamente validada y pendiente de aprobación explícita.
- El 2026-10-01 el usuario aprobó la etapa 11 y autorizó continuar con la etapa 12. Se configuró `.npmrc` con 4 GB para Node y `npm run verify` para ejecutar TypeScript, ESLint y compilación de forma secuencial; la rutina completa finalizó correctamente. P02 y P03 deben resolverse antes de implementar cartera.
- El 2026-10-01 se presentó el diseño de la etapa 12 en `13-cartera.md`: acceso financiero expreso por apartamento (P02), registro manual e importación Excel validada (P03), cálculo de mora por unidad, pagos aplicados sin sobrepasar saldos y conexión segura con la restricción de reservas. No se crearán migraciones ni código financiero hasta recibir aprobación explícita.
- El 2026-10-02 se implementó y publicó la etapa 12: obligaciones, pagos y aplicaciones, acceso financiero explícito, importación `.xlsx` con vista previa, cálculo de mora, bloqueo de reservas, avisos y pantallas por rol. Se aplicó `20261001230000_finance.sql` en Supabase y se añadió `20261002233000_restrict_finance_table_writes.sql` para dejar las escrituras únicamente en RPC auditadas. La prueba transaccional verificó saldo inicial, aplicación parcial, rechazo de sobreasignación, anulación con recálculo, bloqueo por mora, resumen y rollback limpio. TypeScript, ESLint, compilación, Deno y auditoría de dependencias finalizaron correctamente. La etapa 12 queda técnicamente validada y pendiente de aprobación explícita.
- El 2026-10-03 el usuario aprobó continuar, cerrando la etapa 12 y autorizando el diseño de la etapa 13. Se presentó `14-llamados-atencion.md` con destinatarios explícitos, evidencia privada, estados lineales, notificación verificable y exclusión de multas o efectos jurídicos automáticos. No se crea código ni migración de llamados hasta aprobar estas decisiones.
- El 2026-10-03 el usuario aprobó las decisiones de la etapa 13 y autorizó su implementación. Se añadieron llamados privados, destinatarios explícitos, evidencias, lectura, estados lineales, actividad, auditoría, notificaciones y correo en cola.
- El 2026-10-05 se aplicó `20261003100000_attention_calls.sql` en Supabase. La prueba transaccional remota validó creación, aislamiento RLS, destinatario inválido, evidencia, lectura, aceptación de correo, transiciones y cierre, y terminó con rollback limpio. TypeScript, ESLint, compilación y Deno finalizaron correctamente.
- El 2026-10-05 se desplegó y validó `process-email-jobs`: una llamada sin secreto devolvió HTTP 401 y una entrega controlada fue aceptada por Resend y registrada en `email_logs`. `EMAIL_WORKER_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` y `APP_URL` permanecen en Edge Functions Secrets; `project_url` y el secreto del worker están cifrados en Vault. La migración `20261005153000_schedule_email_worker.sql` programó el worker cada minuto mediante Cron y `pg_net`; dos ejecuciones automáticas terminaron en `succeeded` con HTTP 200 y cola vacía. La etapa 13 queda técnicamente completa y pendiente de aprobación explícita.

- El 2026-10-05 el usuario confirmó la recepción del correo real y aprobó el cierre de la etapa 13. Se presentó `15-asambleas.md` para resolver P09; no se implementan tablas, migraciones ni pantallas de asambleas hasta aprobar esas decisiones.
- El 2026-10-05 el usuario aprobó P09 y la etapa 14 fue implementada. Se aplicaron `20261005190000_assemblies.sql` y `20261005200000_fix_assembly_required_notes.sql`; se desplegó el worker con correos de convocatoria, cambios, cancelación y recordatorios. La prueba transaccional remota terminó con `stage14_transactional_checks_passed` y rollback limpio. TypeScript, ESLint y la compilación de producción con Webpack finalizaron correctamente. La etapa 14 queda técnicamente completa y pendiente de aprobación funcional antes de iniciar la etapa 15.
- El 2026-10-06 se publicó una convocatoria funcional de prueba y se confirmó su visibilidad para la cuenta miembro. La revisión detectó ambigüedad en las relaciones PostgREST de perfiles; se indicaron las claves foráneas de asistentes y representantes. Los botones de RSVP volvieron a mostrarse. Se solicitó Asistiré; quedan pendientes confirmar su persistencia y la recepción del correo, porque el navegador dejó de responder. La etapa 15 permanece sin iniciar.

- El 2026-10-06 se preparo supabase/tests/assembly_functional_readonly.sql para comprobar RSVP y registros de correo de la convocatoria real sin modificar datos. Su ejecucion remota sigue pendiente porque el navegador automatizado agota el tiempo de espera; no se considera verificada la recepcion del correo.
- La nueva ejecucion de ESLint finalizo con codigo 0; TypeScript tambien paso tras la correccion de relaciones. La consulta de solo lectura esta preparada pero no ejecutada y el cierre funcional sigue pendiente.

- El 2026-10-06 la consulta remota confirmo RSVP yes con responded_at y asistencia pending. La convocatoria seguia queued; Cron ejecutaba la llamada, pero Edge devolvia 503 BOOT_ERROR. Los registros identificaron createClient duplicado: el archivo desplegado concatenaba la version vigente y una antigua. Se elimino la copia antigua y se redesplego el worker conservando las plantillas de asambleas y la autenticacion por secreto.
- Tras el redespliegue, el worker respondio HTTP 200. El intento de convocatoria fue rechazado por Resend: el remitente de pruebas solo permite enviar a alejandroruiz2811@gmail.com. Para el destinatario alejoruizm11@gmail.com falta verificar un dominio en Resend y configurar RESEND_FROM_EMAIL con ese dominio. No se cambia el destinatario ni se considera entregado el correo. La etapa 15 permanece sin iniciar.

- El 2026-10-06 se creo resi-q en Vercel desde AlxjoRuiz/ResiQ main y se desplego https://resi-q.vercel.app con las dos variables publicas de Supabase. Se verificaron portada, login y acceso Google al panel con las dos comunidades administrativas. Supabase Site URL quedo en https://resi-q.vercel.app y se agregaron callbacks /auth/callback y /auth/callback?next=**, conservando el callback local. Falta dominio propio verificado para Resend y actualizar APP_URL del worker para enlaces desplegados.

- El 2026-10-06 se probo en Vercel la sesion residente alejoruizm11@gmail.com: panel muestra solo Bosques, rol member y apartamento 101; dashboard de Mirador, paquetes de Mirador y formulario administrativo de invitaciones de Bosques devolvieron 404 sin datos. La convocatoria autorizada abre con RSVP Asistire persistente y sin listado administrativo de convocados. No se modificaron permisos ni datos. Esta prueba visual no sustituye las pruebas RLS ni verifica todos los registros privados de otros residentes.

### Ajuste aprobado de visitas — 2026-10-06

Alejandro confirmó: residente solicita, administrador acepta/rechaza sin crear visitas, portería registra ingreso/salida. Implementado en interfaz y RPC; migración aplicada y prueba transaccional completa aprobada con rollback. Se conservan visitas históricas. Además, las deudas de prueba holaaaa/fffff fueron anuladas y se habilitó expresamente el acceso financiero del residente del apartamento 101.

Validación del ajuste: TypeScript y ESLint correctos; prueba transaccional en Supabase PASS con rollback. Worker de correos actualizado para solicitudes y rechazos (panel mostró nueva fecha de despliegue). Compilación de producción con webpack correcta. Tras recuperarse el navegador, Vercel mostró el listado de solicitudes con Pendientes/Aceptadas y sin opción de creación para administrador; publicación confirmada.

### PQRS: tipo separado del tema — 2026-10-07

Solicitud de Alejandro implementada: Queja/Reclamo en Tipo de solicitud, por encima de Categoría del tema. Se incluye Petición/Sugerencia como tipos; las categorías conservan solo temas operativos. Listado y detalle muestran ambos valores. Migración aplicada y prueba transaccional PASS; TypeScript y ESLint correctos. Se conservan datos anteriores y los permisos de privacidad.

Publicación confirmada en Vercel desde el perfil de residente: Tipo de solicitud encima de Categoría del tema, con selecciones obligatorias independientes. Captura del formulario guardada para revisión.

### Diseño de vidrio para login — 2026-10-07

Solicitado por Alejandro: fondo oscuro con luces verdes, tarjeta translúcida con desenfoque y borde suave, presentación de ResiQ en escritorio y formulario de una columna en móvil. Estilos aislados en `src/app/login/login.module.css`; campos, acciones, redirecciones, Google y flujo de invitación conservados. No hay cambios en Supabase ni permisos. TypeScript, ESLint y build con webpack correctos. Publicación confirmada en Vercel; revisión visual de escritorio y móvil (ancho real 388 px, sin desbordamiento horizontal). Se verificaron campos requeridos email/password, redirección next y los dos botones conservados. No se ejecutó un inicio de sesión nuevo, ya que las acciones de autenticación no cambiaron.

### Continuación funcional — 2026-10-07
Alejandro solicitó retomar los pasos funcionales y posponer el diseño. Se preparó docs/16-notificaciones.md con el alcance de centralización y comunicaciones; pendiente de aprobación de decisiones antes de implementar. No se considera resuelta la entrega de correo a residentes sin dominio verificado. No se modificaron código, permisos ni datos remotos.

### Revisión inicial de etapa 16 — 2026-10-07
Alejandro aprobó el alcance de etapa 15 y después solicitó revisar los ocho PR del colaborador y continuar con paso 16. Etapa 15 sigue sin implementar. Se entregó docs/17-auditoria-seguridad.md con inventario, hallazgos de compatibilidad de correos históricos/invitaciones y requisitos de despliegue de archivos. Etapa 16 iniciada; no se integraron PR ni se ejecutaron migraciones remotas. Pruebas del autor distinguídas de comprobaciones propias.
Etapa 16: revisión estática adicional de avisos, auditoría y colas; preparado stage16_security_catalog_readonly.sql para confirmar RLS y privilegios efectivos en remoto. Ejecución remota pendiente.
Integración de seguridad preparada en codex/integracion-seguridad con ocho PR; seis regresiones Node, tres Deno y auditoría de producción correctas. Configuración privada de Vercel y pruebas SQL remotas pendientes; main aún no actualizado.
Etapa 16: lint y compilación integrados correctos; clave privada guardada según Alejandro; cinco migraciones aplicadas y RLS con rollback correcto. Revisión automática rechazó push directo a main; falta fusionar PR #9 y desplegar worker. Los adjuntos requieren rutas nuevas tras revocar finalización antigua.
PR #9 fusionado por GitHub, Vercel success, worker actualizado y salud Cron/HTTP 200 comprobada. Auditoría remota detectó grants heredados; migración adicional restringe notificaciones a read_at y retira TRUNCATE de roles navegador. Regresión effective_grants PASS. Etapa 16 sigue abierta por pruebas de archivos/concurrencia/correo y revisión restante.

### Diseño claro de paneles — 2026-10-07
Alejandro aprobó aplicar la propuesta de verde salvia y tarjetas blancas a administración, residente y portería. Dashboard con navegación por rol, adaptación móvil y resúmenes reales acotados por RLS; sin migraciones ni cambios de permisos. Alcance y validación en docs/18-diseno-paneles.md. No cierra etapa 15 ni auditoría de etapa 16.
Validación del diseño: TypeScript, ESLint y build local correctos; PR #12 fusionado y Vercel success. Vista residente comprobada en producción y a 388 px reales sin desbordamiento de página; navegación Paquetes/Panel correcta. Revisión visual de administración y portería con sesiones reales pendiente; sin cambios de permisos ni datos.
Resumen central solicitado: retiradas tarjetas de servicios duplicadas, novedades de la membresía y cartera mediante RPC autorizada; estados de solicitudes y actividad visibles. Sin cambios de permisos ni datos. Evidencia final en PR #14.
Diseño extendido por solicitud de Alejandro: marco y navegación compartidos para módulos de propiedad, formularios y detalles; superficie coherente en pantallas generales de /panel. Acciones y protección por página conservadas. Evidencia final en PR de codex/diseno-modulos.

Continuación 2026-10-07: limpieza real del rechazo de asamblea confirmada (deleted, objeto ausente); rechazo de PQRS aún dentro del plazo seguro a las 17:08 Colombia. Regresión remota de visitas para residente/administrador/portería PASS con rollback; seis pruebas Node de seguridad PASS. Evidencia y límites en docs/17-auditoria-seguridad.md; etapa 16 sigue abierta.

Etapa 16: prueba nueva de lectura del residente piloto entre comunidades y lectura anónima PASS en Supabase, begin read only/rollback; script stage16_pilot_tenant_readonly.sql. Logo diferido; cierre de limpieza de PQRS y resto de matriz siguen pendientes.

2026-10-07 17:42 Colombia: worker confirmó limpieza de ambos rechazos sintéticos (deleted, sin objetos Storage); cupo PQRS recuperado a 4 restantes, comprobado por RPC con residente y pantalla administrativa. Pendiente de limpieza cerrado; etapa 16 continúa abierta por revisión restante.

Etapa 16: corregido JSON null en tres API de adjuntos; validación de cuerpo objeto y dos regresiones nuevas. Revisión de rutas documentada; revisión integral de auditoría/formularios aún pendiente.

Etapa 16: auditoría de visitas verificada en Supabase con actores, propiedad, motivo y número de eventos; PASS y rollback. Nuevo script stage16_visit_audit_transaction.sql. Sin cambios productivos; auditoría de los demás módulos sigue pendiente.

Etapa 16: tres regresiones remotas de auditoría PASS con rollback para PQRS/creación-anulación de obligación, convocatoria/RSVP/asistencia de asamblea y solicitud-aprobación-cancelación de reserva. Scripts y cobertura en docs/17-auditoria-seguridad.md. Sin cambios productivos; no se declara etapa completa.

Etapa 16: pagos/saldos/idempotencia/permisos/auditoría PASS con rollback. Revisadas muestras hospedadas Supabase Edge Function 5xx (60 min sin resultados) y Vercel (30 min, cinco GET 200 y contadores de consola en cero). Cobertura limitada documentada; falta importación financiera y consolidación final.

Etapa 16: importación financiera PASS con rollback (autorización, duplicados, atomicidad y auditoría del lote). Matriz consolidada en docs/17-auditoria-seguridad.md distingue evidencia de límites y pendientes; siguiente entrega propuesta: recorrido visual por rol y carga Excel. Sin cambios productivos; etapa 16 sigue abierta.

Etapa 16: recorrido visual residente en producción comprobado (dashboard, cartera solo 101, ruta importar devuelve 404, visitas propias sin decisiones ni movimientos administrativos). Sin escrituras. Carga Excel administrativa y vista portería requieren sus sesiones; no se cambiaron roles.

Etapa 16: sesión administrativa confirmada; plantilla Excel descargada, archivo vacío bloqueado en cliente y fila sintética con monto negativo rechazada por servidor. Evidencia guardada, sin código/permisos modificados. Importación válida por interfaz y portería siguen pendientes.


## Importación Excel válida y reversión — 2026-10-08
Alejandro confirmó que la importación administrativa de una fila sintética terminó con `?imported=1` y que la cuenta quedó bien después de revisar la cartera. La prueba usó Torre 1 · 101, $1.000 COP, referencia `RESIQ-PRUEBA-CARTERA-20261008-01`, concepto de prueba, emisión 2026-10-08 y vencimiento 2026-10-23; se preparó una copia aparte y el original permaneció intacto. La pantalla no fue inspeccionada independientemente. La obligación quedó anulada según la confirmación funcional; la RPC de anulación conserva auditoría y encola un aviso al residente, cuya entrega no fue comprobada. No se modificó código ni permisos. Etapa 16 sigue abierta para el recorrido visual de portería y la consolidación restante.

## Portería y diagnóstico de solicitudes de visita — 2026-10-08
Capturas aportadas por Alejandro muestran Portería en el listado de visitas, sin creación ni decisiones administrativas, y una visita rechazada con historial sin ingreso/salida. Falta revisar una visita autorizada y sus movimientos en pantalla.

Ante el reporte de rechazo al repetir dígitos, se verificó que la validación permite valores como 1111 y no exige unicidad del sufijo. Se detectó que createVisit interpretaba datetime-local con la zona del servidor en lugar de la del conjunto; se corrigió usando properties.timezone, se añadieron mensajes concretos para documento/ventana y se conservaron campos al devolver un error. Las 12 pruebas Node de seguridad y typecheck pasaron. El caso exacto del usuario no fue reproducido en producción; cambio local pendiente de despliegue y repetición por interfaz. Etapa 16 continúa abierta.

2026-10-08: por solicitud de Alejandro, listado de Visitas ordenado por created_at descendente, con id como desempate estable, para mostrar solicitudes nuevas primero en todos los roles y filtros. Cambio local en visitas/page.tsx, pendiente de publicación.

2026-10-08: Alejandro confirmó en sesión real de Portería el registro de salida de una visita aceptada y la visualización de hora de ingreso y salida en el detalle. Evidencia informada por usuario, sin inspección remota independiente. Pendiente la prueba transaccional de la nueva regla de horario y auditoría remota; etapa 16 abierta.

2026-10-08: captura de Portería confirma visita «Salió», horas de ingreso y salida y secuencia completa en historial. El ingreso coincide con el inicio previsto; la excepción de entrada antes/después aún requiere una prueba específica. Etapa 16 continúa abierta.

2026-10-08: revisión estática de seguridad de ingreso fuera del horario PASS en código: portería activa, estado autorizado, bloqueo transaccional, movimiento único, RLS de lectura y auditoría conservados. La regresión SQL de llegada anticipada/posterior aún no se ejecutó en Supabase. Alejandro pospuso dominio y entrega de correo a residentes; continúa etapa 16 sin declarar su cierre.


2026-10-08: Alejandro ejecutó en Supabase la prueba transaccional visit_entry_reference_schedule_transaction.sql. Captura del editor: `PASS: ingreso antes/después, rol, hora real, auditoría y movimiento único; datos revertidos`. Se cierra este pendiente específico de visitas de la etapa 16. Correo a residentes continúa aplazado hasta comprar y verificar dominio; la etapa 16 sigue abierta por sus demás límites.

Etapa 16: revisión estática del vencimiento de reservas; prueba transaccional con rollback preparada en stage16_reservation_expiration_transaction.sql, aún no ejecutada. Se distingue liberación al refrescar/operar de un vencimiento impulsado por proceso periódico, que no se comprobó. Correo a residentes sigue pospuesto.
