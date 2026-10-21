# Asambleas: participacion en vivo (ampliacion aprobada)

Alejandro aprobo continuar esta ampliacion el 21 de octubre de 2026. No forma parte del modulo de la abogada ni cierra la revision responsive de la etapa 18.

## Reglas comunicadas

- Se conservan convocatoria, agenda, documentos, RSVP, representaciones y registro administrativo de asistencia.
- Antes de iniciar, cada convocado puede plantear dudas. Las dudas y respuestas deben ser visibles para todos los convocados; Administracion debe recibirlas en su panel.
- Cuando Administracion inicia la asamblea, cada convocado marca su propia llegada desde su perfil, sin codigo. El registro es autodeclarado y no demuestra presencia fisica.
- Durante la asamblea, Administracion abre preguntas de participacion con respuesta por seleccion o texto, y votaciones. Se muestran sin esperar recarga manual prolongada.
- Cada convocado tiene un voto por votacion; un poder no agrega automaticamente otro voto. Al cerrar, el resultado se muestra enseguida sin aprobacion posterior.
- Solo puede votar quien haya marcado asistencia. Los convocados ven los totales al cerrar, no quien eligio cada opcion.
- Las respuestas de participacion no se contabilizan como votos. No se calcula automaticamente quorum, coeficientes ni mayorias con las reglas actualmente comunicadas.

## Orden de entregas

1. Auto-registro de asistencia: migracion y prueba de catalogo, confirmacion de Alejandro en SQL Editor, interfaz y prueba con una asamblea sintetica dirigida solo a cuentas controladas.
2. Dudas previas publicas para convocados y aviso interno a Administracion.
3. Preguntas de participacion y votaciones en vivo, con bloqueo al cerrar, resultado inmediato, aislamiento entre propiedades y pruebas de concurrencia. El requisito de asistencia y la privacidad del voto individual quedaron confirmados por Alejandro.

## Entrega 1 preparada, sin publicar

`20261021210000_assembly_self_check_in.sql` crea `self_check_in_assembly`. Solo acepta una cuenta activa convocada con vinculo vigente durante una asamblea publicada y en curso. Un reintento sobre presencia registrada es idempotente. No permite cambiar una ausencia ni sustituye las correcciones administrativas existentes. Guarda actor, fecha, actividad y auditoria.

`assembly_self_check_in_catalog_readonly.sql` comprueba cuatro propiedades del catalogo sin modificar datos. Falta su aplicacion y prueba transaccional remota; ninguna asistencia real ha sido marcada por este cambio. La interfaz no debe publicarse hasta que Alejandro confirme el SQL y el catalogo.

Alejandro confirmo despues las siete comprobaciones de catalogo del censo. Antes de publicar esta entrega, verificar el push y el despliegue sin confundirlos con una prueba funcional en produccion.
