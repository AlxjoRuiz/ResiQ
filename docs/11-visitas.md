# Etapa 10 — Visitas y mantenimiento

## Alcance

El módulo reúne visitas personales y servicios de mantenimiento. El residente solicita visitas para sus apartamentos vigentes. Administración consulta las solicitudes y acepta o rechaza desde el detalle; no crea visitas ni registra movimientos. Portería registra el ingreso de las visitas aceptadas y su salida; no crea ni decide solicitudes.

Cada autorización contiene visitante, apartamento, anfitrión, tipo, cantidad de personas, ventana de inicio y fin, observaciones y, para mantenimiento, empresa y tipo de servicio. Se admiten de dos a seis últimos dígitos del documento; el documento completo no se almacena.

## Estados y movimientos

1. `pending`: solicitud pendiente de administración.
2. `authorized`: administración aceptó la solicitud.
3. `rejected`: administración rechazó con motivo obligatorio.
4. `entered`: portería registró el ingreso dentro de la ventana aceptada.
5. `exited`: portería cerró el movimiento con fecha y actor.
6. `cancelled`: el residente canceló su solicitud pendiente o aceptada antes del ingreso.

Una autorización permite un solo ingreso. No hay reingreso implícito. Cada nuevo acceso requiere una autorización nueva. La ventana dura como máximo 24 horas y la base de datos rechaza ingresos fuera de ella.

## Seguridad y privacidad

- El anfitrión solo consulta y cancela sus propias autorizaciones mientras mantiene membresía y vínculo vigentes con el apartamento.
- Administración decide mediante `review_visit`; únicamente portería registra movimientos. Las RPC validan los roles aunque se invoquen directamente.
- La RLS protege `visitors`, `visitor_entries` y su historial incluso frente a llamadas directas a la API.
- No se ofrece inserción, actualización ni eliminación directa de las tablas al cliente.
- Las notas de autorizaciones delegadas anteriores se conservan como historial; el flujo nuevo no permite creación delegada.
- Cada autorización, ingreso, salida y cancelación genera evento funcional, auditoría y notificación individual al anfitrión.

## Archivos principales

- `supabase/migrations/20261001150000_visitors.sql`
- `src/app/panel/propiedades/[propertyId]/visitas/`
- `src/components/visitors/visit-forms.tsx`
- `src/lib/visitors/constants.ts`
- `supabase/functions/process-email-jobs/index.ts`

## Validación realizada — 2026-10-01

- TypeScript, ESLint y compilación de producción finalizaron sin errores.
- Migración aplicada con RLS activa en `visitors` y `visitor_entries`; ambas rutas REST respondieron `200` y no expusieron filas a una sesión anónima.
- La RPC de ingreso devolvió `401 permission denied` sin sesión autenticada.
- Prueba transaccional de mantenimiento: autorización creada, ingreso creado, salida registrada y estados comprobados; todos los registros y avisos de prueba fueron revertidos al finalizar.
- Prueba RLS dentro de la misma transacción: el anfitrión obtuvo un registro y una identidad no asociada obtuvo cero.
- La ruta autenticada `/panel/propiedades/[propertyId]/visitas/nueva` respondió `200`. La revisión visual confirmó el listado, los filtros y el formulario en escritorio; al seleccionar Torre 1 · 101 se habilitó el residente asociado y se conservaron las restricciones de campos obligatorios, longitudes, cantidad y ventana.
- La revisión a 390 × 844 px no mostró desbordamiento horizontal: el formulario se ajustó a una columna y mantuvo todos los controles accesibles.
- El único aviso del entorno fue `Failed to connect to MetaMask`, originado por `chrome-extension://.../inpage.js`; no pertenece al código de ResiQ y la carga directa del módulo continuó respondiendo correctamente.
- El rechazo fuera de la ventana está aplicado por la RPC y cubierto por la prueba transaccional de estado y horario.
- El correo real seguirá condicionado a desplegar y configurar el worker de Resend.


## Cambio aprobado — 2026-10-06

Migración `20261006230000_visit_requests.sql` aplicada. Se conserva el estado y el historial de las visitas anteriores; las nuevas comienzan pendientes. Rechazo con motivo obligatorio, aceptación solo antes del fin de la visita y decisión única protegida por bloqueo transaccional. La prueba en Supabase verificó creación por residente, rechazo de creación por administrador y portería, rechazo de revisión por residente y portería, rechazo de ingreso por administrador y de visita rechazada, aceptación, rechazo e ingreso/salida por portería. Todo se revirtió al finalizar, incluidos los avisos.

TypeScript, ESLint y build de producción con webpack correctos. Publicación verificada en Vercel: listado del administrador con solicitudes pendientes/aceptadas y sin botón de creación. Las decisiones y movimientos se comprobaron mediante las RPC en la prueba transaccional; no se ejecutó una solicitud real nueva desde las tres sesiones de usuario.
