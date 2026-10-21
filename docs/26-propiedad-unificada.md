# Propiedad unificada — primera etapa del rediseño

Alejandro pidió el 20 de octubre de 2026 que la importación y la consulta torre → apartamento → información completa vivan dentro de «Propiedad», sin una opción «Censo» en el menú lateral. Esta entrega reorganiza la interfaz; no cambia ni borra las tablas del censo, torres, apartamentos, invitaciones o vínculos.

## Alcance de esta entrega

- «Propiedad» presenta la importación como primera acción. La vista previa sigue siendo obligatoria y muestra errores antes de guardar.
- Las torres aparecen en orden natural, cerradas inicialmente. Dentro de cada una se abren los apartamentos, ordenados por piso registrado y luego por número. Si el piso está vacío se muestra «Sin información»; no se deduce del número.
- Cada respuesta del Excel aparece separada dentro de su apartamento, con secciones temáticas y todos los encabezados y valores originales. Los vínculos de acceso a ResiQ se distinguen de los datos censales.
- Las invitaciones, Portería y los demás módulos conservan sus funciones. Después de la revisión visual, Alejandro pidió retirar de Propiedad las secciones «Gestión manual de unidades» y «Datos generales»; esto no borra registros, tablas ni las funciones de servidor existentes.
- La antigua ruta `/censo` redirige a «Propiedad» para no mantener una segunda vista.

## Límites y prueba pendiente

No se implementa todavía «Descargar Excel», edición del censo, conciliación incremental, reglas de piso ni invitación automática. La exportación completa debe tratarse en una entrega separada por incluir datos personales sensibles de menores y discapacidad. Hasta entonces, solo administradores activos pueden leer las respuestas por la política existente.

Esta reorganización puede revisarse visualmente sin crear datos. La prueba funcional de importación requiere elegir primero la propiedad de prueba y confirmar expresamente el uso del Excel ficticio. Una prueba local o un despliegue exitoso no equivalen a una importación aprobada por Alejandro.

## Estado

El código de esta etapa quedó en `c19b08a`, subido a `main`, y Vercel confirmó su despliegue. Pasaron TypeScript, ESLint sin errores (seis advertencias preexistentes), compilación, tres pruebas del parser y 16 pruebas de seguridad. Sigue pendiente que Alejandro confirme la presentación de Propiedad en producción; no se ha realizado la importación funcional ni una prueba de exportación.

El ajuste posterior que retiró «Datos generales» y «Gestión manual de unidades» quedó en `fe86f87`, subido a `main` y desplegado por Vercel. Pasaron TypeScript, ESLint sin errores (las mismas seis advertencias), compilación y las 16 pruebas de seguridad. Falta que Alejandro confirme visualmente la ausencia de ambos bloques en producción.
