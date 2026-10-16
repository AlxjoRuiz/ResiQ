# Asambleas: creación y publicación en un solo flujo

Alejandro aprobó el 16 de octubre de 2026 quitar el paso de borrador para nuevas asambleas. El formulario único reúne datos, orden del día, convocados y documentos. Un solo selector acepta de uno a cinco PDF/JPG/PNG de hasta 10 MB cada uno: el primero se registra como convocatoria obligatoria y los demás como soportes. El orden y el papel de cada archivo se muestran antes de publicar. El botón final crea y publica la asamblea y genera un aviso interno para cada convocado.

## Seguridad y consistencia

- Los archivos se cargan de forma privada y se validan antes de publicar. Un archivo inválido no genera asamblea ni aviso.
- La función `create_published_assembly` confirma en una transacción la asamblea, agenda, convocados, documentos, publicación y avisos. La convocatoria es obligatoria también al publicar borradores antiguos.
- Un identificador de solicitud evita una segunda asamblea si se reintenta la creación tras perder la respuesta. Los archivos preparados para un reintento se descartan si ya existía la asamblea.
- Los borradores históricos no se eliminan; siguen pudiendo completarse y publicarse con una convocatoria válida. El nuevo formulario no crea borradores.

## Orden de activación

1. Aplicar `supabase/migrations/20261016180000_publish_assembly_on_create.sql` en ResiQ antes de desplegar la interfaz.
2. Ejecutar `supabase/tests/assembly_one_step_catalog_readonly.sql` y comprobar cinco columnas `true`.
3. Publicar la interfaz y crear una asamblea sintética dirigida solo a la cuenta de prueba. Verificar un único aviso, documento descargable, agenda y convocado; evitar convocar a residentes ajenos durante la prueba.

## Seguimiento

Si un usuario cierra el navegador tras cargar un archivo y antes de crear la asamblea, el archivo privado preparado vence a las 24 horas y nunca se muestra como documento de una asamblea. La limpieza de objetos preparados abandonados requiere una tarea periódica de Storage; no borrar filas de `storage.objects` por SQL.
