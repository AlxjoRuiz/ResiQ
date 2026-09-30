# Etapa 4 — Inicialización

Estado: entregada, verificada y aprobada por el usuario. Fecha: 2026-09-28.

Nota de seguimiento: este documento conserva el alcance que tenía la etapa 4 al entregarse. La conexión remota, OAuth, las tablas iniciales y RLS se añadieron después en la etapa 5 y se documentan en `06-autenticacion.md`.

## Objetivo y alcance
Base Next.js App Router, React, TypeScript estricto, Tailwind, configuración shadcn/ui y clientes Supabase. No incluye login, OAuth, membresías, dashboards, datos ficticios cargados ni políticas RLS ejecutadas.

## Dependencias y propósito
- next, react, react-dom: aplicación y renderizado.
- @supabase/ssr, @supabase/supabase-js: integración oficial de navegador y servidor.
- server-only: impedir importar cliente de servidor desde componentes de navegador.
- @radix-ui/react-slot, class-variance-authority, clsx, tailwind-merge: composición y variantes de componentes shadcn/ui locales.
- lucide-react: iconos consistentes.
- TypeScript y tipos React/Node: comprobación estricta.
- Tailwind y su plugin PostCSS: estilos.
- ESLint y configuración Next: revisión estática.
No se instala una biblioteca de formularios, estado global o testing hasta necesitarla.

## Archivos
- package.json y package-lock.json: comandos y versiones exactas (lock generado al instalar).
- tsconfig.json, next.config.ts, eslint.config.mjs, postcss.config.mjs: configuración.
- components.json: registro de shadcn/ui; Button y Card locales con patrón de composición Radix.
- src/app: página de presentación en español, layout, estilos, error y 404.
- src/components/ui: componentes compartidos.
- src/config: configuración de identidad visual y localización.
- src/lib/supabase: validación de entorno y clientes browser/server.
- src/modules, hooks, types, validations: directorios reservados sin lógica ficticia.
- supabase/migrations y tests: reservados; sin SQL ni tests vacíos inventados.
- .env.example: plantilla pública sin credenciales; .env.local está ignorado.

## Arranque
1. Instalar dependencias con npm ci una vez exista el lock verificado.
2. Ejecutar npm run dev.
3. Abrir http://127.0.0.1:3000.
4. Ejecutar npm run lint, npm run typecheck y npm run build para validar.

La página inicial no llama a Supabase y abre sin variables. Para usar la integración, copiar .env.example a .env.local y completar URL y clave sb_publishable_ de un proyecto de desarrollo. No compartir claves secret/service_role ni pegarlas en el chat.

No se ha creado ni configurado un proyecto remoto de Supabase. No se han creado cuentas, tablas, buckets ni proveedores OAuth. La conectividad y las credenciales reales se verificarán cuando estén disponibles. No hay servicio simulado que finja una conexión exitosa.

El cliente de servidor preparado es para Route Handlers/Server Actions que puedan escribir cookies. Antes de usarlo para autenticación se añadirá el mecanismo de refresco y lectura correspondiente a Server Components y se probará en etapa 5; no se suprimen silenciosamente errores de cookies.

## Seguridad y límites
Variables se validan al usar conexión. Solo admite publishable, no claves secretas. Código de servidor marcado server-only. Página pública sin datos privados, login fingido ni contadores simulados. Cabeceras básicas nosniff, referrer y frame deny; no equivalen al diseño de seguridad implementado. No indexación mientras se prepara el producto.

## Verificación

- `npm run typecheck`: aprobado, sin errores.
- `npm run lint`: aprobado, sin errores ni advertencias después de corregir la exportación de PostCSS.
- `npm run build`: aprobado con Next.js 16.3.6; `/` y `/_not-found` se generan como contenido estático.
- Servidor local: listo en `http://127.0.0.1:3000`; respuesta HTTP 200.
- Cabeceras comprobadas: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `X-Frame-Options: DENY`.
- Revisión visual de escritorio: jerarquía, navegación, tarjetas y estados visibles correctamente.
- Validación de entorno: faltantes, URL HTTP remota y clave secret rechazadas; configuración publishable ficticia aceptada sin realizar petición remota.
- Exclusiones Git verificadas para `.env.local`, `node_modules` y caché npm.

No se ha verificado RLS, OAuth, Storage ni conexión remota porque pertenecen a etapas posteriores y aún no existe configuración de Supabase.

## Siguiente etapa
Etapa 5, solo con aprobación: autenticación real, sesiones, invitaciones y base mínima segura de membresías. Las reglas pendientes del seguimiento no se presuponen resueltas.

## Checklist

- [x] Proyecto Next.js, React y TypeScript inicializado.
- [x] Tailwind y configuración shadcn/ui preparados.
- [x] Clientes Supabase de navegador y servidor preparados sin secretos.
- [x] Estructura de carpetas modular creada.
- [x] Página pública, errores y 404 implementados.
- [x] TypeScript, ESLint, compilación y respuesta HTTP verificados.
- [x] Diseño base revisado en escritorio.
- [ ] Autenticación, RLS, Storage y módulos funcionales: corresponden a etapas posteriores.
- [ ] Responsive integral: corresponde a la etapa 18; la base actual usa puntos de quiebre móviles.
