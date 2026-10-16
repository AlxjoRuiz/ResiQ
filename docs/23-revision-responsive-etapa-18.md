# Etapa 18 — revisión responsive y UX

Estado: iniciada por aprobación de Alejandro el 14 de octubre de 2026. Alcance del prompt maestro: escritorio, tableta y móvil, con prioridad para Residente. Este registro distingue mejoras de código de comprobaciones reales en dispositivos.

## Cambios preparados

- Calendario de disponibilidad: en móvil cada celda muestra un día compacto y una leyenda de colores; el detalle y los horarios se leen al seleccionar el día.
- Navegación de módulos: en móvil y tableta, la barra horizontal centra automáticamente la sección activa al cambiar de página. Aplica a Residente, Portería y Administración porque comparten la misma navegación.
- Tarjetas y formularios de módulos: los textos largos sin espacios pueden partirse y los campos nativos pueden contraerse dentro del ancho disponible. Detectado por revisión de código; falta comprobación visual.
- Nueva reserva: el calendario y el formulario comparten la zona seleccionada; cambiarla en cualquiera de los dos actualiza el otro. Evita consultar disponibilidad para una zona y enviar la solicitud para otra, especialmente al desplazarse en móvil. Falta comprobación visual y funcional publicada.
- Calendario de disponibilidad: los días sin horario de la zona se distinguen en gris y se anuncian como «Sin horario»; si el horario de la víspera cruza la medianoche, se muestra hasta qué hora continúa. Falta comprobación visual publicada.
- Calendario de disponibilidad: navegación por el mes actual y los once siguientes. Cada mes consulta sus propios cruces y cierres; la zona seleccionada se conserva al navegar. Alejandro confirmó el 15 de octubre de 2026 que pudo pasar a noviembre en la web publicada y que los controles compactos de mes se ven bien en móvil.
- Formulario de Nueva reserva: Alejandro confirmó el 16 de octubre de 2026 que en móvil puede ver y usar Zona, Apartamento, Inicio, Fin, Asistentes, Motivo y el botón Crear reserva, sin contenido cortado ni desplazamiento lateral.
- Formulario de Nueva reserva: tras una validación fallida del motivo, conserva los valores elegidos y muestra junto al campo que necesita al menos 3 caracteres. Alejandro detectó que antes se borraban todos los datos; falta comprobar el arreglo publicado después de la prueba de vencimiento del lunes para no alterar esa reserva.
- Cartera → Estado por apartamento: en móvil, las seis columnas ya no comprimen los encabezados en fragmentos de dos letras; la tabla tiene ancho mínimo y se desplaza dentro de su cuadro, con una indicación visible. Alejandro confirmó el 16 de octubre que «Apartamento» se lee completo y que puede deslizar la tabla en su móvil.
- Campos de texto en móvil: Alejandro comprobó en iPhone/Safari que el ajuste inicial evitó el zoom en Asunto, pero Descripción seguía ampliando la página al enfocarla. La clase `text-sm` tenía mayor prioridad que la regla genérica de `textarea`; se aumentó la especificidad para áreas de texto y selectores con clase, de modo que usen 16 px en pantallas estrechas. Alejandro confirmó el 16 de octubre que PQRS ya quedó bien en su dispositivo.
- Notificaciones: «Ver aviso» abre primero el resumen completo dentro de Notificaciones, con regreso a la lista. «Abrir sección relacionada» conserva un enlace «Volver al aviso» en la página de destino, para PQRS, Llamados, Paquetes y los demás tipos. Falta comprobar el recorrido publicado sin usar avisos de Reservas antes de la prueba de vencimiento del lunes.

## Comprobación visual pendiente

- En móvil estrecho, abrir Reservas → Nueva reserva y seleccionar un día libre y uno ocupado; revisar el significado de los colores y el foco visible. El formulario y el ancho de página ya fueron confirmados por Alejandro.
- En móvil y tableta, abrir secciones lejanas de cada rol (por ejemplo, Cartera, Asambleas, Notificaciones); confirmar que la sección activa aparece en la barra y se puede navegar manualmente a las demás.
- Recorrer después formularios, listas y detalles de Residente; luego las vistas operativas de Portería y Administración. Registrar y corregir cada problema reproducible antes de cerrar la etapa.
