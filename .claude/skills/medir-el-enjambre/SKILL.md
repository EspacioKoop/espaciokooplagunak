---
name: medir-el-enjambre
description: Medir una tanda de agentes con fuentes autorizadas, consultas de solo lectura y resultados agregados, sin publicar la infraestructura privada ni confundir intentos con peticiones.
---

# Medir el enjambre

**Duda del instrumento antes que del sistema.** Una tasa no es fiable hasta
comprobar el esquema, la ventana, el denominador y la procedencia de sus filas.
Esta receta es genérica: no identifica una instalación ni habilita acceso a ella.

## Fuentes y límites

- Consultar primero el repositorio público para PR, reviews, checks y merges.
- La telemetría privada solo se consulta con autorización de su responsable y
  dentro de su dominio. Sus rutas, cuentas, proyectos, proveedores configurados,
  nombres de servicios y órdenes de operación no pertenecen al repositorio público.
- Obtener las rutas y herramientas del procedimiento privado autorizado; no
  inferirlas desde una ruta habitual ni desde la instalación de otro colaborador.
- No ejecutar cambios, reintentos, reinicios ni escrituras como parte de medir.
  Una incidencia detectada se informa; su reparación necesita alcance propio.
- Abrir SQLite con `mode=ro` y `uri=True`, únicamente sobre una fuente explícita.
  Leer solo columnas pertinentes; nunca volcar prompts, credenciales o payloads.

## Definir qué se cuenta

Separar antes de agregar:

1. **Peticiones lógicas:** una intención del cliente.
2. **Intentos reales al proveedor:** una petición puede producir varios.
3. **Comprobaciones de salud:** no acreditan éxito de trabajo real.
4. **Filas resumen:** no deben sumarse a los intentos que resumen.

Inspeccionar el esquema y una muestra saneada para identificar estas categorías.
No asumir nombres de campos, tipos, disponibilidad de una CLI ni estados por una
versión anterior. Un valor nulo no demuestra que el evento no haya ocurrido.

## Medición reproducible

- Fijar la ventana temporal y la zona horaria de la fuente.
- Registrar el filtro de intentos, las exclusiones y el denominador.
- Separar éxito, rechazo, límite de cuota y error de servicio; no mezclar salud
  con trabajo ni nombres de agrupaciones con identidades de proveedores.
- Distinguir caché del proveedor de caché local y peticiones de tokens.
- Si ya existe un medidor mantenido y autorizado, revisar su definición y usarlo
  en vez de reimplementar una clasificación distinta.
- Contrastar el total con los grupos y deduplicar por identidad de evento.
- En GitHub, recorrer todas las páginas relevantes y contar issues y PR por
  separado. Una consulta truncada no acredita un total.

## Un ratio sin muestra no es una medida

Publicar siempre el tamaño de la muestra junto al ratio. Si no alcanza el umbral
justificado por el instrumento, informar «muestra insuficiente», no normalidad ni
alarma. Un conteo observado puede seguir siendo útil sin interpretar su tasa.

## Informe público y privado

El informe público puede incluir evidencia reproducible del repositorio y
agregados expresamente autorizados. No trasladar consultas con valores privados,
identificadores del tablero ni detalles de despliegue. El informe operativo queda
en el dominio privado de su responsable.

Distinguir medición ejecutada, inferencia y pendiente. Un estado de PR fusionado
no acredita instalación; una prueba mecánica correcta no acredita aceptación humana.
