# ResiQ

Plataforma SaaS para propiedades horizontales (conjuntos residenciales) de Colombia. Módulos: residentes y censo, cartera y acuerdos de pago, PQRS, paquetes, visitas y portería, zonas y reservas, asambleas con votación, comunicados y notificaciones, llamados de atención, cobro jurídico y mantenimiento.

Estado y decisiones vigentes: [seguimiento](docs/01-seguimiento.md).

## Tecnologías

- **Next.js 16** (App Router) con **React 19** y **TypeScript** estricto. Esta versión de Next tiene cambios importantes: lee [AGENTS.md](AGENTS.md) antes de programar.
- **Tailwind CSS 4** y componentes estilo shadcn/ui en `src/components/ui`.
- **Supabase**: Postgres con RLS, Auth (correo y Google), Storage y una Edge Function en Deno para los correos.
- **Resend** para enviar y recibir correos. **Vercel** para publicar.

## Estructura

```
src/
  proxy.ts            Entrada de cada solicitud: CSP y sesión (en Next 16 reemplaza a middleware.ts)
  app/                Páginas y rutas: panel (admin y residente), plataforma (superadmin),
                      juridica, mantenimiento, api/ (subida y descarga de archivos, webhooks)
  components/         Componentes por módulo y componentes base (ui/)
  lib/                Lógica compartida: supabase/ (clientes), auth/ (permisos), finance/, census/…
supabase/
  migrations/         Esquema de la base de datos, en orden de fecha
  functions/          Edge Function process-email-jobs (envío de correos)
  tests/              Pruebas SQL de permisos y transacciones
  bootstrap/          Scripts manuales: primer superadmin y entorno de demostración
tests/                Pruebas de Node (seguridad, censo, cartera y e2e)
docs/                 Diseño, decisiones y seguimiento por etapas
```

## Cómo correrlo en local

### 1. Requisitos

- Node.js **22.14 o superior** (menor que 25) y npm.
- Un proyecto de Supabase **de desarrollo** (no uses el de producción).

### 2. Instalar dependencias

```bash
npm ci
```

`npm ci` instala exactamente las versiones de `package-lock.json`.

### 3. Preparar la base de datos en Supabase

1. Aplica **todas** las migraciones de `supabase/migrations` en orden de nombre (el nombre empieza por la fecha). En este proyecto se han aplicado desde el SQL Editor de Supabase, una por una.
2. En Authentication › Providers activa el proveedor de correo y, si lo vas a usar, Google.
3. Crea tu usuario (iniciando sesión una vez) y conviértelo en superadmin con `supabase/bootstrap/platform_admin.sql` (las instrucciones están al inicio del archivo).
4. Opcional: `supabase/bootstrap/demo_environment.sql` crea propiedades de demostración. **Nunca** en producción.

### 4. Variables de entorno

Copia `.env.example` como `.env.local` y llena los valores. Cada variable está explicada en el archivo. Las mínimas para abrir la app son `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`. `.env.local` está en `.gitignore`: nunca lo subas.

### 5. Arrancar

```bash
npm run dev
```

Abre http://127.0.0.1:3000.

### 6. Correos (opcional)

Los correos los envía la Edge Function `process-email-jobs`, que corre cada minuto con Supabase Cron. Sus variables (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_WORKER_SECRET`, `APP_URL`, `LEGAL_REPLY_DOMAIN`) se guardan en los Secrets de Supabase, y el cron necesita los secretos de Vault `project_url` y `email_worker_secret`. El paso a paso está en [supabase/functions/process-email-jobs/README.md](supabase/functions/process-email-jobs/README.md). Sin esto la app funciona, pero no salen correos.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en 127.0.0.1:3000 |
| `npm run build` / `npm start` | Compila y sirve la versión de producción |
| `npm run typecheck` | Revisa los tipos de TypeScript |
| `npm run lint` | Revisa el código con ESLint |
| `npm test` | Pruebas de Node: seguridad, censo y cartera (no necesitan servidor ni base de datos) |
| `npm run test:e2e` | Prueba de rutas sin sesión. Necesita el servidor encendido y `RESIQ_TEST_BASE_URL` (ver abajo) |
| `npm run verify` | Todo lo anterior menos e2e: tipos, lint, pruebas y build. Córrelo antes de cada commit |

Para la prueba e2e, con `npm run dev` corriendo en otra terminal (en PowerShell):

```powershell
$env:RESIQ_TEST_BASE_URL = "http://127.0.0.1:3000"; npm run test:e2e
```

Las pruebas de `supabase/tests` son SQL: se ejecutan contra una base de **desarrollo** y la mayoría terminan en `rollback`, así que no dejan datos.

## Documentación

1. [Prompt original íntegro](docs/00-prompt-maestro.md).
2. [Seguimiento, aprobaciones y decisiones pendientes](docs/01-seguimiento.md).
3. [Arquitectura](docs/02-arquitectura.md).
4. [Modelo de datos](docs/03-modelo-de-datos.md).
5. [Diseño de seguridad](docs/04-seguridad.md).
6. [Inicialización, dependencias y arranque](docs/05-inicializacion.md).
7. Un documento por módulo, del `06` en adelante en `docs/`.

El prompt original y las instrucciones posteriores del usuario rigen el trabajo. No avanzar de etapa sin aprobación expresa. Actualizar el seguimiento al entregar o aprobar cada etapa. Una propuesta documentada no es una decisión aprobada ni una funcionalidad implementada.

Datos de prueba: las propiedades de **Pruebas ResiQ** son de prueba y las de **Equipos ResiQ** son producción; no se mezclan.
