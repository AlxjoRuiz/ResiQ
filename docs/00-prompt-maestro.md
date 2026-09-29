
# PROMPT MAESTRO
## Plataforma SaaS de Gestión para Propiedades Horizontales

Quiero desarrollar una aplicación web SaaS profesional para la gestión de propiedades horizontales en Colombia.

La aplicación debe poder ser utilizada por múltiples conjuntos residenciales, edificios y propiedades horizontales desde una misma plataforma.

El sistema debe ser moderno, seguro, escalable, responsive y preparado para convertirse posteriormente en un producto comercial.

**IMPORTANTE:** No quiero que empieces escribiendo código inmediatamente. Primero debes analizar los requisitos, diseñar la arquitectura y organizar el proyecto por etapas. Solo después de aprobar cada etapa debemos pasar a la siguiente.

---

# 1. OBJETIVO DEL PROYECTO

Crear una plataforma que permita centralizar la gestión y comunicación entre:

- Residentes
- Propietarios
- Portería / vigilancia
- Administración de cada propiedad
- Superadministrador de la plataforma

La plataforma debe permitir gestionar:

- PQRS
- Reservas de zonas comunes
- Visitas
- Visitas de mantenimiento
- Recepción de paquetes
- Notificaciones por correo electrónico
- Cartera y morosidad
- Llamados de atención
- Asambleas
- Residentes
- Propietarios
- Apartamentos
- Torres
- Zonas comunes
- Comunicaciones administrativas

La plataforma debe ser multi-tenant desde el inicio.

---

# 2. CONCEPTO MULTI-TENANT

La aplicación debe funcionar como un SaaS.

Una sola instalación de la aplicación debe poder manejar:

```text
Plataforma
│
├── Conjunto Residencial A
│   ├── Torre 1
│   ├── Torre 2
│   └── Torre 3
│
├── Edificio B
│   ├── Torre 1
│   └── Torre 2
│
└── Conjunto C
    ├── Torre 1
    ├── Torre 2
    └── Torre 3
```

La información de una propiedad NUNCA debe ser visible para usuarios pertenecientes a otra propiedad.

La arquitectura debe utilizar:

- `property_id`
- relaciones entre usuarios y propiedades
- roles
- permisos
- Row Level Security (RLS) de Supabase

La seguridad multi-tenant es una prioridad.

---

# 3. STACK TECNOLÓGICO

Utilizar:

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

## Backend

Utilizar Supabase como backend principal.

Supabase debe encargarse de:

- PostgreSQL
- Authentication
- Google OAuth
- Row Level Security
- Storage
- APIs
- funciones necesarias
- funcionalidades relacionadas con la base de datos

## Autenticación

Utilizar:

- Supabase Auth
- Google OAuth

El usuario podrá iniciar sesión utilizando su cuenta de Google.

NO se debe permitir que cualquier persona con una cuenta de Gmail obtenga automáticamente acceso a una propiedad.

Debe existir un sistema de invitación o vinculación previamente autorizado por la administración.

Ejemplo:

```text
Administrador
      ↓
Registra apartamento 302
      ↓
Asocia correo:
usuario@gmail.com
      ↓
Usuario inicia sesión con Google
      ↓
Supabase verifica el correo
      ↓
Se vincula con apartamento 302
      ↓
Acceso autorizado
```

---

# 4. ROLES DEL SISTEMA

Debe existir inicialmente una estructura de roles.

## Superadmin

Es el administrador de la plataforma SaaS.

Puede:

- Crear propiedades
- Administrar propiedades
- Crear administradores
- Gestionar usuarios
- Gestionar configuración global
- Gestionar planes
- Consultar información general de la plataforma

NO debe tener acceso indiscriminado a información privada sin una razón administrativa definida.

---

## Administrador de propiedad

Administra un conjunto o edificio específico.

Puede:

- Administrar residentes
- Administrar propietarios
- Administrar apartamentos
- Administrar torres
- Administrar zonas comunes
- Administrar reservas
- Gestionar PQRS
- Gestionar cartera
- Crear llamados de atención
- Crear asambleas
- Gestionar documentos
- Gestionar portería
- Crear comunicados
- Consultar reportes

---

## Portería / Vigilancia

Puede:

- Registrar paquetes
- Consultar paquetes pendientes
- Registrar visitas
- Registrar ingreso de visitantes
- Registrar salida
- Consultar visitas autorizadas
- Registrar visitas de mantenimiento
- Consultar reservas
- Consultar información necesaria para sus funciones

No debe tener acceso a información financiera privada que no necesite.

---

## Residente / Propietario

Puede:

- Iniciar sesión
- Consultar su apartamento
- Crear PQRS
- Consultar sus PQRS
- Crear visitas
- Registrar visitas de mantenimiento
- Consultar paquetes
- Consultar sus reservas
- Reservar zonas comunes
- Consultar sus notificaciones
- Consultar su información de cartera cuando corresponda
- Consultar llamados de atención
- Consultar asambleas
- Confirmar asistencia a asambleas

---

# 5. ESTILO VISUAL

La aplicación debe tener una interfaz inspirada en aplicaciones SaaS modernas como Supabase.

NO copiar la interfaz de Supabase literalmente.

Tomar como referencia:

- Minimalismo
- Limpieza
- Mucho espacio visual
- Tipografía clara
- Panel lateral
- Tablas modernas
- Tarjetas simples
- Bordes sutiles
- Componentes consistentes
- Pocos colores
- Estados mediante badges
- Interfaz profesional y técnica

La interfaz debe sentirse como un producto SaaS profesional.

---

# 6. COLORES

Utilizar una paleta sobria.

Principalmente:

- Blanco
- Gris claro
- Gris oscuro
- Negro
- Verde como color principal
- Rojo para errores o mora
- Amarillo para advertencias

No utilizar colores excesivos.

---

# 7. RESPONSIVE

La aplicación debe funcionar correctamente en:

- Desktop
- Laptop
- Tablet
- Smartphone

La interfaz del residente debe estar especialmente optimizada para móviles.

La interfaz administrativa debe estar optimizada para escritorio.

---

# 8. DASHBOARD DEL RESIDENTE

El residente debe encontrar rápidamente:

```text
Dashboard

Hola, [nombre]

Apartamento: 302

[ Paquetes ]
[ Reservas ]

[ Visitas ]
[ PQRS ]

[ Cartera ]
[ Llamados ]

[ Asambleas ]
[ Notificaciones ]
```

También debe existir una sección de actividad reciente.

---

# 9. MÓDULO DE PQRS

El residente puede crear una PQRS.

Debe poder seleccionar una categoría.

Categorías iniciales:

- Contable
- Administración
- Vigilancia
- Queja
- Operativo
- Aseo
- Mantenimiento
- Sugerencia

Campos:

- Categoría
- Asunto
- Descripción
- Archivos adjuntos
- Fecha
- Usuario
- Apartamento

Estados:

```text
Pendiente
En revisión
En proceso
Respondida
Cerrada
```

Debe existir historial de conversación.

Crear una estructura como:

```text
pqrs
pqrs_messages
pqrs_attachments
```

El residente debe poder consultar el estado de sus PQRS.

La administración debe poder responderlas y cambiar su estado.

---

# 10. MÓDULO DE PAQUETES

Portería debe poder registrar un paquete.

Datos:

- Apartamento
- Destinatario
- Empresa transportadora
- Número de guía
- Descripción
- Fecha y hora
- Usuario de portería que registró
- Observaciones

Estados:

```text
Recibido
Notificado
Entregado
```

Cuando se registre el paquete:

```text
Portería registra paquete
        ↓
Sistema guarda información
        ↓
Sistema genera notificación
        ↓
Se envía correo al residente
```

La aplicación debe registrar el historial.

El residente debe poder consultar sus paquetes.

---

# 11. NOTIFICACIONES

Todas las notificaciones externas serán EXCLUSIVAMENTE mediante correo electrónico.

NO implementar WhatsApp.

NO implementar SMS inicialmente.

Los correos se utilizarán para:

### Paquetes

- Paquete recibido
- Paquete entregado

### Reservas

- Reserva creada
- Reserva aprobada
- Reserva rechazada
- Reserva cancelada

### PQRS

- PQRS creada
- Cambio de estado
- Nueva respuesta

### Visitas

- Visita registrada
- Visita de mantenimiento

### Cartera

- Aviso de mora
- Recordatorio de cartera

### Llamados de atención

- Nuevo llamado de atención

### Asambleas

- Nueva asamblea
- Recordatorio de asamblea

Debe existir un sistema para registrar:

```text
notifications
email_logs
```

Guardar:

- destinatario
- tipo
- asunto
- contenido
- fecha
- estado
- error si existe

---

# 12. MÓDULO DE RESERVAS

Los residentes pueden reservar zonas comunes.

Ejemplos:

- BBQ
- Salón social
- Piscina
- Cancha
- Gimnasio
- Zona social
- Otras zonas configuradas por administración

La administración debe poder crear zonas.

Cada zona debe tener:

- Nombre
- Descripción
- Capacidad
- Horario
- Estado
- Requiere aprobación
- Reglas

Las reservas deben controlar conflictos de horario.

No se debe permitir reservar una zona en un horario ocupado.

---

# 13. RESTRICCIÓN DE RESERVAS POR MORA

La administración debe poder configurar:

```text
¿Restringir reservas a residentes morosos?

Sí / No

Días mínimos de mora:
30
```

Si la propiedad tiene activa la restricción y el usuario cumple la condición de mora:

```text
Usuario intenta reservar
        ↓
Sistema consulta cartera
        ↓
Tiene mora
        ↓
No puede reservar
        ↓
Mostrar mensaje
        ↓
Regresar al dashboard
```

El mensaje debe ser claro y respetuoso.

Ejemplo:

> No puedes realizar reservas en este momento porque tu cuenta presenta un saldo pendiente. Comunícate con la administración para obtener información sobre tu cartera.

La regla debe ser configurable por propiedad.

---

# 14. MÓDULO DE VISITAS

El residente puede registrar visitantes.

Datos:

- Nombre
- Documento si la propiedad lo requiere
- Fecha
- Hora
- Cantidad de personas
- Observaciones
- Apartamento

Estados:

```text
Autorizada
Ingresó
Salió
Cancelada
```

Portería puede consultar las visitas autorizadas.

Debe poder registrar:

- Entrada
- Salida

---

# 15. VISITAS DE MANTENIMIENTO

El residente puede registrar una visita relacionada con:

- Plomero
- Electricista
- Técnico
- Aire acondicionado
- Internet
- Reparaciones
- Otros servicios

Datos:

- Nombre de la persona
- Empresa
- Tipo de servicio
- Fecha
- Hora
- Apartamento
- Observaciones

Portería debe poder consultar estas visitas.

---

# 16. MÓDULO DE CARTERA

La administración debe poder gestionar información de cartera.

Datos mínimos:

- Apartamento
- Propietario
- Saldo
- Fecha de vencimiento
- Días de mora
- Estado
- Fecha de actualización

Estados:

```text
Al día
Pendiente
En mora
```

La administración debe poder actualizar la información de cartera.

El sistema debe identificar automáticamente los casos que superen el número de días configurado.

Inicialmente:

```text
30 días
```

Cuando un residente entre en mora:

```text
Cartera detecta mora
        ↓
Sistema calcula valor
        ↓
Sistema genera notificación
        ↓
Se envía correo
```

El residente solamente puede consultar su propia información.

Administradores autorizados pueden consultar la cartera de la propiedad.

---

# 17. MÓDULO DE LLAMADOS DE ATENCIÓN

Administración puede crear un llamado de atención.

Datos:

- Apartamento
- Residente/propietario
- Categoría
- Motivo
- Descripción
- Fecha
- Evidencias
- Administrador responsable

Estados:

```text
Creado
Notificado
En revisión
Cerrado
```

Cuando se crea:

```text
Administrador crea llamado
        ↓
Sistema registra
        ↓
Sistema envía correo
        ↓
Residente recibe notificación
```

El residente puede consultar sus llamados de atención.

---

# 18. MÓDULO DE ASAMBLEAS

Administración puede crear una asamblea.

Datos:

- Tipo
- Título
- Fecha
- Hora
- Lugar
- Descripción
- Orden del día
- Documentos
- Estado

Tipos:

```text
Ordinaria
Extraordinaria
```

La asamblea debe permitir:

- Publicar información
- Adjuntar documentos
- Crear orden del día
- Registrar asistentes
- Registrar confirmaciones
- Registrar representación cuando corresponda
- Enviar notificaciones por correo
- Registrar asistencia

Estados:

```text
Programada
En curso
Finalizada
Cancelada
```

El residente puede:

```text
Asistiré
No asistiré
```

Debe existir un sistema para registrar asistencia.

---

# 19. VOTACIONES DE ASAMBLEA

Diseñar la arquitectura para que posteriormente pueda existir votación electrónica.

NO asumir reglas legales.

La arquitectura debe permitir posteriormente:

- Pregunta
- Opciones
- Votantes
- Coeficientes
- Resultados
- Quórum
- Mayorías

Pero antes de implementar votaciones reales, se deben identificar y validar las reglas que la propiedad desea aplicar.

---

# 20. DOCUMENTOS

Debe existir almacenamiento de documentos mediante Supabase Storage.

Ejemplos:

- Documentos de asamblea
- Evidencias de PQRS
- Evidencias de llamados
- Documentos administrativos

Debe existir control de acceso.

Un usuario no debe poder descargar un documento privado de otra propiedad.

---

# 21. BASE DE DATOS

Antes de escribir código, diseñar completamente la base de datos.

Como mínimo estudiar estas entidades:

```text
profiles
properties
property_members
buildings
units

amenities
reservations

pqrs
pqrs_messages
pqrs_attachments

packages

visitors
visitor_entries
maintenance_visits

accounts_receivable
payments
delinquency_records

attention_calls
attention_call_attachments

assemblies
assembly_agenda
assembly_attendees
assembly_documents

notifications
email_logs

audit_logs
```

No crear tablas innecesarias.

Explicar cada tabla antes de implementarla.

---

# 22. SEGURIDAD

La seguridad es una prioridad.

Utilizar:

- Supabase Auth
- RLS
- Roles
- Políticas por propiedad
- Validación de permisos
- Validación en servidor
- Protección de rutas
- Validación de formularios
- Manejo seguro de archivos
- Auditoría de acciones importantes

Nunca confiar únicamente en restricciones del frontend.

Toda operación sensible debe estar protegida en backend/database.

---

# 23. AUDITORÍA

Crear un sistema de auditoría para acciones importantes.

Ejemplo:

```text
Usuario
Acción
Entidad
Entidad ID
Fecha
IP si corresponde
Metadatos
```

Ejemplos:

```text
Administrador creó llamado de atención
Portero registró paquete
Administrador modificó cartera
Usuario creó PQRS
Administrador respondió PQRS
Administrador creó asamblea
```

---

# 24. ARQUITECTURA DEL FRONTEND

Organizar el proyecto correctamente.

Utilizar una estructura mantenible.

Separar:

- componentes
- páginas
- layouts
- hooks
- servicios
- tipos
- validaciones
- utilidades
- configuración
- acceso a Supabase

No colocar toda la lógica dentro de los componentes.

Utilizar TypeScript correctamente.

Evitar `any` salvo casos realmente justificados.

---

# 25. COMPONENTES UI

Crear componentes reutilizables:

```text
Button
Input
Select
Textarea
Modal
Dialog
Card
Table
Badge
Dropdown
Sidebar
Navbar
Toast
Tabs
Pagination
DatePicker
FileUpload
EmptyState
LoadingState
ErrorState
```

Mantener consistencia visual en toda la aplicación.

---

# 26. DASHBOARDS

Crear dashboards específicos para:

### Residente

- Paquetes
- Reservas
- Visitas
- PQRS
- Cartera
- Llamados
- Asambleas
- Notificaciones

### Portería

- Paquetes
- Visitas
- Mantenimiento
- Ingresos
- Salidas
- Reservas

### Administración

- Residentes
- Propiedades
- Apartamentos
- PQRS
- Reservas
- Cartera
- Llamados
- Asambleas
- Zonas
- Reportes

### Superadmin

- Propiedades
- Administradores
- Usuarios
- Configuración
- Planes
- Métricas

---

# 27. ETAPAS DE DESARROLLO

NO desarrollar todo de una vez.

Trabajar estrictamente en estas etapas.

---

## ETAPA 0 — Análisis

Antes de programar:

1. Analizar todos los requisitos.
2. Detectar contradicciones.
3. Identificar información faltante.
4. Proponer mejoras.
5. Definir alcance del MVP.
6. Identificar riesgos técnicos.
7. Identificar riesgos de seguridad.

No escribir código todavía.

---

# ETAPA 1 — Arquitectura

Diseñar:

- Arquitectura general
- Frontend
- Backend
- Base de datos
- Autenticación
- Multi-tenancy
- Roles
- RLS
- Storage
- Sistema de correo

Entregar un diagrama de arquitectura.

No comenzar todavía con funcionalidades.

---

# ETAPA 2 — Modelo de datos

Diseñar todas las tablas.

Para cada tabla indicar:

- Nombre
- Propósito
- Columnas
- Tipo de dato
- Primary key
- Foreign keys
- Relaciones
- Índices
- Restricciones
- RLS necesaria

Crear también un diagrama ER.

No generar todavía toda la aplicación.

---

# ETAPA 3 — Seguridad

Diseñar:

- Roles
- Permisos
- RLS
- Protección de rutas
- Acceso a Storage
- Aislamiento entre propiedades

Probar conceptualmente:

```text
Usuario propiedad A
NO puede acceder
a información propiedad B.
```

---

# ETAPA 4 — Inicialización del proyecto

Crear:

- Proyecto Next.js
- TypeScript
- Tailwind
- shadcn/ui
- Supabase
- variables de entorno
- estructura de carpetas
- configuración inicial

No implementar todavía todos los módulos.

---

# ETAPA 5 — Autenticación

Implementar:

- Login
- Logout
- Google OAuth
- Sesiones
- Protección de rutas
- Perfil
- Invitaciones
- Vinculación con propiedad/apartamento

Probar todos los flujos.

---

# ETAPA 6 — Multi-tenant

Implementar:

- Propiedades
- Torres
- Apartamentos
- Usuarios
- Relaciones
- Roles
- RLS

Esta etapa debe quedar completamente funcional antes de continuar.

---

# ETAPA 7 — Dashboard

Crear dashboards para:

- Residente
- Portería
- Administración
- Superadmin

Implementar navegación y permisos.

---

# ETAPA 8 — PQRS

Implementar completamente:

- Crear
- Consultar
- Responder
- Cambiar estado
- Categorías
- Adjuntos
- Historial
- Notificación por correo

---

# ETAPA 9 — Paquetes

Implementar:

- Registro por portería
- Consulta
- Estados
- Entrega
- Historial
- Notificación por correo

---

# ETAPA 10 — Visitas

Implementar:

- Crear visitante
- Autorizar
- Consultar
- Registrar entrada
- Registrar salida
- Visitas de mantenimiento
- Notificaciones por correo

---

# ETAPA 11 — Zonas y reservas

Implementar:

- Crear zonas
- Horarios
- Disponibilidad
- Reservas
- Cancelaciones
- Aprobaciones
- Prevención de conflictos
- Restricción por mora

---

# ETAPA 12 — Cartera

Implementar:

- Registro de cartera
- Actualización
- Cálculo de mora
- Configuración de días
- Restricción de reservas
- Notificaciones por correo

---

# ETAPA 13 — Llamados de atención

Implementar:

- Crear
- Consultar
- Adjuntar evidencia
- Estados
- Historial
- Notificación por correo

---

# ETAPA 14 — Asambleas

Implementar:

- Crear asamblea
- Orden del día
- Documentos
- Confirmación
- Asistencia
- Representación
- Notificaciones
- Recordatorios

Dejar preparada la arquitectura para votaciones futuras.

---

# ETAPA 15 — Notificaciones

Centralizar todas las notificaciones.

Utilizar exclusivamente correo electrónico.

Crear plantillas reutilizables.

Ejemplos:

```text
package_received
reservation_created
reservation_approved
reservation_rejected
pqrs_created
pqrs_updated
delinquency_notice
attention_call
assembly_created
assembly_reminder
```

Registrar todos los envíos.

---

# ETAPA 16 — Auditoría y seguridad

Revisar:

- RLS
- Roles
- Permisos
- Archivos
- Formularios
- API
- Autenticación
- Multi-tenancy
- Logs
- Auditoría

Intentar detectar accesos no autorizados.

---

# ETAPA 17 — Testing

Crear pruebas para:

- Login
- Roles
- RLS
- Reservas
- PQRS
- Paquetes
- Visitas
- Cartera
- Llamados
- Asambleas
- Notificaciones

Probar especialmente el aislamiento entre propiedades.

---

# ETAPA 18 — Responsive y UX

Revisar toda la aplicación en:

- Desktop
- Tablet
- Mobile

Priorizar la experiencia móvil del residente.

---

# ETAPA 19 — Deploy

Preparar:

- Producción
- Variables de entorno
- Supabase
- Vercel
- Dominio
- HTTPS
- Configuración de correo
- Seguridad

---

# ETAPA 20 — Preparación SaaS

Preparar la plataforma para venderla a diferentes propiedades.

Diseñar:

- Propiedades
- Planes
- Límites
- Administración
- Onboarding
- Métricas
- Configuración por propiedad

No implementar facturación automáticamente hasta definir el modelo comercial.

---

# 28. REGLAS DE TRABAJO PARA LA IA

Estas reglas son MUY IMPORTANTES.

1. No escribir código antes de completar la etapa correspondiente.

2. No saltar etapas.

3. No asumir requisitos que no hayan sido definidos.

4. Si falta información importante, preguntar antes de implementar.

5. Explicar las decisiones técnicas.

6. Priorizar seguridad.

7. Priorizar arquitectura mantenible.

8. Evitar sobreingeniería innecesaria.

9. Utilizar TypeScript correctamente.

10. No duplicar código.

11. Crear componentes reutilizables.

12. No utilizar `any` sin justificación.

13. No colocar secretos en el frontend.

14. No colocar claves privadas de Supabase en código público.

15. Nunca confiar únicamente en el frontend para permisos.

16. Toda información debe estar aislada por `property_id`.

17. Todas las tablas sensibles deben tener RLS correctamente configurado.

18. Antes de crear una tabla nueva, verificar si una existente puede cubrir el requisito.

19. Antes de crear una dependencia nueva, explicar por qué es necesaria.

20. Mantener el diseño visual consistente.

---

# 29. FORMA DE TRABAJO

Quiero trabajar contigo de forma incremental.

En cada etapa debes responder:

### 1. Objetivo de la etapa

Explicar qué vamos a conseguir.

### 2. Decisiones

Explicar las decisiones técnicas.

### 3. Archivos afectados

Mostrar qué archivos se crearán o modificarán.

### 4. Implementación

Escribir únicamente el código necesario para esa etapa.

### 5. Pruebas

Indicar cómo probarlo.

### 6. Checklist

Mostrar:

```text
[ ] Funcionalidad implementada
[ ] Seguridad revisada
[ ] RLS revisado
[ ] Responsive revisado
[ ] Errores controlados
[ ] Pruebas realizadas
```

### 7. Siguiente etapa

No comenzar automáticamente la siguiente etapa.

Esperar mi confirmación.

---

# 30. PRINCIPIO FUNDAMENTAL

Este proyecto debe construirse como un producto real, no como un proyecto de tutorial.

Prioridades:

1. Seguridad
2. Arquitectura
3. Mantenibilidad
4. Experiencia de usuario
5. Escalabilidad
6. Rendimiento
7. Diseño visual
8. Funcionalidades

No sacrificar seguridad ni arquitectura por escribir código rápidamente.

---

# 31. PRIMERA ACCIÓN

Al recibir este prompt NO debes empezar creando archivos.

Primero debes:

1. Analizar todos los requisitos.
2. Resumir el producto.
3. Identificar los módulos.
4. Identificar las entidades principales.
5. Identificar las relaciones.
6. Identificar los roles.
7. Identificar los permisos.
8. Identificar riesgos.
9. Identificar información faltante.
10. Proponer el MVP.
11. Proponer el roadmap.
12. Presentar la arquitectura inicial.

Después de eso, esperar mi confirmación antes de pasar a la ETAPA 1.

---

## OBJETIVO FINAL

Al terminar todas las etapas quiero tener una aplicación SaaS profesional para propiedades horizontales que pueda ser utilizada por múltiples conjuntos residenciales y edificios.

Debe permitir que un residente pueda:

- Iniciar sesión con Google
- Ver su apartamento
- Crear PQRS
- Registrar visitas
- Registrar mantenimiento
- Consultar paquetes
- Recibir correos
- Reservar zonas comunes
- Consultar cartera
- Recibir avisos de mora
- Consultar llamados de atención
- Consultar asambleas
- Confirmar asistencia

La portería debe poder:

- Registrar paquetes
- Registrar visitas
- Registrar entradas
- Registrar salidas
- Registrar mantenimiento
- Consultar información necesaria para sus funciones

La administración debe poder:

- Gestionar residentes
- Gestionar apartamentos
- Gestionar zonas
- Gestionar reservas
- Gestionar PQRS
- Gestionar cartera
- Crear llamados de atención
- Crear asambleas
- Gestionar documentos
- Enviar comunicaciones
- Consultar reportes

Y el superadmin debe poder administrar la plataforma SaaS y múltiples propiedades.

La aplicación debe ser segura, moderna, sencilla, responsive y visualmente inspirada en productos SaaS como Supabase, pero con identidad propia.

**Comienza únicamente con la ETAPA 0 — ANÁLISIS. No escribas código todavía.**