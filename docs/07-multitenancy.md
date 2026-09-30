# Etapa 6 — Multi-tenancy funcional

Estado: implementación entregada; validación práctica final pendiente. Autorizada por el usuario el 2026-09-30.

## Decisiones aprobadas

- P01: una persona puede pertenecer a varias propiedades y tener varios vínculos de unidad vigentes.
- P06: al finalizar un vínculo, el antiguo miembro pierde de inmediato el acceso operativo e histórico de esa unidad. La administración conserva el registro para auditoría.

## Entrega

- Administración de nombre, dirección, ciudad y zona horaria de una propiedad.
- Creación, edición y desactivación controlada de torres y apartamentos.
- Gestión de roles `member` y `concierge`, suspensión y revocación de miembros.
- Varios vínculos de apartamento por miembro, con relación de residente o propietario.
- Finalización de vínculos sin borrar registros históricos.
- Auditoría transaccional de todas las mutaciones de la etapa.
- Rutas administrativas protegidas tanto en servidor como en PostgreSQL.

## Seguridad aplicada

- Las escrituras pasan por RPC específicas `SECURITY DEFINER`, con `search_path` vacío y comprobación del administrador activo dentro de la transacción.
- No se concede escritura directa sobre las tablas de negocio.
- Las claves foráneas compuestas impiden mezclar propiedad, torre, apartamento o miembro de tenants distintos.
- Un miembro solo lee vínculos vigentes propios. El administrador puede consultar el historial de su propiedad.
- Revocar una membresía o retirar el rol `member` finaliza automáticamente sus vínculos vigentes.
- No se permite modificar administradores desde la pantalla ordinaria de miembros.

## Criterios de cierre

- [x] TypeScript sin errores.
- [x] ESLint sin errores.
- [x] Migración aplicada y verificada en Supabase.
- [ ] Un administrador puede gestionar propiedad, torre y apartamento desde la interfaz.
- [ ] P01: un miembro puede tener dos apartamentos vigentes y leer ambos.
- [ ] P06: al finalizar uno, el miembro deja de leer esa unidad y su vínculo histórico; administración conserva ambos registros y el evento de auditoría.
- [ ] Un miembro no puede abrir ni ejecutar rutas/RPC administrativas.
- [x] Compilación de producción correcta.

La etapa no se considera cerrada hasta completar estas pruebas y recibir aprobación explícita del usuario.
