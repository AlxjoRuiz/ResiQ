# Etapa 5 — Autenticación e invitaciones

Estado: implementación local y migraciones remotas aplicadas. Se verificaron siete tablas con RLS activo, Google OAuth, el bootstrap del primer administrador y siete casos transaccionales de invitaciones el 2026-09-29. Faltan cuatro pruebas reales de navegador, segunda cuenta y aislamiento antes de presentar la etapa para aprobación final.

## Alcance implementado

- Inicio y cierre de sesión con correo y contraseña.
- OAuth con Google mediante PKCE y callback de servidor.
- Renovación de sesión en `proxy.ts`, convención vigente de Next.js 16.
- Protección de `/panel`, `/perfil` e `/invitacion`.
- Perfil propio editable con RLS por `auth.uid()`.
- Membresía mínima de propiedad y unidad para aceptar invitaciones sin adelantar la gestión completa de la etapa 6.
- Invitaciones de un solo uso: token aleatorio, almacenamiento exclusivo del hash, correo verificado coincidente, expiración y consumo atómico.
- El rol, la propiedad, la unidad y el tipo de vínculo se toman del registro bloqueado en PostgreSQL, nunca del navegador.

## Configuración externa

1. Configurado: Site URL `http://localhost:3000` y redirect `http://localhost:3000/auth/callback`.
2. Configurado: Google habilitado con Client ID y secreto almacenado directamente en Supabase.
3. Configurado: bootstrap idempotente de dos propiedades de demostración, una torre y veinte apartamentos por propiedad, con el primer administrador asignado de forma controlada.

## Pruebas exigidas antes de aprobar

- Inicio correcto, credenciales inválidas, cierre y renovación de sesión.
- OAuth correcto, cancelado y callback inválido.
- Redirección de usuario anónimo desde cada ruta protegida.
- Perfil propio permitido y perfil ajeno denegado.
- Invitación válida, vencida, revocada, reutilizada y con correo distinto.
- Usuario autenticado sin membresía solo ve acceso pendiente.
- Aislamiento entre dos propiedades y rechazo de roles/unidades alterados desde el cliente.

## Verificaciones del 2026-09-29

- `npm run typecheck`: correcto.
- `npm run lint`: correcto.
- `npm run build`: correcto; nueve rutas generadas y Proxy detectado.
- `/panel` anónimo: redirección 307 a `/login?next=%2Fpanel`.
- `/login`: respuesta 200 con acceso mediante Google.
- Supabase OAuth: URL de autorización generada con proveedor `google` y callback `http://localhost:3000/auth/callback`.
- Bootstrap remoto: dos propiedades, veinte unidades activas por propiedad y rol `administrator` verificados mediante la consulta final.
- Google OAuth real: el primer administrador inició sesión y Supabase creó su perfil correctamente.
- Credenciales inválidas: Supabase respondió `400 invalid_credentials`.
- Rutas anónimas: `/panel`, `/perfil` e `/invitacion` respondieron `307` hacia `/login` conservando `next`.
- Callback cancelado o inválido: respondió `307` hacia `/login?error=callback`.
- Invitaciones remotas: pasaron los casos válida, reutilizada, revocada, vencida, correo diferente y rol alterado; el bloque de prueba confirmó rollback limpio.

## Corrección encontrada durante las pruebas

La primera aceptación válida reveló que `accept_invitation` usaba `member_id` como variable y como columna dentro de la misma función. PostgreSQL devolvía `42702 column reference member_id is ambiguous`. La migración `20260929220000_fix_accept_invitation_member_id.sql` renombra la variable a `created_member_id`; la matriz completa pasó después de aplicar la corrección.

## Pruebas aún pendientes

- Cierre de sesión y renovación de sesión desde el navegador.
- Edición del perfil propio y rechazo comprobado de un perfil ajeno.
- Flujo completo de invitación desde la interfaz con una segunda cuenta real.
- Aislamiento RLS comprobado con usuarios pertenecientes a propiedades distintas.
