# Puente Espaciokoop Lagunak ↔ Foundry VTT

Servicio HTTP que expone un contrato **cerrado y versionado** sobre el
servidor headless. Es la única pieza autorizada a hablar con el endpoint
heredado `/exec.lua` (que ejecuta Lua arbitrario): todo el Lua vive en
`app.py`, y las entradas del cliente solo rellenan valores tipados,
validados y acotados. **Nunca se reenvía Lua recibido por la red.**

Diseño completo: [`docs/FOUNDRY.md`](../docs/FOUNDRY.md) · Inventario del API
heredado: [`docs/seguridad/API_HTTP.md`](../docs/seguridad/API_HTTP.md).

## Decisiones de arquitectura

El [registro ADR](../docs/adr/README.md) conserva el contexto y las consecuencias
de las decisiones que delimitan este puente:

- [ADR-0001](../docs/adr/0001-exec-lua-nunca-expuesto.md): `/exec.lua` nunca
  se expone; el puente es su único cliente y aplica autenticación Bearer, CORS
  estricto, límites y una lista blanca de operaciones.
- [ADR-0002](../docs/adr/0002-autoridad-de-datos-foundry-vs-simulacion.md):
  Foundry gobierna la narrativa y la simulación gobierna el estado de la nave.
- [ADR-0003](../docs/adr/0003-transporte-polling-http.md): el contrato v0 usa
  polling HTTP; WebSocket queda aplazado hasta disponer de métricas que lo
  justifiquen.
- [ADR-0007](../docs/adr/0007-frontera-upstream.md): los arreglos del código
  heredado se proponen primero a upstream para limitar divergencias permanentes.

## Garantías de seguridad que no deben retroceder

Estas garantías describen el **contrato implementado y comprobable** del puente,
no una certificación OWASP ASVS ni una promesa de que pueda publicarse en
Internet. El [modelo de amenazas](../docs/seguridad/BRIDGE_THREAT_MODEL.md) documenta los
actores, riesgos residuales y cambios que requieren revisión adversarial.

| Garantía | Control vigente | Límite explícito |
|---|---|---|
| El cliente no puede aportar Lua para ejecutar | `/v1/command` acepta una unión discriminada de operaciones tipadas; cada modelo genera una plantilla Lua propiedad del servidor | `bridge/app.py` sigue siendo código privilegiado: una plantilla nueva exige review de seguridad |
| `/exec.lua` no es accesible desde el cliente | El puerto heredado permanece en la red interna de Compose y una guardia CI rechaza su publicación | Un cambio de red, `network_mode: host` o acceso alternativo al puerto 8080 rompe la garantía |
| Toda ruta `/v1/*` exige autenticación | Dependencia Bearer común y comparación en tiempo constante; sin `BRIDGE_TOKEN` el puente falla cerrado con `503` | `/healthz` y `/docs` son públicos; el Bearer es compartido y no acredita identidad ni rol de Foundry |
| Solo se admiten órdenes y valores cerrados | Discriminador `op`, enums, tipos estrictos y rangos Pydantic; operación o forma desconocida devuelve `422` | No hay passthrough genérico; ampliar un enum, campo u operación amplía la superficie autorizada |
| Los cuerpos mutables están acotados antes del parseo | Middleware ASGI rechaza con `413` cuerpos mayores de 16 KiB, tanto por `Content-Length` como por transferencia fragmentada | El límite no sustituye cuotas por cliente ni los límites de cabeceras y conexión del servidor o proxy |
| La espera y la respuesta del juego están acotadas en el puente | Timeout HTTP de 5 s y rechazo de respuestas heredadas mayores de 64 KiB | El timeout limita cuánto espera el puente, pero no garantiza cancelar un script que el juego ya haya empezado |
| El sondeo no puede crecer sin límite por frecuencia | Token bucket global de 10 peticiones/s con ráfaga de 20 | Es un límite en memoria y por proceso, no sustituye límites del proxy ni aislamiento operativo |
| Los fallos del juego no filtran su cuerpo al cliente | Estados no válidos, JSON malformado, exceso de tamaño y errores Lua se traducen a `502` genérico | Logs y proxies externos deben conservar la misma política de redacción |
| CORS solo permite orígenes web exactos configurados | Allowlist HTTP(S), sin `*`, credenciales embebidas, rutas, query ni fragmentos | CORS no autentica, no protege clientes no navegador y no sustituye TLS |

Las regresiones de `bridge/tests/` cubren autenticación, CORS, rate limit,
traducción de respuestas heredadas, lista blanca, rangos, límite de cuerpos e
intentos de inyección. Un cambio que altere una fila debe actualizar también sus
pruebas y el modelo de amenazas.

## Contrato v0

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/healthz` | No | Estado del puente y alcance del juego |
| GET | `/v1/state` | Bearer | Nave: posición, rumbo, velocidad, destino, distancia, ETA, casco, energía, escudos y sistemas |
| GET | `/v1/scenario` | Bearer | Tiempo de escenario y estado de pausa (`paused`) |
| GET | `/v1/events` | Bearer | Eventos normalizados presentes: llegada, inicio de encuentro y reposición GM en Primera Guardia |
| GET | `/v1/contacts` | Bearer | Objetos cercanos a la nave (indicativo, posición, facción, plantilla, clase/subclase opcionales y si es el jugador) para un mapa vivo en Foundry. **Vista GM omnisciente** (ver abajo) |
| GET | `/v1/encounters` | Bearer | Catálogo cerrado de encuentros del GM (`archetypes` y `bearings` que acepta `spawn_encounter`); estático, sin llamada al juego |
| POST | `/v1/command` | Bearer | Órdenes de lista blanca (ver abajo) |
| GET | `/docs` | No* | OpenAPI interactiva generada por FastAPI |

\* La documentación no expone datos de partida; los endpoints que lista sí requieren token.

**Supuesto de una sola nave (v0).** Todo el Lua del puente opera sobre
`getPlayerShip(-1)` — «la nave de la party», que es exactamente el modelo de una
mesa de *Spelljammer* (una tripulación, un spelljammer). Cargar un escenario con
varios `PlayerSpaceship` deja a `-1` eligiendo una nave arbitraria y queda
**fuera de contrato v0**: el indexado multi-nave (flota o PvP) no es un objetivo
de esta integración.

**`/v1/contacts` es una vista GM omnisciente, no de sensores.** Publica
indicativo y facción de todo objeto en radio (30 000 U) **sin filtrar por
detección ni identificación** (`isScannedBy` / niveles de escaneo). Es una
decisión explícita: la consume la ventana de mapa vivo del módulo de Foundry,
que es solo-GM, detrás del Bearer que solo tiene el GM. **No debe reutilizarse
como contrato para jugadores** sin añadir ese filtrado — sería revelar en la
mesa lo que la ciencia de a bordo aún no ha escaneado. La respuesta devuelve
los **60 contactos más cercanos ordenados por distancia** (el jugador siempre
incluido, encabezando la lista) y declara el truncamiento:
`{"contacts": […], "truncated": true|false, "total": N}` — `total` es cuántos
objetos había realmente en radio.
Cada contacto incluye `type` (nombre estable de plantilla cuando existe) y
`class`/`subclass` cuando la plantilla publica el componente `docking_port`;
objetos sin esos componentes devuelven `null`, nunca valores inventados.

### Base de datos científica (`GET /v1/database`)

Consulta, no orden (#520): el árbol de fichas que la pantalla nativa de Science
deja mirar. **Recurso propio y no un campo de `/v1/state`** porque son cosas de
ritmo distinto —el estado se sondea cada pocos segundos y describe lo que
cambia; esto es contenido de referencia casi inmóvil y mucho más grande—, así
que meterlo en el estado haría que cada ciclo reenviara siempre lo mismo.

Cada entrada lleva `id`, `name`, `parent`, `description` y `values`. **El `id` es
la ruta de nombres** (`"Naves/Exuari/Cazador"`): el juego no da uno estable, y la
ruta es además cómo se navega el árbol en la pantalla nativa. Una entrada sin
nombre no tiene ruta y se descarta entera en vez de colarse con un id inventado.

Dos cotas y un tope: 400 entradas, 24 pares por entrada y 16 saltos de
profundidad al subir por `parent`. El último no es decorativo: un `parent` en
ciclo colgaría el juego **dentro** de `/exec.lua`, y el puente solo vería un
timeout. El truncamiento se declara (`truncated`, `total`) en vez de
disimularse.

`/v1/state` publica además `science_link: {callsign, position}` cuando hay una
sonda enlazada al radar de ciencia. Con eso, la vista de sonda de Foundry hace
lo mismo que la nativa: recentra la lectura en la sonda **conservando los
alcances de la nave** (`scienceScreen.cpp`), sin inventarle a la sonda un
alcance propio que el juego no le da.

### Órdenes permitidas (`POST /v1/command`)

```json
{"op": "set_impulse",        "value": 0.5}
{"op": "set_warp",           "level": 2}
{"op": "set_target_heading", "heading": 90.0}
{"op": "set_shields",        "active": true}
{"op": "set_system_power",   "system": "impulse", "level": 1.5}
{"op": "set_system_health",  "system": "impulse", "value": -0.75}
{"op": "spawn_encounter",    "archetype": "derelict", "bearing": "port"}
{"op": "reposition_ship",    "anchor": "argia"}
{"op": "set_pause",          "paused": true}
{"op": "set_auto_repair",    "enabled": true}
{"op": "answer_comm_hail",   "accept": true}
{"op": "close_comm"}
{"op": "send_comm_reply",    "index": 0}
{"op": "send_comm_message",  "message": "Requesting permission to dock."}
{"op": "set_system_coolant", "system": "impulse", "level": 7.5}
{"op": "scan_object",        "callsign": "Lapur 1"}
{"op": "set_weapon_target",  "callsign": "Lapur 1"}
{"op": "fire_tube",          "callsign": "Lapur 1", "index": 0}
{"op": "combat_maneuver_boost",  "amount": 1.0}
{"op": "combat_maneuver_strafe", "amount": -0.5}
{"op": "dock",               "callsign": "Argia"}
{"op": "undock"}
{"op": "abort_dock"}
{"op": "activate_self_destruct"}
{"op": "cancel_self_destruct"}
{"op": "confirm_self_destruct_code", "index": 1, "code": 4321}
{"op": "set_shield_frequency",       "frequency": 12}
```

Las cuatro que siguen a `send_comm_message` ya existían y faltaban en esta
lista; se añaden para que la enumeración vuelva a ser el whitelist completo y no
{"op": "add_waypoint",       "x": 1200.5, "y": -800.0}
{"op": "move_waypoint",      "index": 2, "x": 0.0, "y": 15.2}
{"op": "remove_waypoint",    "index": 0}
{"op": "launch_probe",       "x": -2500.0, "y": 900.0}
{"op": "set_science_link",   "callsign": "P-1"}
{"op": "clear_science_link"}
{"op": "set_alert_level",    "level": "yellow"}
```

Las cuatro primeras de la segunda mitad ya existían y faltaban en esta lista;
se añaden aquí para que la enumeración vuelva a ser el whitelist completo y no
un subconjunto que envejece en silencio.
{"op": "move_repair_crew",   "origin": {"x": 1, "y": 2}, "destination": {"x": 3, "y": 4}}
```

Las cuatro que siguen a `send_comm_message` ya existían y faltaban en esta
lista; se añaden para que la enumeración vuelva a ser el whitelist completo.

**`set_system_health` es la palanca de avería del GM**, no un panel de
ingeniería: escribe la salud real de un sistema (rango del juego `-1.0..1.0`;
bajo `0.0` el sistema queda inutilizado) para infligir una avería como
encuentro narrativo — o revertirla. La reparación normal sigue siendo trabajo
de la tripulación en su estación de ingeniería; el GM la *observa* por
`/v1/state`, que publica `coolant` por sistema y `repair_crew` global además
de `health`/`heat`/`power`.

**`spawn_encounter` es la mitad «encuentros» de esa misma palanca** (#117):
Foundry decide el *qué* (un arquetipo de catálogo cerrado) y el escenario decide
el *cómo* (plantilla, posición exacta, facción, estado, orden de IA). El catálogo
admitido hoy es `derelict` (pecio civil averiado y quieto), `patrol` (cazador
Exuari hostil en ronda), `freighter` (mercante neutral), `sentry` (plataforma de
defensa hostil que guarda su posición) y `ambush` (la crisis multipuesto de #484:
un convoy de tres contactos idénticos con un buque trampa entre ellos, cuya
resolución correcta exige comunicaciones, sensores y armas en cadena — ver
`docs/CRISIS_MULTIPUESTO.md`). Un arquetipo que el puente conoce pero el
escenario cargado no honra degrada a `not_supported`, nunca inventa un objeto.
`bearing` es opcional (`ahead`/`astern`/`port`/`starboard`), un rumbo grueso
relativo a la nave que el escenario puede honrar laxamente — **nunca se aceptan
coordenadas**:
cualquier campo extra rechaza la orden entera (`422`). El Lua emitido es fijo y
solo llama al callback `spawnEncounter(archetype, bearing)` que el escenario
publica bajo el namespace propio `espaciokoop_lagunak` de `getScriptStorage()`;
si el escenario cargado no lo registra, la respuesta degrada a
`{"ok":false,"reason":"not_supported"}`. El contacto nuevo aparece por
`/v1/contacts` y en las estaciones de ciencia/relay de la tripulación. El
catálogo admitido se publica en `GET /v1/encounters` desde los mismos enums
que validan la orden: el módulo de Foundry lo lee de ahí y no hardcodea
arquetipos. Tras crear uno, `/v1/events` publica un DTO cerrado
`encounter_started` con ID estable de sesión y secuencia monotónica para que
Foundry pueda deduplicarlo.

**`reposition_ship` publica confirmación observable, no solo un ACK.** Una
orden aceptada crea un marcador interno que `/v1/events` normaliza como
`ship_repositioned`. Su `eventId` incorpora la sesión, una secuencia monotónica,
el ancla del catálogo (`lagunak` o `argia`) y el tiempo de escenario en décimas.
La secuencia admite `000001`..`999999` por sesión; una orden posterior se
rechaza antes de mover la nave para no aceptar una reposición sin evento.
Los nombres fuera del catálogo y los marcadores malformados se ignoran; una
orden `not_supported`, `no_ship` o rechazada no publica evento. El DTO no
contiene coordenadas, URL, token ni cabeceras.

**El bloque de navegación (#519) traduce agencia nativa que ya existía**: las
cinco órdenes llaman a globales que el motor ya registraba
(`commandCombatManeuverBoost`, `commandCombatManeuverStrafe`, `commandDock`,
`commandUndock`, `commandAbortDock`), sin una línea de C++ nueva.

- La **maniobra de combate** tiene dos ejes con rangos distintos a propósito:
  el empuje va `0..1` (el eje del control nativo solo va hacia adelante; un
  negativo es una errata, no marcha atrás) y el lateral `-1..1`, donde el signo
  es información (babor/estribor). Gasta una carga que se rellena sola; el
  puente no la contabiliza, la **publica**: `/v1/state` incluye ahora
  `combat_maneuver.charge` leído de `combat_maneuvering_thrusters`. Sin
  componente el campo es `null` — que no es lo mismo que `0.0`, y el consumidor
  no debe colapsarlos: uno dice "no sé si puedes maniobrar" y el otro "no
  puedes".
- **`undock` y `abort_dock` no son sinónimos**: el primero suelta un atraque
  consumado (estado `docked`), el segundo cancela el acercamiento (estado
  `docking`). `/v1/state` publica cuál de los dos hay.
- `dock` referencia el objetivo por indicativo, con el mismo campo validado y la
  misma búsqueda en Lua fijo que `scan_object`.
**La autodestrucción (#518) es cooperativa porque el motor la hizo así**, no
porque el fork añada ceremonia: armarla no destruye nada, genera tres códigos
(`SelfDestruct::max_codes`) y el juego reparte cada uno a una posición de
tripulación distinta. Solo se puede desarmar antes de que arranque la cuenta.

**El puente no conoce los códigos y no puede conocerlos.** El componente expone
a Lua `active`, `countdown`, `damage` y `size`, pero **no** `code` ni
`confirmed` (`src/script/components.cpp`). Eso no es un obstáculo a rodear: es
lo que mantiene el puzle en pie. Quien teclea un código en
`confirm_self_destruct_code` ha tenido que leerlo en la pantalla nativa que se
lo mostró, o habérselo oído a quien lo leyó; el motor comprueba que case con su
índice. Hay una prueba que afirma esa ausencia en el binding, para que el día
que upstream la cambie sea una decisión y no una fuga.

`/v1/state` publica en consecuencia solo `self_destruct: {active, countdown}`
—y `countdown` únicamente con la secuencia armada, porque sin armar el campo del
motor no significa "cero segundos para estallar"— más
`shield_calibration: {frequency, calibration_delay}`. Una frecuencia de `-1`
significa "estos escudos no tienen frecuencia" y se publica como `null`, nunca
como el número.

`set_shield_frequency` acepta 0..20 (`BeamWeaponSys::max_frequency`).
Recalibrar **deja los escudos caídos** mientras dura: es una decisión de
momento, no un ajuste.
**El bloque de Relay (#517) traduce agencia nativa que ya existía**, no inventa
capacidades: las siete órdenes llaman a globales que el motor ya registraba
(`commandAddWaypoint`, `commandMoveWaypoint`, `commandRemoveWaypoint`,
`commandLaunchProbe`, `commandSetScienceLink`, `commandClearScienceLink`,
`commandSetAlertLevel`), así que no hay una línea de C++ nueva. Detalles del
contrato:

- Las coordenadas de `add_waypoint`/`move_waypoint`/`launch_probe` **no son la
  reposición de nave que ADR-0002 prohíbe pedir con coordenadas crudas**: son
  marcas que el tripulante coloca sobre su propio radar y no tocan la posición
  de la nave. Van acotadas a ±500 000 y deben ser finitas (`inf`/`NaN` se
  rechazan: formateados con `%.1f` producirían Lua que no compila).
- `set_science_link` referencia la sonda **por indicativo**, con el mismo campo
  validado y la misma búsqueda en Lua fijo que `scan_object`; el puente nunca
  acepta entidades del cliente. Si el indicativo no es una sonda, el motor
  ignora el enlace — el puente no distingue tipos de objeto y no finge que sí.
- `set_alert_level` acepta exactamente `normal`, `yellow` o `red`. El catálogo
  es cerrado con más motivo que en otras órdenes: `Convert<AlertLevel>::fromLua`
  llama a `luaL_error` ante un valor desconocido, así que una errata del cliente
  tiene que morir en la validación y no en el juego.

Estas órdenes existen ya en el contrato del puente, pero **la tripulación
todavía no puede emitirlas desde Foundry**: el puesto `relay` no está en la
matriz de autoridad del módulo. Esa mitad es el resto de #517.

**`/v1/state` publica dos lecturas nuevas para Relay (#517)**, ambas desde
componentes que ya exponían el dato a Lua y por tanto sin C++ nuevo:

- `alert_level` — la condición **declarada** por la tripulación
  (`player_control.alert_level`), normalizada a los mismos `normal`/`yellow`/
  `red` que acepta la orden `set_alert_level`, para que el vocabulario del
  contrato sea uno solo en las dos direcciones. Un valor que no se reconozca es
  `null` y **nunca** `normal`: caer a "normal" diría que la nave está tranquila
  justo cuando no se sabe si lo está.
- `probes` — `{stock, max}` del lanzador de sondas. Se publican los dos porque
  "quedan 3" sin saber de cuántas es media frase. Aquí `0` es una lectura
  legítima (se han gastado) y se distingue de `null` (no hay lanzador).
**`move_repair_crew` no necesitó C++ nuevo** (#522), en contra de lo que suponía
su issue. `commandCrewSetTargetPosition` no está expuesto a Lua, cierto — pero el
componente `internal_crew` expone `target_position` **con setter**
(`BIND_MEMBER` en `src/script/components.cpp`), así que el Lua fijo del servidor
escribe el destino directamente. Esa escritura es además la autoritativa: el
comando existe para que un *cliente* se lo pida al servidor, y el puente ya está
dentro del servidor.

**El equipo se identifica por dónde está, no por un índice.** El orden en que el
motor devuelve las entidades no está garantizado, así que un índice podría
referirse a otro equipo entre dos sondeos — y mover al equivocado en mitad de una
avería es peor que no mover a ninguno. Si en `origin` ya no hay equipo, la
respuesta es `crew_not_found` en vez de acertarle a otro. La búsqueda además
filtra por `ic.ship == ship`: nunca se toca el equipo de otra nave.

Lo que se fija es el **destino**; que el equipo llegue —puertas, ruta, tiempo— lo
resuelve la simulación. Ese es justo el contraste con el hackeo (ADR-0010): aquí
el servidor sí resuelve el efecto, y por eso esta orden sí pertenece al whitelist.

`/v1/state` publica en consecuencia `internal: {rooms, crews}` con la **planta
real** del motor: cada sala con posición, tamaño y sistema, y cada equipo con su
casilla y su destino. Sin salas se publica `null` — una nave sin interior no es
una nave con cero salas.

Cualquier otra operación devuelve `422`. Añadir una orden nueva implica
añadir un modelo validado en `app.py` y documentarla aquí — nunca un
passthrough genérico.

## Seguridad aplicada

- Bearer token obligatorio (`BRIDGE_TOKEN`), comparación en tiempo constante.
- CORS desactivado por defecto y allowlist explícita mediante
  `BRIDGE_ALLOWED_ORIGINS`; no se admite el comodín `*`.
- Lista blanca cerrada de operaciones con validación de esquema (Pydantic).
- Límite de frecuencia global (10 req/s, ráfaga 20).
- Timeout (5 s) y tamaño máximo de respuesta del juego (64 KiB).
- Los errores del juego se traducen a `502` genéricos sin filtrar contenido.
- El token no aparece en logs ni respuestas.

## Desarrollo local

```bash
cd bridge
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
EE_URL=http://localhost:8080 BRIDGE_TOKEN=dev uvicorn app:app --port 8090
```

Para que el módulo pueda consultar el puente desde el navegador, configura el
origen **exacto** de Foundry (esquema, host y puerto; sin barra final):

```bash
BRIDGE_ALLOWED_ORIGINS=http://localhost:30000
```

Se pueden indicar varios orígenes separados por comas. Si la variable está
vacía, el puente no añade cabeceras CORS. Solo se aceptan orígenes `http` y
`https`, y nunca `*`; CORS no sustituye al Bearer ni a TLS.

## Tests

Suite `pytest` que simula el `/exec.lua` del juego (no necesita un
EmptyEpsilon en marcha) y cubre auth, límite de frecuencia, traducción de
errores a 502, la lista blanca de órdenes y los intentos de inyección por los
campos tipados. También cubre el endpoint de eventos vacío, una llegada, un
inicio de encuentro y una reposición normalizados, y el de contactos (lista vacía, objetos normalizados y objetos sin
facción). El Lua fijo de `/v1/contacts` tiene además una suite adversarial que
lo EJECUTA con un intérprete Lua real contra un mundo simulado: caracteres de
control/comillas/barras en indicativos y facciones (JSON válido), propagación
de plantilla/clase/subclase desde los componentes ECS, indicativos duplicados
(identidad por objeto), y 80 objetos con el jugador el último del
índice (orden por distancia, jugador incluido, `truncated`/`total` declarados).
También se validó contra un EmptyEpsilon headless real (`luac -p` + ejecución
vía `httpserver`, con nave, nave IA y un asteroide sin facción).

```bash
cd bridge
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

En CI corren en el job «Tests del puente (pytest)» de
[`.github/workflows/docker.yml`](../.github/workflows/docker.yml), que instala
`lua5.3` (el mismo intérprete del job LuaTest) para que la parte adversarial
ejecute el Lua fijo real; si faltara el intérprete, esos tests se saltan
limpiamente en vez de fallar.

## Pendiente (v1)

- Más tipos de evento y persistencia después de reiniciar completamente el juego.
- WebSocket solo si métricas futuras demuestran que el polling v0 no basta.
- Grano fino de permisos **en el propio puente** (decisión con ADR). El permiso
  por puesto de la tripulación ya existe, pero gateado en el relé de Foundry
  según el puesto actual del `User` autenticado (ver `docs/FOUNDRY.md`, «Permisos
  por puesto»), no en el Bearer, que sigue siendo grano grueso y solo-GM. La
  identidad de usuario no se toma del payload; el puesto sí es autoasignable en
  el modelo actual y no equivale a un rol fijo impuesto por el GM. Foundry
  persiste el flag, pero sigue siendo contexto operativo mutable, no una
  credencial; restringirlo en el futuro requiere una decisión explícita.
- Auditoría de órdenes por puesto: cualquier registro futuro debe conservar tanto
  el `userId` autenticado como el puesto resuelto en el momento del despacho. El
  puesto por sí solo no identifica a quien actuó; tokens y datos sensibles deben
  seguir redactados.
- Órdenes de trayecto (destino y factor temporal; pausa/reanudación ya disponible).
