# Etapa 8 — PQRS

## Alcance implementado

El módulo permite que un residente con vínculo vigente cree una PQRS para uno de sus apartamentos, consulte únicamente sus propias solicitudes, responda mientras estén abiertas y revise su historial. La administración de la propiedad puede consultar todas las PQRS, responder y cambiar su estado. Portería no tiene acceso al módulo.

Cada operación de negocio se ejecuta mediante funciones SQL con `security definer`, validaciones de pertenencia y RLS. Se registran la creación, respuestas, cambios de estado y adjuntos en `activity_events` y en la auditoría de propiedad.

## Adjuntos privados

- Bucket privado de Supabase Storage: `private-documents`.
- Formatos permitidos: PDF, JPG y PNG.
- Máximo 10 MB por archivo y 5 adjuntos por PQRS o respuesta.
- La ruta se genera en el servidor y no depende del nombre original.
- La aplicación valida MIME, tamaño declarado, tamaño real y firma binaria antes de publicar el documento.
- Los archivos se descargan con una URL firmada que vence en 5 minutos.
- Los registros rechazados permanecen inaccesibles y pueden limpiarse mediante un proceso operativo posterior.
- Retención acordada: 5 años después del cierre, con borrado lógico antes de eliminar bytes.

## Notificaciones y correo

Las acciones generan una notificación dentro de la base de datos y un trabajo idempotente en `email_jobs`. La Edge Function `process-email-jobs` reclama trabajos con bloqueo, envía mediante Resend, registra cada intento y reintenta los fallos hasta cinco veces. La llave de Resend no se expone al navegador.

La entrega real de correo requiere configurar los Secrets de Supabase, desplegar la función y programar su ejecución. Resend se mantiene en modo de prueba hasta verificar un dominio propio.

## Validación del 1 de octubre de 2026

- La migración se ejecutó correctamente en Supabase.
- Las cinco tablas operativas consultables por la aplicación respondieron `200` en PostgREST.
- TypeScript, ESLint y la compilación de producción de Next.js finalizaron correctamente.
- Las rutas del panel y PQRS respondieron con protección de sesión activa.
- La prueba visual completa con dos identidades y el envío real de correo se realizará cuando se configuren los Secrets de Resend; no se considera comprobado el envío externo antes de ese paso.

## Respaldo

Se usarán los respaldos administrados de Supabase y, antes de producción, se validará una copia externa restaurable de la base y los objetos privados.
