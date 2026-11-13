# Activar los correos reales (lista del 13/11/2026)

Hoy ResiQ trabaja en **modo de prueba**: los correos se arman y quedan en la cola (`email_jobs`), pero las invitaciones y
los avisos al correo de facturas quedan **retenidos** (`held`) y no salen. Todo está construido; lo que falta es el dominio.
Esta lista junta, en orden, lo que hay que hacer cuando se compre el dominio. Detalle histórico en
`28-censo-invitaciones-diferidas.md` (sección «Pruebas pendientes para cuando haya dominio verificado»).

## 1. Dominio y Resend (una sola vez)

1. Comprar el dominio (por ejemplo `resiq.co`).
2. En Resend › Domains, agregarlo y copiar los registros DNS (SPF, DKIM y, recomendado, DMARC) en el proveedor del dominio.
   Esperar a que Resend lo marque **Verified**.
3. Correo remitente: por ejemplo `ResiQ <notificaciones@resiq.co>`.

## 2. Configuración

- **Supabase › Edge Functions › Secrets** (los usa `process-email-jobs`):
  - `RESEND_FROM_EMAIL` = el remitente del dominio verificado.
  - `RESEND_API_KEY` = la clave de Resend (si se crea una nueva para el dominio).
  - `APP_URL` = la dirección pública de la app (hoy `https://resi-q.vercel.app`, o el dominio si se conecta a Vercel).
  - `LEGAL_REPLY_DOMAIN` = subdominio de respuestas de la abogada (ver punto 5).
- **Vercel** (si se conecta el dominio a la app): agregar el dominio en Vercel › Domains y actualizar `APP_URL`.
- Volver a desplegar la función:
  `npx supabase functions deploy process-email-jobs --project-ref iruyohkoedecznqldqkl --no-verify-jwt`

## 3. Registro con contraseña y recuperación (Supabase Auth)

- Supabase › Authentication › SMTP Settings: usar Resend (host `smtp.resend.com`, puerto 465, usuario `resend`, la clave de
  Resend como contraseña) con el remitente del dominio. Sin esto, crear cuenta con contraseña desde una invitación falla;
  con Google sí funciona.
- Activar `PASSWORD_RECOVERY_ENABLED` en Vercel y probar «¿Olvidaste tu contraseña?».

## 4. Encender el envío, primero en prueba

1. `select private.set_invitation_delivery(true, false);` — envío real activo, sin liberar lo retenido de los conjuntos
   reales.
2. Probar con 1 a 3 correos propios en un conjunto de prueba:
   - Invitación de residente: llega, se abre el enlace, se crea la cuenta (con contraseña y con Google) y entra.
   - Cartera: cartera nueva, pago registrado, aviso de mora y recordatorio semanal (ver que el texto y la firma del
     conjunto salgan bien).
   - Correo de facturas del censo (autorización Sí / No, cambio de correo).
   - Invitación de administrador desde Plataforma y de auxiliar desde Propiedad.
   - Requerimiento de pago de la abogada.
   - Que `email_logs` no guarde enlaces de invitación.
3. Solo después decidir si se liberan las invitaciones retenidas de los conjuntos reales:
   `select private.set_invitation_delivery(true, true);` (respeta el límite diario de 90).

## 5. Respuestas de los residentes a la abogada (opcional)

- Resend › Receiving: activar recepción en un subdominio (por ejemplo `respuestas.resiq.co`, registro MX).
- Webhook `email.received` → `https://<app>/api/legal/inbound`; en Vercel, `RESEND_INBOUND_WEBHOOK_SECRET`.
- `LEGAL_REPLY_DOMAIN` = ese subdominio, y volver a desplegar `process-email-jobs`.

## 6. Lo que todavía se entrega como enlace (se puede pasar a correo después)

- Invitación del admin de mantenimiento, de la abogada y de auxiliares: hoy muestran el enlace para copiarlo.
  Con el dominio listo, se pueden encolar como las demás invitaciones.

## Antes de encender

- Plan de Resend: el gratuito permite 100 correos al día y 3.000 al mes. Con conjuntos grandes (Bonavento: 1.860
  apartamentos) los avisos de cartera superan ese límite: revisar el plan de pago antes de encender.
- Autorización de datos (Ley 1581) de cada conjunto antes de escribir a sus residentes.
