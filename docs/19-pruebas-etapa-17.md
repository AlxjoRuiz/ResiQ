# Etapa 17 — matriz de pruebas

Estado al 8 de octubre de 2026. `PASS informado` significa que Alejandro confirmó la ejecución en Supabase; no se recibió captura ni se inspeccionó el resultado del SQL Editor de forma independiente. Los scripts transaccionales terminan con `ROLLBACK`.

| Área del prompt maestro | Evidencia disponible | Pendiente relevante |
| --- | --- | --- |
| Login | Regresión local `tests/security/safe-next.test.mjs` para redirecciones; acceso privado e invitación comprobados en el piloto de etapa 16 | Recorrido reproducible de Google y correo/contraseña, errores y cierre de sesión. Recuperación de contraseña y entrega de correo siguen aplazadas hasta contar con dominio verificado. |
| Roles | Sesiones reales/capturas de residente, administración y Portería; ruta privada de Portería devolvió 404; pruebas SQL de denegación por rol | Matriz de rutas directas por rol completa, incluida cuenta con varios roles. |
| RLS | Catálogo remoto de tablas/políticas/privilegios, lectura anónima y lectura ajena del piloto; scripts de etapa 17 entre dos propiedades | Repetir catálogo tras nuevas migraciones y cubrir otras relaciones/acciones que se agreguen. |
| Reservas | `stage17_reservations_finance_tenant_transaction.sql` — PASS informado; vencimiento y auditoría transaccionales de etapa 16 | Prueba real de transición impulsada por cron, aplazada por Alejandro. |
| PQRS | `stage17_pqrs_calls_assemblies_tenant_transaction.sql` — PASS informado; auditoría de creación/estado de etapa 16 | Recorrido completo de adjuntos y mensajes entre sesiones en una matriz E2E. |
| Paquetes | `stage17_packages_visits_tenant_transaction.sql` — PASS informado; recepción/entrega funcional de etapa 9 | Recorrido E2E repetible de recepción, aviso y entrega. |
| Visitas | `stage17_packages_visits_tenant_transaction.sql` — PASS informado; solicitudes, decisiones, ingreso/salida y auditoría de etapa 16 | Recorrido E2E repetible por los tres roles. |
| Cartera | `stage17_reservations_finance_tenant_transaction.sql` — PASS informado; pagos, importación Excel y auditoría de etapa 16 | Recorrido E2E repetible de importación, pago y anulación. |
| Llamados | `stage17_pqrs_calls_assemblies_tenant_transaction.sql` — PASS informado; transiciones y evidencias de etapa 13 | Recorrido E2E repetible de notificación, lectura y cierre. |
| Asambleas | `stage17_pqrs_calls_assemblies_tenant_transaction.sql` — PASS informado; RSVP, representación, asistencia y auditoría de etapa 16 | Recorrido E2E repetible por administrador e invitado. |
| Notificaciones | `stage17_notifications_tenant_transaction.sql` — PASS informado; revocación de lectura y privilegio `read_at` de etapa 16 | Entrega externa de correo aplazada hasta dominio verificado. |

Las pruebas SQL de esta etapa cubren acceso legítimo, lectura ajena por ID y acciones cruzadas en los módulos indicados. No sustituyen pruebas de navegador de todas las rutas ni un entorno separado de producción. La etapa 17 sigue abierta; el siguiente trabajo concreto es hacer reproducible el recorrido de login y roles sin depender de correo externo.
