# Seguimiento del proyecto

Actualizado: 2026-09-28. Fuente de autoridad: `00-prompt-maestro.md` y aprobaciones explícitas del usuario en esta conversación.

## Estado de etapas

| Etapa | Entregable | Estado |
|---|---|---|
| 0 | Análisis, alcance, riesgos y MVP | Aprobada por el usuario: «si te apruebo la propuestas» |
| 1 | Arquitectura | Aprobada: «esta aprobado, pero recuerda el promt que te pase, lleva ese seguimiento» |
| 2 | Modelo de datos y ER | Aprobada: «esta perfecto, aprobado. sigamos» |
| 3 | Diseño detallado de seguridad y RLS | Aprobada: «aprobado sigamos» |
| 4 | Inicialización del proyecto | Aprobada por el usuario al ordenar continuar y configurar Supabase |
| 5 | Autenticación e invitaciones | En implementación; migración aplicada en Supabase y RLS verificado, configuración OAuth y pruebas remotas pendientes |
| 6 | Multi-tenancy funcional | No iniciada |
| 7 | Dashboards | No iniciada |
| 8 | PQRS | No iniciada |
| 9 | Paquetes | No iniciada |
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
| P01 | Permitir múltiples propiedades/unidades por usuario | Arquitectura compatible; confirmar política de uso antes de implementar vinculaciones |
| P02 | Cartera visible a residentes además del propietario | Propuesta: autorización expresa; cerrar en etapa 3 |
| P03 | Carga de cartera manual, Excel o integración | Manual es propuesta, no elección confirmada; cerrar antes de etapa 12 |
| P04 | Reservas pendientes ocupan horario y vencen | Sin decisión; cerrar antes de etapa 11 |
| P05 | Reserva exclusiva o por cupos | MVP exclusivo propuesto; cerrar antes de etapa 11 |
| P06 | Acceso histórico al mudarse o perder membresía | Propuesta conservadora: retirar acceso operativo; definir excepciones antes de etapa 3 |
| P07 | Mora: umbral, saldo, fecha de cómputo y reglas aplicables | 30 días es valor inicial solicitado; precisar comparación y validar regla de restricción antes de activarla |
| P08 | Destinatarios compartidos de paquetes y visibilidad de reservas para portería | Definir alcance de datos mínimos antes de módulos respectivos |
| P09 | Convocatoria de asambleas, representación y conservación de evidencia | Definir con propiedad antes de etapa 14; no asumir reglas legales |
| P10 | Correo, dominio, límites de archivos, conservación y respaldo | Definir proveedor y parámetros antes de implementar las partes correspondientes |
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
- Etapa 3 aprobada. Etapa 4 entregada y verificada en `05-inicializacion.md`; mantener reglas P02/P06 pendientes y denegación conservadora.
- Etapa 4 aprobada. Etapa 5 autorizada explícitamente el 2026-09-28 al solicitar continuar después del restablecimiento de uso.
- El 2026-09-29 se aplicó `20260929003500_auth_and_invitations.sql` al proyecto Supabase ResiQ. La consulta de verificación devolvió las siete tablas esperadas (`profiles`, `properties`, `property_members`, `buildings`, `units`, `unit_memberships`, `invitations`) con RLS activo.
