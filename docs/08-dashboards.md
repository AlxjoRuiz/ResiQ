# Etapa 7 — Dashboards por rol

Estado: implementación en validación. Autorizada por el usuario el 2026-09-30 al solicitar continuar con los pasos restantes.

## Objetivo

Ofrecer una entrada clara y responsive para residente, portería, administración y plataforma, mostrando únicamente las vistas y accesos correspondientes a los roles vigentes.

## Decisiones

- Los dashboards consultan datos autorizados existentes; no duplican información operativa en tablas de resumen.
- Una misma membresía puede cambiar entre sus vistas permitidas. Una vista solicitada sin el rol correspondiente se sustituye por la vista autorizada de mayor responsabilidad.
- Los módulos de etapas posteriores aparecen como `Próxima etapa` y no enlazan a funciones inexistentes.
- La administración enlaza únicamente a las funciones ya entregadas: propiedad, apartamentos y miembros.
- El panel de plataforma usa una identidad global separada en `platform_admins`; ser administrador de una propiedad no concede acceso SaaS.
- Las métricas globales se entregan mediante una RPC agregada que no expone datos privados de residentes.

## Archivos principales

- `src/app/panel/page.tsx`: selector de comunidades y dashboards.
- `src/app/panel/propiedades/[propertyId]/dashboard/page.tsx`: vistas de residente, portería y administración.
- `src/app/plataforma/page.tsx`: dashboard de superadministración.
- `src/components/dashboard/role-dashboard.tsx`: tarjetas y métricas reutilizables.
- `src/lib/auth/require-property-member.ts`: protección de dashboard por membresía activa.
- `src/lib/auth/require-platform-admin.ts`: protección independiente del panel SaaS.
- `supabase/migrations/20260930193000_role_dashboards.sql`: identidad de plataforma, RLS y métricas agregadas.

## Checklist

- [x] Dashboard de residente implementado.
- [x] Dashboard de portería implementado.
- [x] Dashboard de administración implementado y validado con sesión real.
- [x] Dashboard de superadmin implementado.
- [x] Navegación y permisos validados en servidor.
- [x] Migración de plataforma aplicada en Supabase.
- [x] Un administrador de propiedad sin rol de plataforma recibe 404 en `/plataforma`.
- [ ] Cuenta propietaria designada explícitamente como superadmin y dashboard de plataforma validado con sesión real.
- [ ] Dashboard de residente validado visualmente con la segunda cuenta real.
- [x] TypeScript, ESLint y compilación de producción finales.

La etapa se cerrará después de completar las validaciones pendientes y recibir aprobación explícita del usuario.
