# Seguimiento del proyecto

Actualizado: 2026-10-01. Fuente de autoridad: `00-prompt-maestro.md` y aprobaciones explícitas del usuario en esta conversación.

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
| 9 | Paquetes | Implementada y validada; pendiente de aprobación explícita del usuario |
| 10 | Visitas y mantenimiento | No iniciada |
| 11 | Zonas y reservas | No iniciada |
| 12 | Cartera | No iniciada |
| 13 | Llamados de atención | No iniciada |
| 14 | Asambleas | No iniciada |
| 15 | Notificaciones y comunicaciones | No iniciada |
| 16 | Auditoría integral y seguridad | No iniciada |
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

### Trabajo funcional todavía no iniciado

| Etapa | Trabajo principal pendiente |
|---|---|
| 6 | Gestión multi-tenant completa: propiedades, edificios, unidades, miembros, roles y vínculos |
| 7 | Dashboards para residente, portería, administración y plataforma |
| 8 | PQRS, mensajes y adjuntos privados |
| 9 | Paquetes, estados, entrega y avisos |
| 10 | Visitantes, entradas y mantenimiento como tipo de visita |
| 11 | Zonas comunes, horarios, bloqueos y reservas |
| 12 | Cartera, obligaciones, pagos, aplicaciones y reglas de mora |
| 13 | Llamados de atención, destinatarios y adjuntos |
| 14 | Asambleas, agenda, documentos, asistentes y representación |
| 15 | Notificaciones internas, comunicaciones y correo centralizado |
| 16 | Auditoría integral y revisión de seguridad |
| 17 | Pruebas unitarias, integración, RLS y E2E integrales |
| 18 | Revisión responsive, accesibilidad y experiencia completa |
| 19 | Despliegue público, variables, dominio y comprobaciones de producción |
| 20 | Planes, límites, operación y preparación comercial SaaS |

### Capacidades transversales pendientes

- Completar la biblioteca visual: formularios, tablas, diálogos, navegación, avisos, paginación, fechas, carga de archivos y estados vacíos/carga/error.
- Implementar Storage privado, validación de archivos y descargas autorizadas.
- Implementar colas y registros de correo con proveedor, reintentos e idempotencia.
- Implementar eventos de actividad y auditoría desde cada operación de negocio.
- Crear la administración de plataforma, planes y asignaciones prevista para la etapa 20.
- Incorporar una suite de pruebas automatizadas; actualmente no hay casos en `tests` ni comandos de pruebas en `package.json`.

### Decisiones que deben cerrarse antes de implementar

- P01 y P06 quedaron resueltas antes de implementar la etapa 6.
- Antes de las etapas 9 y 11: P08 (datos mínimos visibles para portería y destinatarios compartidos).
- Antes de la etapa 11: P04, P05 y P07 para ocupación, cupos y restricciones por mora.
- Antes de la etapa 12: P02 y P03 para visibilidad y carga de cartera.
- Antes de la etapa 14: P09 para convocatoria, representación y conservación de evidencia.
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
| P02 | Cartera visible a residentes además del propietario | Propuesta: autorización expresa; cerrar en etapa 3 |
| P03 | Carga de cartera manual, Excel o integración | Manual es propuesta, no elección confirmada; cerrar antes de etapa 12 |
| P04 | Reservas pendientes ocupan horario y vencen | Sin decisión; cerrar antes de etapa 11 |
| P05 | Reserva exclusiva o por cupos | MVP exclusivo propuesto; cerrar antes de etapa 11 |
| P06 | Acceso histórico al mudarse o perder membresía | Aprobada: retirar de inmediato el acceso operativo e histórico del antiguo miembro; administración conserva los registros para auditoría |
| P07 | Mora: umbral, saldo, fecha de cómputo y reglas aplicables | 30 días es valor inicial solicitado; precisar comparación y validar regla de restricción antes de activarla |
| P08 | Destinatarios compartidos de paquetes y visibilidad de reservas para portería | Aprobada para paquetes: portería ve torre/apartamento y nombres de residentes activos, sin correo, teléfono, roles ni historial; solo el destinatario asociado ve el paquete. Reservas se precisarán en la etapa 11 |
| P09 | Convocatoria de asambleas, representación y conservación de evidencia | Definir con propiedad antes de etapa 14; no asumir reglas legales |
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
