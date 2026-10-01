# Etapa 9 — Paquetes

## Alcance aprobado

El módulo permite a portería y administración registrar la recepción y la entrega de paquetes. El registro contiene apartamento, destinatario, transportadora, guía, remitente, origen, descripción y observaciones. El nombre de quien retira el paquete queda guardado aunque sea distinto del destinatario.

El ingreso y la salida de visitantes o personal de mantenimiento se implementarán en la etapa 10. No forman parte del movimiento de un paquete.

## P08 y privacidad

- Portería consulta únicamente torre, apartamento y nombres visibles de residentes con vínculo vigente. No recibe correo, teléfono, roles ni historial personal.
- Un residente solo puede leer un paquete si fue asociado expresamente como destinatario y conserva una membresía y un vínculo vigentes con el apartamento.
- Otros ocupantes del mismo apartamento no obtienen acceso automático.
- Cuando el destinatario todavía no tiene cuenta o vínculo, el paquete queda visible solo para portería y administración. Puede asociarse posteriormente a un residente activo de ese apartamento.
- Administración y portería pueden registrar recepciones, asociar destinatarios y registrar entregas. La RLS aplica estas reglas incluso si se intenta usar la API directamente.

## Estados y trazabilidad

1. `received`: el paquete fue recibido en portería.
2. `notified`: Resend aceptó el correo para envío. Este estado no afirma que el destinatario lo leyó.
3. `delivered`: portería o administración registró el nombre de quien retiró el paquete.

Cada operación genera un evento funcional y un registro de auditoría. La entrega directa puede ocurrir antes de que el proveedor acepte un correo; en ese caso el paquete queda entregado sin inventar una fecha de notificación.

## Correo

Cuando hay destinatario asociado, la operación crea una notificación interna y un trabajo de correo idempotente. `process-email-jobs` genera el mensaje de paquete y `complete_email_job` cambia el estado a `notified` solo si Resend devuelve un identificador aceptado. El envío real requiere los secretos documentados en `09-pqrs.md`.

## Archivos principales

- `supabase/migrations/20261001100000_packages.sql`
- `src/app/panel/propiedades/[propertyId]/paquetes/`
- `src/components/packages/package-forms.tsx`
- `src/lib/packages/constants.ts`
- `supabase/functions/process-email-jobs/index.ts`

## Validación realizada — 2026-10-01

- TypeScript, ESLint y compilación de producción finalizados sin errores.
- Migración aplicada en Supabase; `packages` existe con RLS activa y las cuatro RPC públicas fueron resueltas por PostgreSQL.
- Paquete de control registrado desde administración para Torre 1, apartamento 101, con transportadora, guía, remitente y origen.
- Entrega registrada a nombre de una persona y comprobada en el historial junto al evento de recepción.
- Prueba RLS mediante dos identidades: el destinatario asociado obtuvo un paquete y una identidad no asociada obtuvo cero.
- Correo real pendiente mientras Resend no tenga sus secretos y dominio configurados.
