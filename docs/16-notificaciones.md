# Etapa 15 — Notificaciones y comunicaciones

Estado: propuesta de alcance preparada el 2026-10-07; pendiente de aprobación de decisiones antes de implementar.

## Objetivo
Centralizar los avisos existentes sin cambiar el diseño actual ni duplicar las colas. El correo electrónico sigue siendo el único canal externo; la bandeja interna permite consultar el historial dentro de ResiQ.

## Base existente
notifications conserva destinatario, propiedad, asunto, cuerpo, contexto y read_at. email_jobs y email_logs conservan cola, reintentos, idempotencia y registros de envío. El worker y Cron ya están desplegados. Se reutilizarán estas estructuras.

## Entrega propuesta
1. Bandeja personal paginada con filtros por propiedad autorizada, tipo y lectura; detalle y enlace al módulo original.
2. Marcar un aviso propio como leído mediante operación segura e idempotente, sin modificar destinatario, contenido ni propiedad.
3. Comunicados creados únicamente por administración activa de su propiedad, inicialmente en borrador, con asunto, texto y destinatarios explícitos. Revisión antes de publicar; sin destinatarios agregados automáticamente.
4. Publicación transaccional: una notificación y un trabajo de correo por destinatario, con deduplicación y auditoría. Sin eliminación física ni edición silenciosa de mensajes publicados; una corrección será un comunicado nuevo.
5. Plantillas reutilizables y enlaces al dominio desplegado. Estado aceptado por el proveedor separado de entregado; no afirmar recepción sin evidencia.
6. Estado operativo de envíos para administración de su propiedad, con errores resumidos y sin exponer secretos. No permitir consultar contenido privado de otros módulos mediante esta vista ni reenvíos masivos sin una operación explícita.

## Seguridad
- El usuario consulta solo sus avisos asociados a membresías activas. Perder el vínculo retira el acceso operativo; administración conserva el historial autorizado.
- Conocer un UUID no otorga acceso. Los enlaces se construyen con rutas permitidas y el destino vuelve a verificar permisos.
- Portería consulta sus avisos; no publica comunicados ni obtiene acceso financiero.
- No se conceden escrituras directas amplias sobre notifications. Validación en servidor, RPC y RLS para las operaciones sensibles.
- Texto de comunicados escapado al generar HTML; sin HTML libre, adjuntos nuevos ni listas de correos visibles para residentes en esta primera entrega.

## Datos previstos
Antes de crear la migración se describirán tablas de comunicados y su audiencia explícita, con property_id y relaciones consistentes. Se extenderán los tipos de notifications y las plantillas existentes cuando corresponda; no se creará una segunda cola.

## Verificación prevista
TypeScript, ESLint y compilación; pruebas transaccionales con rollback de aislamiento entre propiedades y destinatarios, denegación a roles no autorizados, lectura propia idempotente, publicación única y preservación de historial. Revisión visual con las sesiones administrativas y residentes disponibles. No enviar correos reales de prueba sin destinatarios autorizados.

## Pendientes externos
Para enviar a alejoruizm11@gmail.com u otros destinatarios falta un dominio verificado en Resend y un remitente autorizado. El remitente de pruebas solo permite el correo propietario de la cuenta. APP_URL del worker debe verificarse y actualizarse a https://resi-q.vercel.app. La falta de dominio no impide desarrollar y probar la bandeja con rollback, pero impide cerrar la recepción real de correo a otros usuarios.

## Decisiones para aprobación
Aprobar bandeja personal y lectura propia, comunicados administrativos con audiencia explícita y publicación inmutable, sin adjuntos en esta primera entrega. No incluye WhatsApp, SMS, push, facturación ni cambios visuales del dashboard.

El cierre funcional de asambleas conserva la salvedad de correo a residentes pendiente de dominio; no se considera entregado ese correo.
