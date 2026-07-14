# Puente Espaciokoop Lagunak ↔ Foundry VTT

Servicio HTTP que expone un contrato **cerrado y versionado** sobre el
servidor headless. Es la única pieza autorizada a hablar con el endpoint
heredado `/exec.lua` (que ejecuta Lua arbitrario): todo el Lua vive en
`app.py`, y las entradas del cliente solo rellenan valores tipados,
validados y acotados. **Nunca se reenvía Lua recibido por la red.**

Diseño completo: [`docs/FOUNDRY.md`](../docs/FOUNDRY.md) · Inventario del API
heredado: [`docs/API_HTTP.md`](../docs/API_HTTP.md).

## Contrato v0

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/healthz` | No | Estado del puente y alcance del juego |
| GET | `/v1/state` | Bearer | Nave: posición, rumbo, velocidad, destino, distancia, ETA, casco, energía, escudos y sistemas |
| GET | `/v1/scenario` | Bearer | Tiempo de escenario |
| GET | `/v1/events` | Bearer | Eventos normalizados presentes; inicialmente llegada de Primera Guardia |
| GET | `/v1/contacts` | Bearer | Objetos cercanos a la nave (indicativo, posición, facción, si es el jugador) para un mapa vivo en Foundry. **Vista GM omnisciente** (ver abajo) |
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

### Órdenes permitidas (`POST /v1/command`)

```json
{"op": "set_impulse",        "value": 0.5}
{"op": "set_warp",           "level": 2}
{"op": "set_target_heading", "heading": 90.0}
{"op": "set_shields",        "active": true}
{"op": "set_system_power",   "system": "impulse", "level": 1.5}
{"op": "set_pause",          "paused": true}
```

Cualquier otra operación devuelve `422`. Añadir una orden nueva implica
añadir un modelo validado en `app.py` y documentarla aquí — nunca un
passthrough genérico.

## Seguridad aplicada

- Bearer token obligatorio (`BRIDGE_TOKEN`), comparación en tiempo constante.
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

## Tests

Suite `pytest` que simula el `/exec.lua` del juego (no necesita un
EmptyEpsilon en marcha) y cubre auth, límite de frecuencia, traducción de
errores a 502, la lista blanca de órdenes y los intentos de inyección por los
campos tipados. También cubre el endpoint de eventos vacío y con una llegada
normalizada, y el de contactos (lista vacía, objetos normalizados y objetos sin
facción). El Lua fijo de `/v1/contacts` tiene además una suite adversarial que
lo EJECUTA con un intérprete Lua real contra un mundo simulado: caracteres de
control/comillas/barras en indicativos y facciones (JSON válido), indicativos
duplicados (identidad por objeto), y 80 objetos con el jugador el último del
índice (orden por distancia, jugador incluido, `truncated`/`total` declarados).
También se validó contra un EmptyEpsilon headless real (`luac -p` + ejecución
vía `httpserver`, con nave, nave IA y un asteroide sin facción).

```bash
cd bridge
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

Están pensados para correr también en CI: el PR de #22 propone un job `pytest`
para `.github/workflows/docker.yml`, a añadir por alguien con permiso sobre
workflows.

## Pendiente (v1)

- Más tipos de evento y persistencia después de reiniciar completamente el juego.
- WebSocket solo si métricas futuras demuestran que el polling v0 no basta.
- Permisos diferenciados por puesto y para el director de juego.
- Órdenes de trayecto (destino y factor temporal; pausa/reanudación ya disponible).
