# Porteria: usuario permanente y cuenta individual

Alejandro aprobo que el portero ingrese a ResiQ con un usuario permanente y una contrasena asignada por el administrador. El correo real del portero sera la identidad interna de Supabase Auth; su telefono sera solo un dato de contacto. No se compra ni configura SMS para este flujo. El administrador debera comprobar que el correo pertenece al portero antes de registrarlo. La recuperacion automatica por correo seguira pendiente de SMTP y dominio; hasta entonces, una contrasena perdida se sustituira mediante una accion administrativa segura, no se revelara la anterior.

El usuario se forma con primer nombre + primer apellido + los dos ultimos digitos de la cedula, en minusculas ASCII. No hay sufijos: una coincidencia en cualquier propiedad bloquea el alta. El usuario no cambia al editar nombre, cedula o telefono y no se reasigna automaticamente al retirar permisos. El servidor recalcula el usuario y la base garantiza su unicidad; una vista previa en el formulario no es suficiente.

## Estado de las migraciones

- `20261021000000_concierge_identity_foundation.sql` fue ejecutada por Alejandro en SQL Editor con resultado `Success`; confirmo las nueve columnas de `concierge_identity_catalog_readonly.sql` en `true`. Esa primera version suponia identidad telefonica y activacion temporal. La aplicacion aun no crea cuentas con ella; no hemos comprobado si existe alguna fila agregada por otro medio.
- La consulta de solo lectura a `/auth/v1/settings` del piloto devolvio `external.phone=false`. Alejandro decidio no comprar SMS y usar correo real.
- `20261021010000_concierge_email_identity.sql` corrige la tabla existente: correo real obligatorio y unico, telefono solo de contacto, y elimina las columnas de activacion temporal. La migracion aborta si la tabla tiene algun registro, para no alterar cuentas reales. Debe ejecutarla y confirmar `concierge_email_catalog_readonly.sql` antes de publicar la interfaz dependiente.

## Flujo pendiente de codigo y prueba

1. Registro manual: datos personales, edad calculada, vehiculos y foto opcional. El administrador ve el usuario calculado y asigna una contrasena fuerte, que no se almacena en la aplicacion ni se muestra despues. Supabase Auth guarda su hash. No hay turnos ni Excel.
2. El servidor crea la cuenta con correo real y la vincula a la propiedad y rol Porteria. No se envia correo de alta; el administrador confirma previamente que el correo pertenece al portero. El login resuelve usuario a correo solo en el servidor y devuelve errores genericos para no revelar cuentas. Administradores y residentes conservan su acceso actual.
3. Tarjetas: nombre, cedula parcialmente oculta, edad, telefono, usuario y estado; detalles completos solo a administradores. Edicion sin cambio de usuario; sustitucion de contrasena sin revelar la anterior.
4. Baja: bloquear membresia y ficha antes de bloquear la identidad Auth. Las JWT ya emitidas no pueden revocarse instantaneamente en Supabase, por lo que RLS y las comprobaciones del servidor deben impedir operaciones inmediatamente. Definir conservacion/supresion de datos personales antes de automatizar eliminacion irreversible; preservar referencias historicas de paquetes, visitas y auditoria.

La utilidad `src/lib/concierge/identity.ts` y sus tres pruebas estan en `655f759`: pasaron TypeScript, ESLint sin errores (seis advertencias preexistentes), compilacion y 19 pruebas de seguridad. Vercel confirmo el despliegue de ese codigo preparatorio, que no modifica el login ni presenta el nuevo formulario. No se ha creado una cuenta de portero por este flujo ni se ha realizado una prueba de acceso en produccion.
