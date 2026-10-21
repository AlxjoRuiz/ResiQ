# Porteria: usuario permanente y cuenta individual

Alejandro aprobo que el portero ingrese a ResiQ con un usuario permanente y una contrasena asignada por el administrador. El correo real del portero sera la identidad interna de Supabase Auth; su telefono sera solo un dato de contacto. No se compra ni configura SMS para este flujo. El administrador debera comprobar que el correo pertenece al portero antes de registrarlo. La recuperacion automatica por correo seguira pendiente de SMTP y dominio; hasta entonces, una contrasena perdida se sustituira mediante una accion administrativa segura, no se revelara la anterior.

El usuario se forma con primer nombre + primer apellido + los dos ultimos digitos de la cedula, en minusculas ASCII. No hay sufijos: una coincidencia en cualquier propiedad bloquea el alta. El usuario no cambia al editar nombre, cedula o telefono y no se reasigna automaticamente al retirar permisos. El servidor recalcula el usuario y la base garantiza su unicidad; una vista previa en el formulario no es suficiente.

## Estado de las migraciones

- `20261021000000_concierge_identity_foundation.sql` fue ejecutada por Alejandro en SQL Editor con resultado `Success`; confirmo las nueve columnas de `concierge_identity_catalog_readonly.sql` en `true`. Esa primera version suponia identidad telefonica y activacion temporal. La aplicacion aun no crea cuentas con ella; no hemos comprobado si existe alguna fila agregada por otro medio.
- La consulta de solo lectura a `/auth/v1/settings` del piloto devolvio `external.phone=false`. Alejandro decidio no comprar SMS y usar correo real.
- `20261021010000_concierge_email_identity.sql` corrige la tabla existente: correo real obligatorio y unico, telefono solo de contacto, y elimina las columnas de activacion temporal. La migracion aborta si la tabla tiene algun registro, para no alterar cuentas reales. Alejandro confirmo `Success` y las ocho comprobaciones de `concierge_email_catalog_readonly.sql` en `true`. Eso valida el esquema, no el flujo de una cuenta real.

## Flujo de implementacion y prueba

1. Registro manual: datos personales, edad calculada, vehiculos y foto opcional. El administrador ve el usuario calculado y asigna una contrasena fuerte, que no se almacena en la aplicacion ni se muestra despues. Supabase Auth guarda su hash. No hay turnos ni Excel.
2. El servidor crea la cuenta con correo real y la vincula a la propiedad y rol Porteria. No se envia correo de alta; el administrador confirma previamente que el correo pertenece al portero. El login resuelve usuario a correo solo en el servidor y devuelve errores genericos para no revelar cuentas. Administradores y residentes conservan su acceso actual.
   La interfaz y la accion de nuevas invitaciones quedan limitadas a residentes; las invitaciones antiguas de porteria no se eliminan ni alteran automaticamente.
3. Tarjetas: nombre, cedula parcialmente oculta, edad, telefono, usuario y estado; detalles completos solo a administradores. Edicion sin cambio de usuario; sustitucion de contrasena sin revelar la anterior.
4. Baja: revocar primero la membresia, suspender la ficha, bloquear la identidad Auth cuando no tenga otros roles activos, y solo entonces marcar la ficha como retirada, limpiar direccion, vehiculos y foto y quitar la tarjeta. Ante un fallo intermedio se conserva la ficha para reintentar sin reactivar permisos. Las JWT ya emitidas no pueden revocarse instantaneamente en Supabase; las operaciones de negocio se protegen por membresia activa en RLS y comprobaciones del servidor. El esquema aun exige conservar nombre, cedula, nacimiento, telefono y correo en la ficha retirada; la supresion definitiva y su plazo requieren una decision de retencion, sin borrar referencias historicas de paquetes, visitas y auditoria por accidente.

El codigo de alta, login por usuario, detalle, edicion, sustitucion administrativa de contrasena y baja quedo en el commit `00ec7fb`. En local pasaron `npm run verify` (TypeScript, ESLint con cero errores y seis advertencias preexistentes, y build) y `npm run test:security` (19/19). El diff no presento errores de formato. Estas pruebas no equivalen a una cuenta real ni al despliegue. Tras comprobar Vercel se necesita un caso controlado acordado con Alejandro para verificar alta, ingreso, edicion y revocacion en produccion. No usar cuentas reales existentes ni crear porteros ficticios sin su acuerdo.

El 21 de octubre de 2026, `main` en GitHub quedo en `a349788` y se comprobo que `https://resi-q.vercel.app/login` devuelve HTTP 200 con el nuevo texto "Correo o usuario de porteria". Estado: codigo subido y despliegue visible en la pagina publica. La pantalla privada de Propiedad, el alta, el ingreso efectivo y la baja siguen pendientes de prueba por Alejandro. La comprobacion del login publico no certifica esos flujos.

La utilidad `src/lib/concierge/identity.ts` y sus tres pruebas estan en `655f759`: pasaron TypeScript, ESLint sin errores (seis advertencias preexistentes), compilacion y 19 pruebas de seguridad. Vercel confirmo el despliegue de ese codigo preparatorio, que no modifica el login ni presenta el nuevo formulario. No se ha creado una cuenta de portero por este flujo ni se ha realizado una prueba de acceso en produccion.

## Porteros anteriores creados por invitacion

Alejandro revoco el acceso de Luis Ruiz desde «Administrar acceso» en Propiedad. La accion conserva la membresia y el historial, pero la lista seguia mostrando su tarjeta porque incluia miembros revocados. Se ajusto la lista para ocultar solo las membresias de Porteria con estado `revoked`; las `suspended` permanecen visibles para poder reactivarlas. No se elimina la cuenta Auth ni se alteran otras propiedades. Pendiente comprobar en produccion, con Alejandro, que la tarjeta de Luis ya no aparece y que la revocacion quedo registrada.

El ajuste se subio en `7cd5018`. Pasaron TypeScript, ESLint (cero errores, seis advertencias anteriores), compilacion y `git diff --check`. GitHub confirmo `main` en ese commit y el estado de Vercel para el commit fue `success` con «Deployment has completed». Falta la comprobacion de Alejandro en la pagina privada; la verificacion de Vercel no demuestra el resultado de su sesion.

## Ajuste del formulario de alta

Alejandro decidio que el administrador escriba el usuario permanente, con una indicacion visible del formato: primer nombre, primer apellido y los dos ultimos digitos de la cedula, en minusculas y sin tildes ni espacios. El sistema muestra una sugerencia calculada, pero no rellena el campo. El servidor exige que el valor escrito coincida con ese formato y conserva la comprobacion de unicidad global, sin sufijos. Usuario y contrasena se agrupan en «Acceso al sistema». El alta muestra un solo bloque de vehiculo opcional; se aceptan cero o uno y el servidor rechaza mas de uno. La edicion de fichas existentes conserva por ahora su limite anterior para no invalidar datos historicos.

Pendiente comprobar en la web, sin registrar una cuenta real: visualizacion y validacion del usuario escrito, los cuatro campos del unico vehiculo y su presentacion en movil. El alta efectiva sigue requiriendo un caso controlado acordado con Alejandro.

El ajuste se subio en `c5ac51e`. Pasaron TypeScript, ESLint sin errores en los archivos modificados (la verificacion general mantiene seis advertencias anteriores), compilacion y 19 pruebas de seguridad. Como no aparecia el despliegue automatico, se creo desde el panel de Vercel un despliegue de produccion con el hash exacto `c5ac51e`: `E91wLPUQXpAAVxT3G7khLusHvLkf`. Vercel mostro `Ready` y `resi-q.vercel.app` en Current Domains. Esta confirmacion de despliegue no equivale a la comprobacion visual ni funcional por Alejandro.
