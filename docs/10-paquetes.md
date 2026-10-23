# Etapa 9 — Paquetes

## Alcance aprobado

El módulo permite a portería registrar la recepción y la entrega de paquetes; administración solo los consulta. El registro contiene apartamento, destinatario, transportadora, guía, remitente, origen, descripción y observaciones. El nombre de quien retira el paquete queda guardado aunque sea distinto del destinatario.

El ingreso y la salida de visitantes o personal de mantenimiento se implementarán en la etapa 10. No forman parte del movimiento de un paquete.

## P08 y privacidad

- Portería consulta únicamente torre, apartamento y nombres visibles de residentes con vínculo vigente. No recibe correo, teléfono, roles ni historial personal.
- Un residente solo puede leer un paquete si fue asociado expresamente como destinatario y conserva una membresía y un vínculo vigentes con el apartamento.
- Otros ocupantes del mismo apartamento no obtienen acceso automático.
- Cuando el destinatario todavía no tiene cuenta o vínculo, el paquete queda visible solo para portería y administración. Puede asociarse posteriormente a un residente activo de ese apartamento.
- Solo portería puede registrar recepciones, asociar destinatarios y registrar entregas (desde `20261025160000_packages_concierge_only.sql`). Administración consulta la lista, el historial y el detalle. Las funciones de la base de datos aplican estas reglas incluso si se intenta usar la API directamente.

## Estados y trazabilidad

1. `received`: el paquete fue recibido en portería.
2. `notified`: Resend aceptó el correo para envío. Este estado no afirma que el destinatario lo leyó.
3. `delivered`: portería registró el nombre de quien retiró el paquete.

Cada operación genera un evento funcional y un registro de auditoría. La entrega directa puede ocurrir antes de que el proveedor acepte un correo; en ese caso el paquete queda entregado sin inventar una fecha de notificación.

## Correo

Cuando hay destinatario asociado, la operación crea una notificación interna y un trabajo de correo idempotente. `process-email-jobs` genera el mensaje de paquete y `complete_email_job` cambia el estado a `notified` solo si Resend devuelve un identificador aceptado. El envío real requiere los secretos documentados en `09-pqrs.md`.

## Recibos físicos de servicios públicos — 2026-10-09

Portería también puede registrar un recibo físico de luz, gas o agua desde «Registrar llegada». Comparte el control de destinatario, privacidad, historial y retiro de paquetes. Se distingue por `packages.kind='utility_bill'` y `utility_service`; los paquetes anteriores conservan `kind='package'`.

Si se elige un residente con vínculo vigente, se crea **un aviso interno** específico («Recibo de agua en portería», por ejemplo), visible solo para esa cuenta. Si no aparece en el directorio, el recibo queda pendiente de asociar y no genera aviso; asociarlo más adelante crea el aviso una sola vez. Los recibos no generan trabajos de correo hasta que el dominio y la plantilla de envío estén listos. El flujo de correo de paquetes permanece como estaba.

La migración `20261009180000_utility_bills_at_concierge.sql` debe aplicarse **antes** de publicar la interfaz que consulta `kind` y `utility_service`. La regresión `utility_bill_reception_transaction.sql` prueba recepción, aviso, asociación posterior y aislamiento con `BEGIN/ROLLBACK`.

**Validación 2026-10-09:** Alejandro aplicó la migración corregida en Supabase y mostró `Success. No rows returned`. La primera ejecución falló por un nombre de restricción duplicado y no dejó columnas ni función instaladas; se corrigió el nombre y se añadió una transacción. Después ejecutó la regresión y mostró `utility_bill_reception_notice_passed_rollback`. Confirmó también que pudo registrar un recibo desde Portería y ver el aviso con la cuenta del residente elegido. Esta última comprobación fue informada por el usuario; su sesión no se inspeccionó independientemente.

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

## Sin recepción de recibos en portería (25/10/2026)

Por decisión de Alejandro, portería ya no registra recibos de servicios públicos (luz, gas, agua). El formulario de llegada registra solo paquetes, el servidor dejó de aceptar recibos y `20261025120000_remove_utility_bill_reception.sql` retira el permiso de `register_utility_bill`. No se borró nada: los recibos ya registrados siguen visibles con su etiqueta y se pueden entregar. Los textos «Paquetes y recibos» pasaron a «Paquetes».

## Paquetes en portería con el estilo de Visitas (25/10/2026)

A pedido de Alejandro, portería tiene una vista propia de Paquetes (los residentes conservan la anterior): pestañas **Por entregar** (todos los que están en portería, los más antiguos primero), **Hoy** (llegaron o se entregaron hoy) e **Historial** (entregados en días anteriores, agrupados por día, en páginas de 50 y con el mismo ícono de calendario de Visitas: al elegir una fecha muestra desde ese día hasta hoy). Las tarjetas siguen el diseño de Notificaciones: amarillo por entregar y verde entregado, con la hora de llegada, la hora de entrega y quién lo recogió. «Marcar entregado» se hace desde la tarjeta, escribiendo quién lo recoge.

Administración ve las mismas pestañas (Por entregar, Hoy e Historial) y el detalle de cada paquete, solo para consultar: sin «Registrar llegada», sin «Marcar entregado» y sin asociar destinatario. Si una cuenta tiene ambos roles, conserva las acciones de portería.
