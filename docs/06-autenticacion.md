# Etapa 5 — Autenticación e invitaciones

Estado: implementación local y migración remota preparadas. La migración se aplicó al proyecto Supabase ResiQ el 2026-09-29 y se verificaron siete tablas con RLS activo. Falta habilitar Google y ejecutar las pruebas remotas antes de presentar la etapa para aprobación final.

## Alcance implementado

- Inicio y cierre de sesión con correo y contraseña.
- OAuth con Google mediante PKCE y callback de servidor.
- Renovación de sesión en `proxy.ts`, convención vigente de Next.js 16.
- Protección de `/panel`, `/perfil` e `/invitacion`.
- Perfil propio editable con RLS por `auth.uid()`.
- Membresía mínima de propiedad y unidad para aceptar invitaciones sin adelantar la gestión completa de la etapa 6.
- Invitaciones de un solo uso: token aleatorio, almacenamiento exclusivo del hash, correo verificado coincidente, expiración y consumo atómico.
- El rol, la propiedad, la unidad y el tipo de vínculo se toman del registro bloqueado en PostgreSQL, nunca del navegador.

## Configuración externa pendiente

1. En Auth > URL Configuration, usar `http://localhost:3000` como Site URL y agregar `http://localhost:3000/auth/callback` como redirect permitido.
2. Habilitar Google y configurar su Client ID/secret directamente en Supabase.
3. Crear una propiedad, torre, unidad y administrador iniciales mediante un procedimiento controlado de bootstrap; no se incluye autoasignación privilegiada desde la aplicación.

## Pruebas exigidas antes de aprobar

- Inicio correcto, credenciales inválidas, cierre y renovación de sesión.
- OAuth correcto, cancelado y callback inválido.
- Redirección de usuario anónimo desde cada ruta protegida.
- Perfil propio permitido y perfil ajeno denegado.
- Invitación válida, vencida, revocada, reutilizada y con correo distinto.
- Usuario autenticado sin membresía solo ve acceso pendiente.
- Aislamiento entre dos propiedades y rechazo de roles/unidades alterados desde el cliente.
