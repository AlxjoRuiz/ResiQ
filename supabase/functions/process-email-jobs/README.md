# Trabajador de correos de PQRS

Esta Edge Function toma trabajos persistentes de `email_jobs`, envía el correo con Resend y registra cada intento en `email_logs`. La llave de Resend y el secreto del trabajador permanecen únicamente en Supabase Secrets.

Variables requeridas: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_WORKER_SECRET` y `APP_URL`. Supabase proporciona `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` a la función.

Para producción se debe verificar un dominio propio en Resend, configurar `RESEND_FROM_EMAIL` con ese dominio y programar una invocación periódica autenticada con el encabezado `x-worker-secret`. Mientras no exista dominio propio, el envío queda en modo de prueba de Resend.
