# Puente Espaciokoop Lagunak ↔ Foundry VTT

Servicio HTTP que expone un contrato **cerrado y versionado** sobre el
servidor headless. Es la única pieza autorizada a hablar con el endpoint
heredado `/exec.lua` (que ejecuta Lua arbitrario): todo el Lua vive en
`app.py`, y las entradas del cliente solo rellenan valores tipados,
validados y acotados. **Nunca se reenvía Lua recibido por la red.**

Diseño completo: [`docs/FOUNDRY.md`](../docs/FOUNDRY.md) · Inventario del API
heredado: [`docs/API_HTTP.md`](../docs/API_HTTP.md).

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
Internet. El [modelo de amenazas](../docs/BRIDGE_THREAT_MODEL.md) documenta los
actores, riesgos residuales y cambios que requieren revisión adversarial.

| Garantía | Control vigente | Límite explícito |
|---|---|---|
| El cliente no puede aportar Lua para ejecutar | `/v1/command` acepta una unión discriminada de operaciones tipadas; cada modelo genera una plantilla Lua propiedad del servidor | `bridge/app.py` sigue siendo código privilegiado: una plantilla nueva exige review de seguridad |
| `/exec.lua` no es accesible desde el cliente | El puerto heredado permanece en la red interna de Compose y una guardia CI rechaza su publicación | Un cambio de red, `network_mode: host` o acceso alternativo al puerto 8080 rompe la garantía |
| Toda ruta `/v1/*` exige autenticación | Dependencia Bearer común y comparación en tiempo constante; sin `BRIDGE_TOKEN` el puente falla cerrado con `503` | `/healthz` y `/docs` son públicos; el Bearer es compartido y no acredita identidad ni rol de Foundry |
| Solo se admiten órdenes y valores cerrados | Discriminador `op`, enums, tipos estrictos y rangos Pydantic; operación o forma desconocida devuelve `422` | No hay passthrough genérico; ampliar un enum, campo u operación amplía la superficie autorizada |
| La espera y la respuesta del juego están acotadas en el puente | Timeout HTTP de 5 s y rechazo de respuestas heredadas mayores de 64 KiB | El timeout limita cuánto espera el puente, pero no garantiza cancelar un script que el juego ya haya empezado |
| El sondeo no puede crecer sin límite por frecuencia | Token bucket global de 10 peticiones/s con ráfaga de 20 | Es un límite en memoria y por proceso, no sustituye límites del proxy ni aislamiento operativo |
| Los fallos del juego no filtran su cuerpo al cliente | Estados no válidos, JSON malformado, exceso de tamaño y errores Lua se traducen a `502` genérico | Logs y proxies externos deben conservar la misma política de redacción |
| CORS solo permite orígenes web exactos configurados | Allowlist HTTP(S), sin `*`, credenciales embebidas, rutas, query ni fragmentos | CORS no autentica, no protege clientes no navegador y no sustituye TLS |

Las regresiones de `bridge/tests/` cubren autenticación, CORS, rate limit,
traducción de respuestas heredadas, lista blanca, rangos e intentos de inyección.
Un cambio que altere una fila debe actualizar también sus pruebas y el modelo de
amenazas. En particular, **el tamaño del cuerpo entrante no forma parte aún de
estas garantías**: su endurecimiento se sigue por separado en #248.

## Contrato v0

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/healthz` | No | Estado del puente y alcance del juego |
| GET | `/v1/state` | Bearer | Nave: posición, rumbo, velocidad, destino, distancia, ETA, casco, energía, escudos y sistemas |
| GET | `/v1/scenario` | Bearer | Tiempo de escenario y estado de pausa (`paused`) |
| GET | `/v1/events` | Bearer | Eventos normalizados presentes: llegada e inicio de encuentro en Primera Guardia |
| GET | `/v1/contacts` | Bearer | Objetos cercanos a la nave (indicativo, posición, facción, plantilla, clase/subclase opcionales y si es el jugador) para un mapa vivo en Foundry. **Vista GM omnisciente** (ver abajo) |
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

### Órdenes permitidas (`POST /v1/command`)

```json
{"op": "set_impulse",        "value": 0.5}
{"op": "set_warp",           "level": 2}
{"op": "set_target_heading", "heading": 90.0}
{"op": "set_shields",        "active": true}
{"op": "set_system_power",   "system": "impulse", "level": 1.5}
{"op": "set_system_health",  "system": "impulse", "value": -0.75}
{"op": "spawn_encounter",    "archetype": "derelict", "bearing": "port"}
{"op": "set_pause",          "paused": true}
```

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
Exuari hostil en ronda), `freighter` (mercante neutral) y `sentry` (plataforma de
defensa hostil que guarda su posición). Un arquetipo que el puente conoce pero el
escenario cargado no honra degrada a `not_supported`, nunca inventa un objeto.
`bearing` es opcional (`ahead`/`astern`/`port`/`starboard`), un rumbo grueso
relativo a la nave que el escenario puede honrar laxamente — **nunca se aceptan
coordenadas**:
cualquier campo extra rechaza la orden entera (`422`). El Lua emitido es fijo y
solo llama al callback `spawnEncounter(archetype, bearing)` que el escenario
publica bajo el namespace propio `espaciokoop_lagunak` de `getScriptStorage()`;
si el escenario cargado no lo registra, la respuesta degrada a
`{"ok":false,"reason":"not_supported"}`. El contacto nuevo aparece por
`/v1/contacts` y en las estaciones de ciencia/relay de la tripulación. Tras
crearlo, `/v1/events` publica un DTO cerrado `encounter_started` con ID estable
de sesión y secuencia monotónica para que Foundry pueda deduplicarlo.

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
campos tipados. También cubre el endpoint de eventos vacío, una llegada y un
inicio de encuentro normalizados, y el de contactos (lista vacía, objetos normalizados y objetos sin
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
- Permisos diferenciados por puesto y para el director de juego.
- Órdenes de trayecto (destino y factor temporal; pausa/reanudación ya disponible).
