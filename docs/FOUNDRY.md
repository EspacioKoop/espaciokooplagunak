# Integración con Foundry VTT y gestión de nave

Este documento define la dirección inicial para usar Espaciokoop Lagunak como simulador operativo de nave dentro de campañas gestionadas con [Foundry Virtual Tabletop](https://foundryvtt.com/), especialmente aventuras de ambientación espacial como *Spelljammer*.

## Estado real

La base técnica de la integración (Fase 2 del roadmap) está **implementada y
verificada en local** (2026-07-12, x86-64):

- Imagen Docker reproducible del servidor headless y `compose.yaml` con red
  interna ([`docker/README.md`](../docker/README.md)).
- Puente con contrato v0 — lecturas seguras y órdenes de lista blanca, sin
  ejecución de Lua arbitrario ([`bridge/README.md`](../bridge/README.md)).
- Verificación end-to-end: `compose up` → `/healthz` → `/v1/state` con datos
  reales del escenario → orden `set_impulse` con efecto observable en la
  simulación → `/exec.lua` inaccesible desde el host.

**Todavía no existe el módulo de Foundry VTT**; el contrato v0 es la base
para construirlo (issue #8). El resto de este documento describe la visión
completa, de la que solo está construida esa base.

## Visión de juego

Foundry conserva personajes, fichas, mapas narrativos, diarios, reglas y estado general de la campaña. Espaciokoop Lagunak ejecuta la vida operativa de la nave: trayectos, navegación, sistemas, recursos, averías, encuentros y coordinación de la tripulación.

El trayecto no será una cuenta atrás pasiva. Durante el viaje, la tripulación podrá:

- fijar destino, rumbo y perfil de velocidad;
- configurar motores, energía, refrigeración y otros sistemas;
- consultar mapas, sensores, posición y tiempo estimado de llegada;
- repartir puestos, permisos, guardias y responsabilidades;
- consumir y gestionar recursos de la nave;
- detectar, diagnosticar y reparar averías;
- reaccionar ante anomalías, encuentros y eventos del director de juego;
- asumir consecuencias persistentes que vuelvan a la campaña de Foundry.

El director de juego podrá pausar o acelerar el tiempo, introducir eventos y decidir cuánto detalle requiere cada trayecto. Así se pueden jugar viajes importantes en tiempo real y resumir desplazamientos rutinarios sin romper la campaña.

## Flujo de una sesión

1. El director de juego inicia en Foundry un trayecto entre dos destinos.
2. El puente prepara un escenario autorizado en Espaciokoop Lagunak.
3. Los jugadores ocupan sus puestos y configuran la nave.
4. La simulación avanza en tiempo real o con el factor temporal definido por el director de juego.
5. El puente envía a Foundry eventos normalizados, nunca código Lua libre.
6. Foundry actualiza diarios, recursos, estados y consecuencias narrativas.
7. La sesión puede interrumpirse y reanudarse sin duplicar eventos.

## Arquitectura propuesta

```text
┌─────────────────────┐       API limitada       ┌──────────────────────┐
│ Módulo Foundry VTT  │ ◄──────────────────────► │ Puente de integración│
│ campaña y narrativa │                           │ auth, reglas, eventos│
└─────────────────────┘                           └──────────┬───────────┘
                                                           │ red privada
                                                           ▼
                                                ┌────────────────────────┐
                                                │ Espaciokoop Lagunak    │
                                                │ simulación autoritativa│
                                                └────────────────────────┘
```

El puente será un proceso separado. De este modo, Foundry y el juego pueden evolucionar de forma independiente, el protocolo puede adaptar versiones y ninguna mesa virtual necesita acceso completo al motor de simulación.

## Autoridad de los datos

| Dominio | Fuente autoritativa |
|---|---|
| Personajes, fichas, diarios y escenas | Foundry VTT |
| Posición, rumbo, velocidad y sistemas de la nave | Espaciokoop Lagunak |
| Inicio de trayecto y contexto narrativo | Foundry VTT / director de juego |
| Resultado táctico y daños simulados | Espaciokoop Lagunak |
| Traducción a consecuencias de campaña | Puente y módulo de Foundry |

Esta separación evita bucles de sincronización donde ambos sistemas intentan sobrescribir el mismo estado.

## Áreas funcionales previstas

### Trayectos y tiempo

- origen, destino, ruta y puntos intermedios;
- duración estimada y progreso real;
- pausa, reanudación y factores de aceleración autorizados;
- eventos programados o disparados por condiciones;
- guardado y reanudación de viajes largos.

### Mapa y navegación

- posición y orientación de la nave;
- cartas o sectores relevantes para la campaña;
- obstáculos, anomalías, contactos y zonas de peligro;
- sensores y calidad de la información según sistemas y puesto;
- rutas alternativas con coste, riesgo y duración diferentes.

### Motores y sistemas

- potencia, empuje, velocidad y maniobra;
- distribución de energía y prioridades;
- temperatura, estrés, daños y eficiencia;
- combustible, carga u otros recursos definidos por la campaña;
- mantenimiento, reparación y consecuencias de operar fuera de límites.

### Tripulación

- puestos y permisos por jugador;
- capitán, navegación, ingeniería, sensores, comunicaciones y armas;
- turnos y guardias durante trayectos prolongados;
- acciones coordinadas y alertas compartidas;
- puestos vacantes asistidos por automatización configurable, sin sustituir decisiones importantes.

### Dirección de juego

- preparar rutas y eventos sin revelar información a los jugadores;
- introducir encuentros, averías, señales o cambios ambientales;
- controlar pausa y aceleración temporal;
- decidir qué resultados alteran fichas, diarios o recursos de Foundry;
- aplicar intervención manual sin romper el estado de la simulación.

## Seguridad obligatoria

La implementación heredada contiene el endpoint HTTP `/exec.lua`, que ejecuta contenido Lua recibido por la red. Estado verificado en vivo (2026-07-12, servidor headless local con `httpserver=<puerto>`):

- `POST /exec.lua` es funcional: ejecuta el cuerpo de la petición en un subentorno Lua y devuelve su `return` como texto, o `{"ERROR": "Script error: ..."}` si el chunk falla (`src/httpScriptAccess.cpp:12-27`).
- `GET /get.lua` y `GET /set.lua` no están implementados: su lógica está comentada dentro de bloques `/*TODO*/` y ambos responden el literal `TODO` (`src/httpScriptAccess.cpp:99` y `:164`).

En consecuencia, hoy **toda** interacción con el API heredado pasa por ejecución de Lua arbitrario vía `/exec.lua` — no existe un canal de solo lectura.

Por tanto:

- `/exec.lua` no se expondrá directamente a Foundry, a una LAN no confiable ni a Internet;
- el puente solo aceptará operaciones incluidas en una lista explícita;
- las credenciales vivirán fuera del repositorio y no llegarán al navegador del jugador;
- los contenedores usarán una red privada y publicarán únicamente los puertos necesarios;
- se aplicarán autenticación, validación de esquema, límites de frecuencia y tamaño, tiempos máximos e idempotencia;
- los registros no incluirán tokens ni contenido sensible de campaña;
- las acciones administrativas tendrán permisos diferenciados para el director de juego.

## Contrato mínimo inicial

Antes de programar el módulo se acordarán eventos y comandos versionados.

### Lecturas

- identidad y versión de la sesión;
- estado de conexión;
- nave y escenario activos;
- posición, rumbo, velocidad y destino;
- motores, energía, casco y sistemas principales;
- progreso del trayecto;
- inicio, progreso y final de encuentros;
- resultado resumido para la campaña.

### Órdenes permitidas

- preparar un escenario incluido en una lista autorizada;
- iniciar, pausar, acelerar o detener una sesión bajo control del director de juego;
- asignar metadatos narrativos al trayecto;
- enviar una orden de nave validada y asociada a un puesto autorizado;
- confirmar que Foundry ha procesado un evento.

La API pública no incluirá ejecución arbitraria de Lua.

## Docker

Docker puede facilitar una instalación reproducible del servidor y del puente, pero no debe ocultar requisitos ni impedir el desarrollo nativo.

La primera composición prevista tendrá:

- servicio de Espaciokoop Lagunak en modo servidor o sin interfaz, si se valida que upstream lo soporta correctamente;
- servicio puente;
- red interna entre ambos;
- puerto del puente publicado solo donde sea necesario;
- volúmenes explícitos para configuración, guardados o escenarios propios;
- comprobaciones de salud y cierre ordenado;
- versiones fijadas, sin imágenes flotantes para despliegues estables.

Foundry VTT no se incluirá ni redistribuirá en este repositorio. Es software con licencia propia y se conectará como sistema externo.

## Primera prueba vertical

La primera integración debe demostrar valor sin intentar cubrir toda una campaña:

1. Arrancar una sesión reproducible de Espaciokoop Lagunak.
2. Obtener mediante el puente un estado de nave seguro.
3. Mostrar en Foundry posición, rumbo, velocidad, motores y estado general.
4. Iniciar desde el director de juego un trayecto corto autorizado.
5. Permitir a dos puestos modificar navegación y energía.
6. Introducir una avería o encuentro controlado.
7. Recibir el final del trayecto y escribir un resumen en un diario de Foundry.
8. Cortar la conexión y comprobar la reconexión sin repetir eventos.

## Decisiones pendientes

- versión mínima y máxima de Foundry VTT;
- sistema y versión usados para la campaña de *Spelljammer*;
- capacidades reales del modo servidor o sin interfaz de EmptyEpsilon;
- escala temporal y reglas de aceleración;
- modelo de motores, combustible, energía y recursos;
- protocolo entre puente y Foundry: HTTP con eventos, WebSocket o ambos;
- autenticación para red local y posibles despliegues remotos;
- persistencia, copias de seguridad y migraciones del estado de viaje.

Estas decisiones se resolverán mediante issues antes de fijar una API estable.
