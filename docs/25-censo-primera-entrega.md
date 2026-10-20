# Censo de residentes — primera entrega aprobada

Alejandro autorizó esta entrega el 20 de octubre de 2026. Es una ampliación funcional separada de la revisión responsive de la etapa 18; no declara cerradas las etapas 19 ni 20.

## Alcance

- Administración carga un `.xlsx` de hasta 2 MB y 500 respuestas. La vista previa lee el archivo localmente, muestra conteos, errores, duplicados y todos los campos de cada fila. No guarda nada hasta «Confirmar importación».
- El servidor vuelve a leer y validar el mismo archivo. La RPC `import_census` crea en una sola transacción las torres, apartamentos, lote y respuestas completas. Si una fila falla, no queda una importación parcial.
- Esta primera entrega exige que la propiedad no tenga torres ni apartamentos. Una repetición exacta del mismo contenido devuelve el lote existente; otro archivo se rechaza si ya hay estructura. La importación incremental y conciliación de datos existentes quedan para un diseño posterior.
- El Excel de referencia tiene 27 encabezados y una sola respuesta poblada, aunque contiene 255 filas físicas por formato. Se conservan encabezados y valores en orden, incluso vacíos y columnas adicionales con encabezado.
- La ficha del administrador organiza las respuestas en Residente, Familia, Vehículos, Mascotas y Otros, además de «Todos los campos originales». Permite consultar varias respuestas del mismo apartamento.
- No se infiere el piso, porque el archivo no lo contiene. Los pisos quedan «Sin información» hasta definir una regla confirmada.
- La importación no crea usuarios, membresías ni invitaciones. Un correo censal no concede acceso. El envío de invitaciones se hará después, seleccionando apartamento y destinatario.
- El Excel ficticio de prueba coloca `alejoruizm11@gmail.com` en Torre 1 · 101, como pidió Alejandro. No se importa automáticamente ni reanuda el acceso de esa cuenta.

## Datos sensibles y acceso

Las respuestas incluyen información de discapacidad y menores. Las tablas `census_imports` y `census_records` solo conceden lectura a administradores activos de la misma propiedad mediante RLS. No hay lectura para Residente ni Portería y no hay escritura directa desde el cliente. El servidor vuelve a comprobar el rol; la RPC también lo valida en PostgreSQL. No se ofrece descarga ni edición en esta entrega.

El texto y valor de autorización se guardan tal como llegaron del Excel. No se interpretan como consentimiento para invitar, enviar correos u otra finalidad.

## Activación controlada

1. Abrir en GitHub el archivo completo `supabase/migrations/20261020234000_census_import.sql`, copiar su contenido íntegro al SQL Editor y comprobar que el final dice `select 'CENSO_SCHEMA_OK' as result;` antes de pulsar Run. No ejecutar SQL parcial. La respuesta esperada es una fila `CENSO_SCHEMA_OK`; después ejecutar `supabase/tests/census_catalog_readonly.sql` y confirmar que todas sus columnas sean `true`.
2. Publicar la interfaz solo después de confirmar la migración. La validación local de TypeScript, lint y parser no es una prueba del piloto.
3. En el piloto, importar únicamente `outputs/01a15b3a-46f0-73f2-9870-2f033dd11f04/censo-prueba-resiq.xlsx` a la propiedad de prueba elegida por Alejandro. Confirmar torres, apartamentos, las seis respuestas, la ficha y que Torre 1 · 101 muestre el correo solicitado sin vincular la cuenta.
4. Verificar con una cuenta no administrativa que la ruta y los datos censales no sean accesibles. No usar el Excel real para esta prueba.

## Fuera de esta entrega

Edición e historial de cambios, exportación completa con permiso específico, corrección interactiva de columnas, conciliación con una estructura ya existente, inferencia de piso e invitación desde el censo. Requieren diseño y validación por separado.
