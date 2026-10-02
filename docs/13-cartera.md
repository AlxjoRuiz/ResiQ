# Etapa 12 — Cartera

## Estado

Diseño propuesto el 2026-10-01. La etapa fue autorizada después de aprobar zonas y reservas, pero **P02 y P03 requieren aprobación explícita antes de crear migraciones o código financiero**.

## 1. Objetivo

Incorporar un auxiliar de cartera por apartamento para que la administración registre obligaciones y pagos, el sistema calcule saldos y mora, las personas expresamente autorizadas consulten su propia información y la política aprobada pueda impedir reservas cuando corresponda.

Este módulo no será contabilidad completa, facturación electrónica, conciliación bancaria ni pasarela de pagos. Esas integraciones continúan reservadas para P11 y la preparación comercial.

## 2. Decisiones propuestas

### P02 — Quién puede consultar la cartera

Propuesta:

- El acceso financiero se concede por apartamento y por vínculo vigente mediante `unit_memberships.finance_access`.
- El acceso empieza desactivado. La administración lo habilita expresamente para el propietario o residente responsable; puede autorizar a más de una persona de la misma unidad cuando sea necesario.
- Una persona autorizada ve únicamente el resumen, obligaciones, pagos y aplicaciones de ese apartamento. No ve cartera de otros apartamentos ni datos personales financieros de otros ocupantes.
- El acceso termina inmediatamente cuando la administración lo revoca o finaliza el vínculo con la unidad. Mantener otra membresía en la propiedad no conserva el historial financiero de la unidad anterior.
- Administración ve y gestiona la cartera completa de su propiedad. Portería, superadministración de la plataforma y miembros sin `finance_access` no acceden a saldos, movimientos, exportaciones ni conteos derivados.
- Ser propietario o residente no concede acceso automáticamente. La interfaz administrativa mostrará de forma clara quién tiene acceso financiero en cada apartamento.

Esta regla mantiene el principio conservador aprobado en seguridad y permite manejar casos donde el ocupante no debe conocer la deuda del propietario.

### P03 — Cómo cargar la cartera

Propuesta para el MVP:

1. **Registro manual individual:** la administración crea obligaciones y registra pagos desde formularios.
2. **Importación por Excel `.xlsx`:** se entrega una plantilla para obligaciones con apartamento, concepto, valor, fecha de emisión, fecha de vencimiento y referencia externa opcional.
3. **Vista previa obligatoria:** antes de guardar, el sistema valida columnas, apartamentos, fechas, valores positivos, duplicados y errores por fila. Ningún dato se guarda durante la vista previa.
4. **Confirmación transaccional:** las filas válidas se confirman como un lote auditable; si aparece un error de integridad, el lote completo se revierte para evitar cargas parciales difíciles de conciliar.
5. **Saldos iniciales:** se importan como obligaciones con origen `opening_balance`, fecha de corte y referencia de lote. No se reemplaza un saldo existente de forma silenciosa.
6. **Sin integración externa por ahora:** conexión con software contable, bancos, PSE o pasarelas queda fuera de esta etapa.

Los pagos se registran manualmente en el MVP. La administración distribuye el valor entre obligaciones pendientes; un botón puede proponer aplicar primero a la obligación más antigua, pero siempre muestra la distribución antes de confirmar. No se permite aplicar más que el saldo del pago o de la obligación.

### P07 — Mora y restricción de reservas

- La política conserva el interruptor por propiedad y permanece desactivada por defecto.
- El umbral inicial es **30 días calendario**, configurable por administración.
- Una unidad cumple la condición de bloqueo cuando tiene una obligación activa con saldo pendiente cuya fecha de vencimiento alcanzó o superó el umbral: `fecha local de la propiedad - fecha de vencimiento >= días configurados`.
- Se evalúa únicamente el apartamento usado para reservar. La deuda de otra unidad vinculada a la misma persona no bloquea esa reserva.
- Al activar la restricción, la administración confirma que ya cargó los saldos vigentes. El servidor revalida la deuda dentro de la transacción de reserva y responde solamente permitido/denegado, sin revelar importes a portería ni a otros residentes.
- El mensaje al residente será respetuoso y no mostrará cifras: “No puedes realizar reservas en este momento porque tu cuenta presenta un saldo pendiente. Comunícate con la administración para obtener información sobre tu cartera.”

## 3. Reglas de datos y operación

- `accounts_receivable` guarda obligaciones; `payments` registra pagos recibidos; `payment_allocations` distribuye pagos entre obligaciones.
- El saldo se calcula con obligaciones activas menos aplicaciones de pagos vigentes. No se guarda como un campo editable.
- Los estados calculados son: **Al día** (saldo cero), **Pendiente** (saldo positivo sin vencimiento) y **En mora** (saldo vencido positivo).
- La moneda inicial es COP. Cada registro conserva código de moneda y no se hacen conversiones; pago y obligación deben usar la misma moneda.
- El propietario mostrado se obtiene del vínculo vigente del apartamento y no se copia como deudor histórico. El dato evita atribuir automáticamente una deuda pasada al propietario actual.
- Obligaciones y pagos no se eliminan. Se anulan con motivo obligatorio, actor, fecha y auditoría; la anulación recalcula el saldo.
- Referencias externas e identificadores de lote evitan importar dos veces la misma obligación.
- Todas las mutaciones se realizan mediante operaciones transaccionales que derivan actor y propiedad de la sesión, bloquean filas en orden estable y generan actividad, auditoría y notificaciones en la misma transacción.

## 4. Interfaz prevista

### Administración

- Resumen de cartera con saldo total, vencido, unidades al día, pendientes y en mora.
- Tabla por apartamento con filtros de torre, estado, vencimiento y búsqueda.
- Detalle de cuenta con obligaciones, pagos, aplicaciones y saldo vivo.
- Formularios para obligación, pago, anulación y distribución de pago.
- Importador de Excel con descarga de plantilla, vista previa, errores por fila y confirmación de lote.
- Configuración del umbral y activación de restricción de reservas.

### Persona con acceso financiero

- Selector de apartamento cuando tenga varios vínculos autorizados.
- Resumen de estado, saldo total, valor vencido, vencimiento más antiguo y días de mora.
- Historial de obligaciones, pagos y aplicaciones de su apartamento.
- Sin botones para registrar pagos, marcar obligaciones como pagadas, cambiar saldos o exportar otras unidades.

### Portería y plataforma

- Ninguna ruta, tarjeta, exportación o contador financiero.

## 5. Notificaciones

- Al registrar una obligación o pago, el sistema crea notificación interna y trabajo de correo para los miembros vigentes con acceso financiero a la unidad.
- Un proceso diario detecta el primer cruce del umbral de mora y genera un aviso deduplicado por obligación, ciclo y umbral. Una modificación o pago reevalúa el estado inmediatamente.
- El correo muestra apartamento, concepto, fecha y saldo pertinente únicamente al destinatario autorizado. No se envía a miembros sin acceso financiero.
- Los reintentos, historial e idempotencia utilizan la cola existente; la entrega real sigue dependiendo de la configuración de Resend.

## 6. Archivos previstos al implementar

- Migración de Supabase para tablas, vistas seguras, funciones transaccionales, RLS, auditoría y conexión con reservas.
- Rutas administrativas y de residente bajo `/panel/propiedades/[propertyId]/cartera`.
- Componentes y validaciones para obligaciones, pagos, aplicaciones, políticas e importación.
- Extensión del trabajador de correo para avisos de cartera.
- Actualización de dashboards y documentación de operación y pruebas.

Los nombres exactos se fijarán durante la implementación; este diseño no crea todavía código ni migraciones.

## 7. Pruebas de aceptación previstas

- Aislamiento completo entre propiedades y apartamentos, incluso con UUID conocido.
- Portería, superadmin y miembro sin `finance_access` reciben cero datos financieros.
- Conceder y retirar `finance_access` produce efecto inmediato; finalizar el vínculo elimina también el acceso histórico.
- Importación rechaza columnas inválidas, valores no positivos, unidad ajena y referencia duplicada; un fallo revierte el lote.
- Dos operaciones concurrentes no sobreaplican un pago ni una obligación.
- Anular un pago u obligación recalcula el saldo sin borrar historial.
- El estado Al día/Pendiente/En mora y los días se calculan con la fecha local de la propiedad.
- La reserva se permite con política inactiva o deuda bajo el umbral, y se bloquea al alcanzar 30 días cuando la política está activa.
- La deuda de una unidad no bloquea reservar desde otra unidad del mismo usuario.
- Avisos y correos se deduplican y solo se crean para destinatarios autorizados.
- TypeScript, ESLint, compilación, comprobación Deno y prueba transaccional remota finalizan correctamente.

## 8. Checklist de diseño

- [x] Objetivo y límites del módulo definidos.
- [x] Propuesta P02 de visibilidad por autorización expresa.
- [x] Propuesta P03 de registro manual e importación Excel con vista previa.
- [x] Regla P07 cerrada con cálculo exacto por unidad.
- [x] Operaciones, privacidad, interfaz, notificaciones y pruebas previstas.
- [ ] P02 y P03 aprobadas por el usuario.
- [ ] Migración y aplicación implementadas.
- [ ] Validación local y remota completada.
- [ ] Etapa 12 aprobada después de la implementación.

## 9. Siguiente paso

Después de aprobar P02, P03 y el alcance anterior, implementar únicamente la etapa 12. Al terminar, presentar migración aplicada, pruebas, archivos modificados y resultados; no iniciar la etapa 13 sin una nueva aprobación explícita.
