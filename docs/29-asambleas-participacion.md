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

`assembly_self_check_in_catalog_readonly.sql` comprueba cuatro propiedades del catalogo sin modificar datos. La prueba transaccional remota y el marcado de asistencia con una cuenta convocada siguen pendientes. La interfaz solo puede publicarse despues de que Alejandro confirme el SQL y el catalogo.

Alejandro confirmo el 21 de octubre `ASSEMBLY_SELF_CHECK_IN_SCHEMA_OK` y los cuatro resultados `true` en SQL Editor. Es una confirmacion de esquema, no una prueba de marcar asistencia con una cuenta convocada.

Alejandro confirmo despues las siete comprobaciones de catalogo del censo. Antes de publicar esta entrega, verificar el push y el despliegue sin confundirlos con una prueba funcional en produccion.

La preparacion de SQL y prueba quedo en `3151cf7`, subida a `main`. El commit `ed2a2f9` que la incluye reporto Vercel `success`; esto solo despliega archivos fuente, no aplica la migracion a Supabase. No se ha publicado el boton de auto-registro.

## Interfaz de asistencia

El detalle de una asamblea publicada y en curso muestra a cada convocado una tarjeta «Mi asistencia». El boton aparece solo si la presencia sigue pendiente. Tras registrarse se muestra fecha y hora; si ya hay ausencia asentada, se solicita correccion administrativa. Al finalizar, el estado se puede consultar, pero ya no se permite auto-registro. La accion de servidor verifica sesion y propiedad; la RPC valida convocatoria, vinculo vigente, estado e idempotencia. No se ha hecho una prueba funcional en produccion ni se ha creado una asamblea para este cambio.

Verificacion local: TypeScript, compilacion de produccion y 20 pruebas de seguridad aprobaron; ESLint termino sin errores, con seis advertencias preexistentes ajenas a Asambleas. `git diff --check` no encontro problemas. La prueba real de marcado, visibilidad en dos perfiles y resistencia a sesiones sin permiso queda pendiente de un caso controlado con Alejandro.
