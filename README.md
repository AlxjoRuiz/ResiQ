# Propiedad Horizontal

Plataforma SaaS para propiedades horizontales de Colombia. Estado: etapas 0–12 aprobadas; diseño de la etapa 13, llamados de atención, pendiente de aprobación.

## Orden de lectura para continuar

1. [Prompt original íntegro](docs/00-prompt-maestro.md).
2. [Seguimiento, aprobaciones y decisiones pendientes](docs/01-seguimiento.md).
3. [Arquitectura aprobada](docs/02-arquitectura.md).
4. [Modelo de datos aprobado](docs/03-modelo-de-datos.md).
5. [Diseño de seguridad aprobado](docs/04-seguridad.md).
6. [Inicialización, dependencias y arranque](docs/05-inicializacion.md).

El prompt original y las instrucciones posteriores del usuario rigen el trabajo. No avanzar de etapa sin aprobación expresa. Actualizar el seguimiento al entregar o aprobar cada etapa. Una propuesta documentada no es una decisión aprobada ni una funcionalidad implementada.

Datos de prueba acordados: dos propiedades ficticias, veinte apartamentos cada una. No representan límites del producto. La ubicación principal del proyecto es `C:\Users\Alejandro\Desktop\ResiQ`.

## Desarrollo local

Consulta [Inicialización y arranque](docs/05-inicializacion.md) y el [seguimiento vigente](docs/01-seguimiento.md). Supabase, Google OAuth y los módulos aprobados hasta cartera están integrados. Comandos: npm run dev, npm run lint, npm run typecheck, npm run build y npm run verify.
