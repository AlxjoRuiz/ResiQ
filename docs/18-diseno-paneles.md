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

TypeScript, ESLint y compilación local de producción con Next.js 16.4.0/Webpack correctos. PR #12 fusionado y despliegue de producción confirmado por Vercel.

Revisión visual real con sesión residente: apartamento 101, único selector de perfil Residente, acceso a sus paquetes y PQRS, estados vacíos y navegación lateral hacia Paquetes y de regreso. Escritorio y ancho real de 388 px sin desbordamiento horizontal de la página; la navegación móvil tiene desplazamiento horizontal propio. Se restableció el tamaño del navegador al terminar.

Capturas conservadas localmente en el directorio de visualizaciones de Codex: panel-residente-salvia-escritorio.png y panel-residente-salvia-movil.png. No se modificaron datos para estas pruebas. Administración y portería comparten los estilos y conservan sus módulos por rol; su comprobación visual con sesiones reales de esos perfiles queda pendiente.

Esta entrega no cierra la auditoría de seguridad ni la etapa 15 de notificaciones.

## Resumen central sin accesos duplicados — 2026-10-07

A petición de Alejandro, se retiraron las tarjetas centrales de servicios; los accesos permanecen en la barra lateral. El centro muestra novedades dirigidas a la membresía actual, cartera consultada mediante la RPC existente de cuentas autorizadas y estados de visitas, paquetes y PQRS. Portería no consulta cartera ni PQRS. No se marcan notificaciones como leídas, no se generan avisos y no cambian permisos. Este resumen de lectura no completa la etapa de centralización de notificaciones.

Verificación: TypeScript y ESLint correctos; Vercel compiló correctamente la rama. Los resultados finales de compilación y revisión visual se registran en https://github.com/AlxjoRuiz/ResiQ/pull/14.


## Diseño compartido de módulos — 2026-10-07

Alejandro solicitó extender el diseño a paquetes, reservas y los demás módulos. Se añadió un layout de propiedad con marco visual compartido, navegación derivada de los mismos módulos por rol y sección activa en listados, formularios y detalles. El dashboard conserva su marco existente, sin anidar dos barras laterales. Las pantallas generales de /panel reciben la misma superficie salvia y tarjetas blancas.

Las acciones, campos, enlaces, protección por página y consultas de cada módulo se conservan. El layout comprueba la membresía para presentar la navegación; no reemplaza las comprobaciones de autorización de páginas, RPC ni RLS. Al cambiar un rol, las páginas y acciones siguen comprobando permisos aunque un layout ya abierto mantenga su navegación hasta recargar.

Verificaciones y capturas finales: registradas en el PR correspondiente a codex/diseno-modulos. No completa las etapas funcionales pendientes ni cambia permisos.
