# Ajuste visual de paneles — 2026-10-07

Alejandro aprobó aplicar la propuesta clara: verde salvia, tarjetas blancas, bordes redondeados y sombras suaves, con el mismo lenguaje visual para administración, residente y portería.

## Implementación

- Dashboard de propiedad con barra lateral derivada de los módulos permitidos por el perfil y selector de perfiles existentes.
- Navegación horizontal en móvil, tarjetas en una columna y textos adaptables.
- Resúmenes limitados a cinco visitas, paquetes y PQRS visibles mediante la sesión autenticada y las políticas RLS actuales. Portería no consulta PQRS.
- No se incorporan cifras ficticias, gráficos financieros de muestra, nuevas acciones administrativas ni botones sin función. Los módulos pendientes conservan su indicación de próxima etapa.
- Estilos aislados en dashboard.module.css y ajuste de las tarjetas compartidas de dashboards; login y formularios operativos conservan sus estilos.

## Alcance de seguridad

Se conserva requirePropertyMember y la selección de perfiles por roles de la membresía. Consultas acotadas por property_id, con el cliente autenticado existente. No hay migraciones, cambios de permisos, escrituras de datos ni uso de la clave privada.

## Validación

En curso: TypeScript, ESLint, compilación de producción y comprobación visual. Esta entrega no cierra la auditoría de seguridad ni la etapa 15 de notificaciones.
