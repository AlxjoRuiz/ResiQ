# Propuesta de cierre de la etapa 17 — Testing integral

Estado al 14 de octubre de 2026: **aprobada por Alejandro con las salvedades enumeradas**. Su mensaje «Empecemos con la etapa 18» autoriza el siguiente paso. Alcance del prompt maestro: login, roles, RLS, Reservas, PQRS, Paquetes, Visitas, Cartera, Llamados, Asambleas y Notificaciones, con énfasis en aislamiento entre propiedades. La evidencia detallada está en `19-pruebas-etapa-17.md` y `20-recorrido-login-roles-etapa-17.md`.

## Evidencia que permite proponer el cierre

- Login e invitaciones: una cuenta sin invitación aceptada no pasa del login; dos rutas de alta (Google y correo/contraseña) y reingreso autorizado comprobados por Alejandro. Las pruebas locales sin sesión y de seguridad pasaron.
- Roles, RLS y aislamiento: rutas denegadas verificadas con Residente y Portería; pruebas SQL multirrol y entre propiedades pasaron con `ROLLBACK`. El catálogo general quedó sin hallazgos; el catálogo de comprobantes financieros y la nueva función operativa de Reservas mostraron permisos esperados.
- Reservas: creación, duración menor al máximo, horario nocturno, calendario anónimo, aprobación, rechazo y cancelación con motivos; avisos únicos al Residente y a Portería; orden por fecha de solicitud. SQL transaccional y pruebas de navegador informadas como correctas.
- PQRS: creación, adjunto privado, conversación bidireccional sin duplicados y cambios de estado hasta cierre.
- Paquetes y Visitas: recepción/entrega y movimientos, avisos y lectura según rol.
- Cartera: obligación sintética, comprobante privado, pago, anulación y saldo; protección posterior contra anular una obligación con pago activo, con regresión SQL aprobada.
- Llamados y Asambleas: creación, lectura de destinatario, evidencias privadas y RSVP comprobados hasta los puntos que permiten las dependencias externas o la fecha programada.
- Notificaciones y Comunicados: aviso único, lectura, enlace al contenido y denegación de contenido a Portería cuando no es destinataria.

La mayoría de pruebas de navegador son resultados informados por Alejandro; no equivalen a una inspección independiente de todas las sesiones. Las pruebas SQL con `ROLLBACK` y las locales complementan, pero no sustituyen, los recorridos reales.

## Salvedades explícitamente aplazadas

1. **Viernes 16 / lunes 19 de octubre:** prueba de vencimiento real por cron de una reserva pendiente. El procedimiento y la consulta previa a abrir la app están en `21-plan-de-cierre.md`.
2. **20 de octubre:** iniciar la asamblea ya programada, registrar asistencia y cerrarla cuando corresponda.
3. **Dominio y correo externo:** verificar dominio/remitente y entonces probar invitaciones por correo, recuperación de contraseña, entrega externa y continuación/cierre del llamado de atención.
4. **Administración ante propiedad ajena:** la cuenta actual administra Bosques y Mirador; aún no existe flujo de superadministración para asignar una segunda cuenta administradora de una sola propiedad. La prueba SQL de aislamiento pasó, pero la visual sigue pendiente.
5. **Documentos y comunicado entre propiedades:** ampliar la prueba visual con identidades de otra propiedad cuando existan cuentas apropiadas.
6. **Respaldo externo y preparación formal de producción:** pertenecen al cierre operativo posterior; el piloto en Vercel no es declaración de producción lista.

## Decisión tomada

Alejandro aprobó el **cierre de la etapa 17 con estas salvedades** y autorizó la **etapa 18 — Responsive y UX**. Esa etapa revisará escritorio, tableta y móvil, priorizando la experiencia del residente. Este cierre no declara terminadas las salvedades ni autoriza por sí mismo la etapa 19 de producción o la etapa 20 comercial.
