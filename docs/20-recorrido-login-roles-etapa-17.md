# Etapa 17 — recorrido manual de login y roles

Esta lista permite cerrar lo que las pruebas SQL y HTTP sin sesión no demuestran. Ejecutar en la aplicación publicada con cuentas de prueba existentes; no compartir contraseñas, cookies ni enlaces de invitación. Sustituir `{propiedad}` por el ID del conjunto al que pertenece la cuenta. Abrir cada ruta directamente en la barra de direcciones, además de navegar por el menú.

| Sesión | Ruta o acción | Resultado esperado | Estado |
| --- | --- | --- | --- |
| Sin sesión | `/panel` | Redirige a `/login?next=%2Fpanel`. | PASS local sin sesión |
| Sin sesión | `/plataforma` | Redirige a login. | PASS local sin sesión |
| Portería | `/panel/propiedades/{propiedad}/paquetes/nuevo` | Abre el formulario de recepción de paquetes. | Pendiente |
| Portería | `/panel/propiedades/{propiedad}/visitas` | Muestra solicitudes y movimientos, sin crear ni aprobar solicitudes. | Parcial: captura muestra listado sin botón de creación; falta comprobar controles de decisión en un detalle pendiente. |
| Portería | `/panel/propiedades/{propiedad}/visitas/nueva` | 404. | PASS 2026-10-09: captura de la ruta directa con 404. |
| Portería | `/panel/propiedades/{propiedad}/cartera` y `/miembros` | 404 en ambas rutas. | PASS informado por Alejandro 2026-10-09; sin captura inspeccionada de estos dos enlaces. |
| Residente | `/panel/propiedades/{propiedad}/visitas/nueva` y `/pqrs/nuevo` | Abre los formularios si tiene apartamento activo. | PASS informado por Alejandro 2026-10-09: ambos formularios abren con sesión de Residente. |
| Residente | `/panel/propiedades/{propiedad}/paquetes/nuevo` y `/miembros` | 404 en ambas rutas. | Miembros: PASS informado por Alejandro 2026-10-09 (404). Registrar paquete: pendiente; Alejandro aclaró que aún no hizo esta prueba. |
| Administración | `/panel/propiedades/{propiedad}/miembros` y `/cartera` | Abre las vistas administrativas. | Pendiente |
| Administración | `/panel/propiedades/{propiedad}/visitas/nueva` | 404; las solicitudes las crea el residente. | Pendiente |
| Cada rol | `/panel/propiedades/{otraPropiedad}/dashboard` con un ID donde esa cuenta no tiene membresía | 404, sin contenido del otro conjunto. | Pendiente |
| Cada rol | Salir y volver a abrir `/panel` | Muestra login; tras ingresar de nuevo, vuelve al panel autorizado. | Pendiente |

Para login, comprobar por separado una cuenta invitada con correo/contraseña y otra con Google. Una contraseña incorrecta debe mostrar un error genérico sin crear sesión. Si la cuenta no tiene contraseña, marcar ese caso como no aplicable; la recuperación por correo sigue aplazada hasta contar con dominio verificado.

Registrar para cada caso la fecha, rol, ruta, resultado observado y una captura que no muestre datos sensibles. No marcar como PASS una ruta solo porque no aparece en el menú: debe abrirse directamente. La prueba SQL `stage17_multi_role_tenant_transaction.sql` cubre los límites de una cuenta multirrol en la base de datos, pero no sustituye este recorrido de interfaz.
