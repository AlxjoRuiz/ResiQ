# Trabajador de correos de ResiQ

Esta Edge Function toma trabajos persistentes de `email_jobs`, envía el correo con Resend y registra cada intento en `email_logs`. La llave de Resend y el secreto del trabajador permanecen únicamente en Supabase Secrets.

## Autorización de destinatarios
Aplicar `20261007174000_email_recipient_access.sql` y volver a desplegar el worker. Cada envío y reintento verifica el lease del worker, el correo actual, la membresía, la propiedad y el permiso vigente sobre el destino. Los correos sin acceso se cancelan antes de generar contenido o llamar a Resend; errores de autorización se reintentan sin enviar. Los recordatorios de asamblea cancelada o con fecha obsoleta tampoco se envían. No se puede retirar un correo ya aceptado por el proveedor.

Variables requeridas: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_WORKER_SECRET` y `APP_URL`. Supabase proporciona `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` a la función.

`20261005153000_schedule_email_worker.sql` ejecuta la función cada minuto con Supabase Cron y `pg_net`. La URL del proyecto y una copia cifrada del secreto del worker se leen desde Vault con los nombres `project_url` y `email_worker_secret`; sus valores no forman parte de la migración ni del repositorio.

El remitente `onboarding@resend.dev` sirve únicamente para pruebas dirigidas al correo propietario de la cuenta de Resend. Antes de producción se debe verificar un dominio propio y configurar `RESEND_FROM_EMAIL` con una dirección de ese dominio.