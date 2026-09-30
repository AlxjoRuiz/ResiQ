# Etapa 5 — Autenticación e invitaciones

Estado: implementación local y migraciones remotas aplicadas. Se verificaron siete tablas con RLS activo, Google OAuth, el bootstrap del primer administrador, siete casos transaccionales de invitaciones y el flujo real con una segunda cuenta el 2026-09-29. Etapa lista para aprobación final del usuario.

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

No quedan pruebas de cierre pendientes para el alcance de la etapa 5.

## Pruebas de cierre completadas

- Cierre de sesión: redirección correcta al login; una ruta protegida volvió a exigir autenticación.
- Renovación/persistencia: la segunda cuenta conservó la sesión al recargar el panel.
- Invitación real: `alejoruizm11@gmail.com` aceptó desde la interfaz una invitación de miembro residente para el apartamento 101 de `Conjunto Bosques de ResiQ`.
- Selección de cuenta: el acceso de Google solicita elegir cuenta cuando el destino es una invitación, evitando reutilizar accidentalmente la cuenta administradora.
- Aislamiento visual: el panel de la cuenta invitada mostró una sola comunidad y no mostró `Edificio Mirador ResiQ`.
- Acceso directo ajeno: la ruta administrativa de la propiedad no vinculada respondió 404.
- RLS directo: como la segunda identidad se obtuvieron `visible_profiles=1`, `visible_property_members=1`, `visible_unit_memberships=1` y `foreign_property_members=0`.
- Perfil: una prueba transaccional permitió `own_profile_updates=1` y devolvió `foreign_profile_updates=0`; el rollback evitó cambios persistentes.
