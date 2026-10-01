# Etapa 10 — Visitas y mantenimiento

## Alcance

El módulo reúne visitas personales y servicios de mantenimiento. El residente autoriza visitas para sus apartamentos vigentes. Portería y administración pueden registrar una autorización en nombre de un residente activo, pero deben seleccionar al anfitrión y registrar cómo confirmaron su consentimiento.

Cada autorización contiene visitante, apartamento, anfitrión, tipo, cantidad de personas, ventana de inicio y fin, observaciones y, para mantenimiento, empresa y tipo de servicio. Se admiten de dos a seis últimos dígitos del documento; el documento completo no se almacena.

## Estados y movimientos

1. `authorized`: existe una autorización vigente.
2. `entered`: portería o administración registró el ingreso dentro de la ventana autorizada.
3. `exited`: se cerró el movimiento con fecha y actor.
4. `cancelled`: el anfitrión o administración canceló antes del ingreso.

Una autorización permite un solo ingreso. No hay reingreso implícito. Cada nuevo acceso requiere una autorización nueva. La ventana dura como máximo 24 horas y la base de datos rechaza ingresos fuera de ella.

## Seguridad y privacidad

- El anfitrión solo consulta y cancela sus propias autorizaciones mientras mantiene membresía y vínculo vigentes con el apartamento.
- Administración y portería consultan la proyección operativa de su propiedad y registran movimientos mediante RPC transaccionales.
- La RLS protege `visitors`, `visitor_entries` y su historial incluso frente a llamadas directas a la API.
- No se ofrece inserción, actualización ni eliminación directa de las tablas al cliente.
- La nota de autorización delegada queda visible únicamente en la vista operativa de administración y portería.
- Cada autorización, ingreso, salida y cancelación genera evento funcional, auditoría y notificación individual al anfitrión.

## Archivos principales

- `supabase/migrations/20261001150000_visitors.sql`
- `src/app/panel/propiedades/[propertyId]/visitas/`
- `src/components/visitors/visit-forms.tsx`
- `src/lib/visitors/constants.ts`
- `supabase/functions/process-email-jobs/index.ts`

## Validación prevista

- TypeScript, ESLint y compilación de producción.
- Migración aplicada con RLS activa en ambas tablas.
- Autorización personal y de mantenimiento.
- Rechazo de ingreso fuera de la ventana.
- Ingreso y salida dentro de la ventana con historial.
- Destinatario autorizado obtiene sus registros y una identidad ajena obtiene cero.
- El correo real seguirá condicionado a desplegar y configurar el worker de Resend.
