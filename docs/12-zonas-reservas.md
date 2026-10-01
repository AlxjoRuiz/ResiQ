# Etapa 11 — Propuesta de zonas y reservas

## Objetivo

Permitir que administración configure zonas, horarios y cierres; que residentes vinculados consulten disponibilidad y creen o cancelen sus propias reservas; y que administración apruebe o rechace solicitudes cuando la zona lo requiera. Todas las operaciones quedan aisladas por propiedad, auditadas y protegidas con RLS.

## Decisiones propuestas para aprobación

### P04 — Reservas pendientes

- Una solicitud `pending` bloquea el horario para evitar que varias personas reciban una expectativa sobre el mismo turno.
- El bloqueo pendiente vence después de 24 horas, configurable por propiedad entre 60 minutos y 48 horas, y nunca puede superar el inicio solicitado.
- Las RPC que consultan disponibilidad, crean o deciden reservas liberan pendientes vencidas dentro de la transacción. Una tarea programada podrá limpiar anticipadamente, pero la corrección no dependerá de ella.
- Una zona que no requiere aprobación crea la reserva directamente como `approved`.

### P05 — Modalidad de reserva

- El MVP usa reserva exclusiva: una sola unidad ocupa la zona durante cada intervalo.
- `capacity` limita la cantidad declarada de asistentes, pero no habilita reservas concurrentes por cupos.
- El intervalo debe respetar los horarios semanales de la zona y no puede cruzar dos franjas ni dos días locales.

### P07 — Restricción por mora

- En la etapa 11 se crea la configuración con `restrict_reservations_for_debt = false` y `minimum_overdue_days = 30`.
- La restricción permanece inactiva hasta que la etapa 12 implemente cartera, saldo vencido y el protocolo transaccional común.
- Ninguna reserva será rechazada por mora antes de contar con datos financieros verificables. La interfaz indicará que esta política se habilita al completar cartera.

### P08 — Visibilidad

- El solicitante ve el detalle completo de sus reservas vigentes mientras conserva membresía y vínculo con el apartamento.
- Otros residentes ven únicamente intervalos ocupados por zona, sin nombre, apartamento, cantidad de asistentes ni motivo.
- Portería ve la agenda operativa: zona, fecha, horario, apartamento, nombre visible del solicitante, cantidad de asistentes y estado.
- Portería no ve correo, teléfono, información financiera, motivos de rechazo ni notas administrativas.
- Administración ve el detalle completo de su propiedad y decide solicitudes pendientes.

## Reglas funcionales

- Administración crea, edita, activa y desactiva zonas; configura capacidad, franjas semanales, duración base, reglas y necesidad de aprobación.
- Los horarios se interpretan con la zona horaria de la propiedad. Los tramos que cruzan medianoche se dividen por día.
- Los cierres excepcionales bloquean nuevas reservas. Si ya existen reservas activas, el cierre se rechaza y muestra los conflictos para que administración los resuelva explícitamente.
- Desactivar una zona impide reservas nuevas y conserva el historial. Si existen reservas futuras activas, administración debe resolverlas antes de desactivar.
- El residente puede cancelar una reserva propia `pending` o `approved` antes del inicio. Administración puede cancelar antes del inicio dejando un motivo.
- Solo administración aprueba o rechaza. Portería consulta la agenda operativa y no modifica decisiones.
- La prevención de solapamientos se aplica en PostgreSQL mediante exclusión de rangos, además de validaciones transaccionales.
- Crear, aprobar, rechazar, cancelar y expirar genera evento funcional, auditoría y notificación interna; el correo usa la cola existente.

## Entidades previstas

- `property_policies`
- `amenities`
- `amenity_hours`
- `amenity_blackouts`
- `reservations`

Las relaciones usan claves compuestas con `property_id`. El cliente no inserta ni cambia estados directamente: las operaciones sensibles pasan por RPC con actor derivado de `auth.uid()`.

## Interfaz prevista

- Administración: listado de zonas, formulario de zona, horarios, cierres y bandeja de reservas pendientes.
- Residente: catálogo, disponibilidad anónima, creación, detalle y cancelación propia.
- Portería: agenda operativa de reservas.
- Dashboards: accesos por rol y contadores mínimos, sin exposición de datos ajenos.

## Validación prevista

- TypeScript, ESLint y compilación de producción.
- RLS con solicitante, otro residente, portería, administración y propiedad ajena.
- Concurrencia real: dos reservas simultáneas sobre el mismo intervalo producen una aceptación y un conflicto controlado.
- Pendiente vencida libera el horario de forma atómica.
- Horarios, capacidad, cierres, zona inactiva y cancelaciones fuera de transición se rechazan.
- Revisión visual en escritorio y móvil.

## Fuera de esta etapa

- El cálculo y bloqueo real por mora se completa en la etapa 12.
- Reservas concurrentes por cupos requieren un diseño posterior.
- Pagos en línea, cobros por zona y penalizaciones no forman parte del alcance aprobado.
