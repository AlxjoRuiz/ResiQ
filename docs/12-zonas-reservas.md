# Etapa 11 — Zonas y reservas

## Estado

Implementada, validada y aprobada por el usuario el 2026-10-01. La etapa 12 de cartera quedó autorizada.

## Decisiones aprobadas

- **P04:** una solicitud `pending` bloquea el horario durante 24 horas por defecto, configurable entre 60 minutos y 48 horas, sin superar el inicio solicitado. Las operaciones liberan vencimientos dentro de su transacción.
- **P05:** el MVP usa reserva exclusiva. La capacidad limita asistentes y no permite reservas concurrentes por cupos.
- **P07:** la configuración de restricción por mora existe desactivada. El bloqueo real se implementará en la etapa 12, cuando haya cartera verificable.
- **P08:** el solicitante ve sus datos completos; otros residentes sólo intervalos ocupados anónimos; portería ve la agenda operativa; administración ve y decide el detalle completo de su propiedad.

## Implementación

La migración `20261001190000_reservations.sql` crea:

- `property_policies`, con vigencia de pendientes y preparación conservadora para cartera.
- `amenities`, `amenity_hours` y `amenity_blackouts`.
- `reservations`, con estados `pending`, `approved`, `rejected`, `cancelled`, `expired` y `completed`.
- Exclusiones GiST para impedir cruces de reservas activas y cierres.
- RLS y funciones que derivan actor y propiedad desde `auth.uid()`.
- Eventos, auditoría, notificaciones internas y trabajos de correo idempotentes.

Las horas capturadas en la interfaz se convierten en PostgreSQL usando la zona horaria de la propiedad. El servidor valida vínculo vigente con el apartamento, capacidad, bloques, horario semanal, cierres, cruces y transición de estado.

## Interfaz por rol

- **Administración:** `/panel/propiedades/[propertyId]/zonas` configura zonas, horarios, reglas, cierres y vigencia de solicitudes. `/reservas` aprueba, rechaza y cancela.
- **Residente:** `/reservas/nueva` muestra horarios, reglas e intervalos ocupados anónimos de los próximos 30 días; crea reservas para apartamentos vinculados y cancela las propias antes del inicio.
- **Portería:** `/reservas` muestra zona, horario, apartamento, solicitante, asistentes y estado en modo de consulta.
- Los dashboards enlazan estas rutas según los roles activos.

## Privacidad y seguridad

- El cliente no inserta ni cambia estados de reservas directamente.
- Las claves operativas incluyen `property_id` y las relaciones compuestas impiden referencias entre propiedades.
- Residentes ajenos no reciben nombre, apartamento, asistentes ni motivos: `get_amenity_availability` sólo devuelve rango y tipo de ocupación.
- Portería usa `list_operational_reservations`, que omite correo, teléfono, cartera y motivos administrativos.
- Cierres y zonas sólo pueden ser modificados por administración.

## Validación realizada

- `npm run typecheck`: correcto.
- `npm run lint`: correcto.
- `npm run build`: correcto; Next.js publicó las rutas de reservas y zonas.
- `deno check supabase/functions/process-email-jobs/index.ts`: correcto.
- Migración aplicada en Supabase: `Success. No rows returned`.
- Prueba transaccional remota: creó una zona y una solicitud temporales, confirmó el bloqueo de una segunda reserva cruzada, verificó disponibilidad, aprobó la solicitud y ejecutó `rollback`. Resultado: `stage11_transactional_checks_passed`.

## Límites conservados

- La mora no bloquea reservas hasta completar la etapa 12.
- No hay reservas concurrentes por cupos, pagos por zonas ni penalizaciones.
- La entrega real de correo depende de las variables y el despliegue del trabajador de Resend documentado desde PQRS.
