# Etapa 18 — revisión responsive y UX

Estado: iniciada por aprobación de Alejandro el 14 de octubre de 2026. Alcance del prompt maestro: escritorio, tableta y móvil, con prioridad para Residente. Este registro distingue mejoras de código de comprobaciones reales en dispositivos.

## Cambios preparados

- Calendario de disponibilidad: en móvil cada celda muestra un día compacto y una leyenda de colores; el detalle y los horarios se leen al seleccionar el día.
- Navegación de módulos: en móvil y tableta, la barra horizontal centra automáticamente la sección activa al cambiar de página. Aplica a Residente, Portería y Administración porque comparten la misma navegación.
- Tarjetas y formularios de módulos: los textos largos sin espacios pueden partirse y los campos nativos pueden contraerse dentro del ancho disponible. Detectado por revisión de código; falta comprobación visual.
- Nueva reserva: el calendario y el formulario comparten la zona seleccionada; cambiarla en cualquiera de los dos actualiza el otro. Evita consultar disponibilidad para una zona y enviar la solicitud para otra, especialmente al desplazarse en móvil. Falta comprobación visual y funcional publicada.
- Calendario de disponibilidad: los días sin horario de la zona se distinguen en gris y se anuncian como «Sin horario»; si el horario de la víspera cruza la medianoche, se muestra hasta qué hora continúa. Falta comprobación visual publicada.
- Calendario de disponibilidad: navegación por el mes actual y los once siguientes. Cada mes consulta sus propios cruces y cierres; la zona seleccionada se conserva al navegar. Falta comprobación funcional publicada.

## Comprobación visual pendiente

- En móvil estrecho, abrir Reservas → Nueva reserva, seleccionar un día libre y uno ocupado; revisar legibilidad, foco visible y ausencia de desplazamiento horizontal de la página.
- En móvil y tableta, abrir secciones lejanas de cada rol (por ejemplo, Cartera, Asambleas, Notificaciones); confirmar que la sección activa aparece en la barra y se puede navegar manualmente a las demás.
- Recorrer después formularios, listas y detalles de Residente; luego las vistas operativas de Portería y Administración. Registrar y corregir cada problema reproducible antes de cerrar la etapa.
