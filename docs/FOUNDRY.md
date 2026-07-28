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

**El módulo de Foundry VTT ya cubre al director de juego y una primera capa de
tripulación**: muestra el estado en vivo vía polling, permite anotarlo en un
diario, ofrece controles GM cerrados de tempo, reposición, ingeniería y
maniobra, y permite asignar puestos con espacios operativos propios: cada
tripulante emite las órdenes de su puesto, que un relé del GM ejecuta contra
el puente (#162, #176, #216, #236/#238/#240; ver «Permisos por puesto» abajo).
Instalación, configuración y estado de verificación en
[`foundry-module/README.md`](../foundry-module/README.md). Existe evidencia
humana positiva en v11.302 y en un host moderno, pero la matriz completa de
versión, consola limpia y ausencia de secretos sigue abierta en #29; la licencia
de Foundry impide cubrirla en CI. El resto de este documento describe la visión
completa, de la que está construida esa base.

El transporte del contrato v0 queda fijado en **polling HTTP** (issue #6). El
primer evento vertical es la llegada de «Primera Guardia»: el escenario crea
un marcador interno acotado, el puente lo normaliza en `GET /v1/events` y el
módulo lo escribe una sola vez en Journal mediante un `eventId` persistente.
WebSocket queda aplazado hasta que haya una necesidad de latencia medida.

El trayecto inicial publica Argia como destino mediante un marcador interno de
la sesión. `/v1/state` calcula distancia restante y ETA a partir de la posición
y velocidad reales; la ETA es nula cuando la nave está detenida. El módulo
formatea estos datos para el GM sin asumir que otros escenarios tengan ruta.

El control de tempo inicial es binario: `pauseGame()` / `unpauseGame()` son las
únicas APIs verificadas en headless. No se ofrece aceleración ni se inventa un
estado consultable porque `setGameSpeed`, `getGameSpeed` y un getter de pausa no
existen en la API Lua observada.

### Superficies de control del GM

La ventana **Estado de nave** del módulo agrupa las órdenes cerradas que el GM
puede dar desde Foundry. Todas son **solo-GM**, viven en las dos rutas aisladas
del módulo (ApplicationV2 y la clásica de v11) y revalidan rol y revocación tras
cada llamada de red. La tripulación no usa estas superficies: emite las órdenes
de su puesto por un relé aparte (ver «Permisos por puesto» abajo).

- **Tempo** — pausa/reanudación de extremo a extremo (integrado; #34/#125). La
  aceleración temporal queda fuera por falta de API del juego.
- **Reposición** — recolocar la nave junto a un ancla de un catálogo cerrado que
  el puente publica en `/v1/anchors`; el escenario es dueño de la coordenada
  exacta. Una orden aceptada vuelve como evento `ship_repositioned` y se anota
  una sola vez en Journal con ancla y tiempo de escenario (#176/#202/#223).
- **Ingeniería** — repartir energía (`set_system_power`) por sistema y leer
  `health`/`heat`/`power`/`coolant` y `repair_crew` de `/v1/state`. No sustituye
  la reparación de la tripulación en EmptyEpsilon; la observa (integrado en
  PR #217, issue #216). El panel del GM solo reparte energía; el **refrigerante**
  (`set_system_coolant`, 0..10 por sistema) es una orden del **puesto de
  ingeniería** de la tripulación, no del GM (ver «Permisos por puesto»; #301).
- **Órdenes directas** — impulso, warp, rumbo (8 puntos de brújula) y escudos:
  las cuatro órdenes de nave que el puente ya autoriza, para dirigir la nave sin
  pasar por los puestos (integrado en PR #218, issue #176).
- **Encuentros** — inyectar un objeto de un catálogo cerrado de arquetipos:
  `derelict`, `patrol`, `freighter`, `sentry`. Foundry elige el arquetipo; el
  escenario decide plantilla, facción, posición y orden de IA. Nunca se aceptan
  coordenadas (#117; catálogo ampliado en PR #220, UI en PR #201).

### Permisos por puesto de tripulación

Cada tripulante emite **solo** las órdenes de su puesto, y lo hace **sin poseer
el token del puente**. El permiso se gatea en el **relé de Foundry**, no en el
token:

- **Doctrina de telemetría** (#331). La telemetría de la **nave propia** se
  difunde a toda la tripulación; lo que permanece cerrado es lo que el GM autora.
  El GM sigue siendo el único que habla con el puente —el Bearer no sale de su
  navegador y ningún cliente de jugador lee el ajuste del token ni ejecuta un
  `fetch` contra él— y reparte por socket el `statePayload` que ya sondeaba
  (`telemetria-difusion.mjs`). Se transporta por socket y **no** por ajuste de
  mundo: un `/v1/state` por sondeo persistido sería escritura continua en la base
  de datos de la campaña, y la pérdida al recargar la repara el siguiente tick.
  La razón de fondo es que «quién puede **pedir** el dato» y «quién puede
  **leerlo**» son preguntas distintas: en el EmptyEpsilon del que esto es fork,
  cada pantalla de tripulación ve casco, energía y sistemas, así que ocultarlo
  aquí era un peor producto a cambio de cero seguridad. **Los contactos son la
  excepción** y siguen siendo recurso del GM: callsign, facción y coordenadas
  exactas son lo que el sistema de sensores debe decidir cuánto revela, y se
  abrirán degradados por distancia y salud de sensores.
- **Lazo cerrado de la orden** (#331 paso 2, `acuse-orden.mjs`). Cada orden
  vuelve a **la consola que la emitió**, y a ninguna otra: el relé ya recibía el
  resultado del puente con el `userId` del emisor y hasta ahora se descartaba. La
  consola enseña «ordenado 090 / real 073», con lo pedido sacado del acuse del GM
  y lo real de la telemetría —por eso este paso depende de la apertura de
  telemetría: sin ella, la mitad derecha del delta no existiría para quien la
  necesita—. El rumbo se compara por el **arco corto**: 359 y 001 distan dos
  grados, y compararlos a lo bruto marcaría como desobediente a una nave ya en
  rumbo justo al cruzar el norte. **Impulso y warp no tienen lectura real**
  porque `/v1/state` no los publica; la consola lo dice en vez de enseñar como
  «real» el mismo número que se acaba de pedir.
- **Identidad de usuario no falsificable** (#237). El tripulante escribe la orden
  en su propio flag de usuario (`emitWorkspaceOrder`); el GM la recoge en el hook
  `updateUser`. El puesto **nunca** se declara en la orden: el GM lo resuelve
  desde el `User` autenticado que emitió el cambio e ignora cualquier
  `userId`/`station` embebido. Esto impide suplantar a otro usuario, pero no
  convierte el puesto en un rol fijo: cada jugador puede cambiar el flag
  `station` de su propio `User`. Foundry persiste ese flag, pero su valor es un
  contexto operativo mutable, no identidad ni credencial. La garantía actual es
  «acción permitida para el puesto que declara ahora el usuario autenticado»;
  un puesto impuesto por el GM requeriría restringir aparte esa autoasignación.
  Esta descripción documenta el comportamiento vigente, no decide si una versión
  futura conservará la autoasignación o exigirá aprobación del GM.
- **Matriz de autoridad cerrada** (`station-actions.mjs`, `STATION_ACTIONS`).
  Declara qué órdenes del whitelist del puente puede emitir cada puesto:
  `navigation` → `set_target_heading`, `set_impulse`, `set_warp`; `engineering`
  → `set_system_power`, `set_system_coolant`; `weapons` → `set_shields`.
  `captain`, `sensors` y
  `communications` son de **observación/narrativa**: no emiten órdenes de control
  de nave (coherente con el género bridge-sim; ratificado en #268). Añadir una
  acción exige que el puente ya la autorice y que el puesto la necesite.
- **Degradación explícita.** Un puesto desconocido o una acción no permitida se
  rechazan con un error tipado (`UNKNOWN_STATION` / `ACTION_NOT_ALLOWED`), nunca
  en silencio; la UI oculta de antemano los controles que el puesto no puede
  emitir (`isActionAllowed`).

**El token del puente sigue siendo grano grueso por diseño.** El permiso por
puesto se aplica en el relé del cliente GM a partir del `User` cuyo cambio
autorizó Foundry; no fortalece el Bearer ante el puente. El Bearer autoriza
*todo* el whitelist a quien lo tenga (hoy, solo el GM). Un token filtrado no gana
permisos por puesto, pero sí podría emitir cualquier orden del whitelist: por eso
el token es solo-GM y su modelo de amenaza vive en
[`bridge/README.md`](../bridge/README.md). Afinar el grano en el propio puente
sería una decisión aparte, con su ADR.

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

### Música de a bordo

Ambiente sonoro **sintetizado en cada navegador** a partir de una semilla de
mundo (#344, #347). No hay ficheros de audio en el repositorio ni audio viajando
por la red: cada cliente genera las mismas notas con la misma semilla, así que
toda la mesa oye lo mismo sin sincronizar nada.

- **Automático** por defecto: el registro lo deriva el nivel de alerta (#338) —
  cotidianidad frente a tensión.
- **El GM manda** cuando quiere: el botón «cambiar la música» del grupo de
  controles Lagunak cicla entre automático, los seis registros y el silencio.
  La alerta sabe si el casco está roto, pero no sabe si el momento es solemne,
  ridículo o tierno; eso lo lee el GM.
- **El audio lo habilita cada cliente**, con el botón de auriculares que ven
  todos: los navegadores exigen un gesto del usuario y ese gesto no se puede
  delegar en el GM.
- Un registro desconocido en el ajuste **falla cerrado** y vuelve al automático.

Módulos: `musica-procedural.mjs` (qué notas), `musica-mando.mjs` (quién decide),
`musica-reproductor.mjs` (cómo suena).

### Frontera de estilo: vivo frente a registrado

El módulo genera dos artes en el cliente y comparten disciplina —ninguna usa
degradado, las dos van sobre papel oscuro—, así que conviven sin parecer un
descuido: son una imprenta y un CRT en la misma sala. La frontera es una
pregunta, no una lista de superficies:

> **Grabado** (`TINTA`) para lo que **persiste o enmarca**. **Pixelart**
> (`PIXEL`) para lo que **se repinta con telemetría**.

Cartelas, fichas, códice y el marco cartográfico del mapa son grabado. Sprites
de nave, barras, iconos de sistema, retratos y naipes son pixel.

El eje **no** es «diegético frente a papel», que fue el primer intento: con esa
regla el marco de grabado que envuelve el lienzo de píxeles del mapa vivo sería
una infracción, cuando es justo lo correcto —el marco es la carta, el interior
es la verdad que cambia en cada sondeo—. Formulada como vivo/registrado predice
bien los casos que vienen: la cartela de una lámina impresa es grabado aunque
cuelgue de una consola, y una barra que sigue a `/v1/state` es pixel aunque viva
dentro de un diario.

Los colores viven en `paleta.mjs` y **solo** ahí: una prueba falla si un módulo
de arte declara un color propio —hexadecimal con cualquier comilla, o `rgb()` y
`hsl()`—. La guardia cubre hoy las láminas, el sprite de nave, los naipes y la
paleta de facciones del mapa vivo; `decorado-fondo.mjs` y `mapa-render.mjs`
quedan fuera a la espera de decidir si sus catálogos (tipos de planeta,
nebulosas, tonos de lienzo) son paleta compartida o dato de decorado. Sin eso la regla sería prosa, y el cuarto
módulo volvería a inventarse su propio sepia. Ese módulo también trae el cálculo
de contraste de WCAG, con los pares que portan información verificados en la
suite (#351).

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

**Alcance v0 — una sola nave de jugador.** El contrato v0 asume una única nave
(la nave de la party), que es el modelo de una mesa de *Spelljammer*. El puente
opera sobre `getPlayerShip(-1)`; escenarios con varias `PlayerSpaceship` (flota o
PvP) quedan fuera de contrato v0. Esto es una decisión de alcance deliberada, no
una limitación a resolver.

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

- capacidades reales del modo servidor o sin interfaz de EmptyEpsilon;
- escala temporal y reglas de aceleración;
- autenticación para red local y posibles despliegues remotos;
- persistencia, copias de seguridad y migraciones del estado de viaje.

Estas decisiones se resolverán mediante issues antes de fijar una API estable.

### Resuelta: pausa de Foundry y pausa del simulador (issue #125)

- **No se sincronizan automáticamente en ninguna dirección.** La pausa del
  simulador (`pauseGame()`/`unpauseGame()`) es del simulador; `game.paused`
  de Foundry es de Foundry. Cualquier sincronización automática crearía el
  bucle clásico (Foundry pausa → puente pausa → sondeo detecta pausa →
  Foundry reacciona…) y reintentos ante fallos parciales.
- **Autoridad**: el simulador es la única fuente de verdad de su propia
  pausa. El módulo la lee confirmada del puente (`paused` en `/v1/scenario`)
  y solo la cambia mediante la orden explícita del GM (`set_pause`), una
  orden en vuelo cada vez.
- **UI**: la ventana de estado muestra el estado confirmado (`en marcha`,
  `pausando`, `pausado`, `reanudando`, error, desconexión), deshabilita la
  acción imposible y, si Foundry está además en pausa, lo indica como dato
  informativo independiente. Si el GM quiere pausar «todo», ejecuta ambas
  pausas a mano: son dos actos deliberados, no un acoplamiento.

### Resuelta: motores, combustible, energía y recursos (issue #80)

- **La energía de EmptyEpsilon es el recurso consumible v0**: la batería del
  reactor (`energy`/`energy_max` en `/v1/state`) ya se drena con warp, salto y
  sistemas. No se inventa un «combustible» paralelo mientras ninguna mesa haya
  sentido su falta.
- Si una campaña exige un recurso distinto de la batería, su hogar será
  **estado del escenario Lua** (un contador que el escenario posee y publica) —
  nunca del puente (traduce, no posee estado) ni de Foundry (no manda sobre la
  verdad de la nave).
- **Las averías son la palanca narrativa del GM**: la orden de lista blanca
  `set_system_health` inflige o revierte una avería desde Foundry. La
  **reparación es de la tripulación** en su estación real de ingeniería; el GM
  la observa por `/v1/state` (`health`, `coolant` por sistema y `repair_crew`).
  No habrá botón de «reparar» en Foundry.
- **Los encuentros son la otra mitad de esa palanca** (#117): `spawn_encounter`
  pide un arquetipo de catálogo cerrado (hoy `derelict`) con un rumbo grueso
  opcional; el escenario, dueño del *cómo*, publica el callback
  `spawnEncounter` bajo el namespace `espaciokoop_lagunak` de
  `getScriptStorage()`. Si el escenario no lo publica, la orden degrada a
  `not_supported`. Foundry jamás envía coordenadas ni definiciones de objeto:
  sería doble autoridad sobre la verdad de la nave. Cuando el escenario crea
  el encuentro, publica además `encounter_started` en `/v1/events` con un ID
  estable de sesión y secuencia monotónica; la escritura deduplicada en Journal
  sigue pendiente de la rebanada de módulo de #117.
- El contrato del puente ya autoriza energía (`set_system_power`) y refrigerante
  (`set_system_coolant`) por sistema; su encaminamiento a un **puesto** concreto
  de jugador depende de la matriz de autoridad por puesto (relé de órdenes
  tripulante→GM→puente, #236 y siguientes).
