# Pendientes de ResiQ — revisión del 13 de octubre de 2026

Este documento separa trabajo pendiente de evidencia pendiente. La referencia de alcance es `00-prompt-maestro.md`; los resultados detallados están en `19-pruebas-etapa-17.md` y `20-recorrido-login-roles-etapa-17.md`. No se considera ejecutada una prueba de producción a partir de una prueba local o una captura de otra sesión.

## Para cerrar la etapa 17

| Prioridad | Pendiente | Estado y siguiente acción |
| --- | --- | --- |
| 1 | Acceso después del bloqueo de cuentas sin invitación | Completo según pruebas informadas por Alejandro el 13 de octubre: una cuenta sin invitación aceptada no pasa del login; una cuenta invitada entra por contraseña y luego también por Google; una cuenta nueva aceptó con Google, vio «Crea tu contraseña» y después entró con correo y la contraseña creada. El enlace mantiene ambas opciones de alta desde `132d428`. No se inspeccionaron las sesiones de forma independiente. |
| 2 | Aislamiento visual de Administración entre propiedades | Residente y Portería ya recibieron 404 ante propiedad ajena. La cuenta administrativa actual pertenece a Bosques y Mirador; probar con una tercera propiedad donde no tenga membresía, sin crear datos reales innecesarios. La prueba SQL multirrol ya pasó, pero no sustituye esta comprobación de interfaz. |
| 3 | Documentos privados de Llamados y Asambleas | PQRS: carga real de residente y descarga/denegación a Portería comprobadas. Asambleas: Alejandro cargó un PNG sintético como Soporte en un borrador de prueba y confirmó que aparece y se descarga; la denegación a Portería se había comprobado con otro archivo. En el Llamado dirigido solo a su cuenta, el detalle abre y el PNG se descarga tanto desde Administración como desde la cuenta Residente destinataria; con Portería, el enlace directo respondió «No encontrado». Falta acceso cruzado por otra propiedad. |
| 4 | Catálogo de seguridad tras migraciones recientes | Cerrado el 13 de octubre: después de aplicar `20261013223000_revoke_announcement_truncate.sql`, Alejandro repitió el catálogo y confirmó vacías las listas de tablas sin RLS, funciones privilegiadas sin `search_path`, RPC internas expuestas, políticas internas de escritura y permisos `TRUNCATE` de roles de navegador. `notifications` solo permite actualizar `read_at`. Resultado informado por el usuario. |
| 5 | Recorrido E2E repetible por módulos | La matriz SQL de etapa 17 pasó para los módulos principales. Documentar y repetir con cuentas reales de prueba el ciclo de PQRS, paquetes, visitas, reservas, cartera, llamados, asambleas y avisos, sin crear obligaciones ni mensajes destinados a personas ajenas. Las pruebas unitarias no reemplazan esta comprobación. |

El 13 de octubre se repitieron las pruebas locales: `npm run test:security` dio 15/15 PASS y el servidor local de producción devolvió 5/5 PASS en `tests/e2e/unauthenticated-routes.test.mjs`. Ninguna de ellas usa una sesión autenticada real.

## Aplazado por una dependencia conocida

- **Dominio y correo:** comprar y verificar un dominio, configurar remitente autorizado en Resend, actualizar `RESEND_FROM_EMAIL` y `APP_URL`, y entonces comprobar invitaciones por correo, notificaciones externas y recuperación de contraseña. Hoy la invitación se comparte mediante el enlace mostrado una sola vez; crearla no envía un mensaje automáticamente.
- **Reserva vencida por cron:** se comprobó la transición en SQL y la ejecución periódica del cron; Alejandro aplazó observar un vencimiento real procesado sin interacción.
- **Respaldo externo:** definir y comprobar una copia fuera de Supabase antes de declarar producción lista.

## Después de cerrar las pruebas

- **Etapa 18:** revisión integral en escritorio, tableta y móvil, con accesibilidad y prioridad para la experiencia del residente. Se han corregido aspectos puntuales, pero no se ha completado el barrido de todas las vistas.
- **Etapa 19:** cierre operativo de producción: dominio, correo, variables, HTTPS, respaldo y verificación final del despliegue. El piloto ya funciona en Vercel; eso no equivale a cerrar esta etapa.
- **Etapa 20:** propiedades, planes, límites, alta de conjuntos, métricas y operación comercial. La facturación automática espera la definición del modelo de negocio, como indica el prompt maestro.
