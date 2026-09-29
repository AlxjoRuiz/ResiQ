# Etapa 5 — Autenticación e invitaciones

Estado: implementación local y migración remota aplicadas. Se verificaron siete tablas con RLS activo, Google OAuth y el bootstrap del primer administrador el 2026-09-29. Faltan las pruebas remotas de invitaciones antes de presentar la etapa para aprobación final.

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
