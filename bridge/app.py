"""Puente de integración Espaciokoop Lagunak ↔ Foundry VTT (v0).

Expone una API HTTP mínima y segura sobre el servidor headless de
Espaciokoop Lagunak. El endpoint heredado ``/exec.lua`` del juego ejecuta
Lua arbitrario, así que este puente es la única pieza autorizada a hablar
con él: todos los fragmentos de Lua que se envían están definidos AQUÍ,
en el servidor, y las entradas del cliente solo rellenan valores tipados
y validados. Nunca se reenvía Lua recibido por la red.

Contrato v0 (ver docs/FOUNDRY.md):
  GET  /healthz      — estado del puente y del juego (sin auth).
  GET  /v1/state     — estado seguro de la nave del jugador (auth).
  GET  /v1/scenario  — tiempo de escenario y metadatos (auth).
  GET  /v1/events    — eventos normalizados presentes en la sesión (auth).
  GET  /v1/contacts  — objetos cercanos a la nave, para un mapa vivo (auth).
  GET  /v1/database  — base de datos científica del escenario, consulta (auth).
  GET  /v1/encounters — catálogo cerrado de encuentros del GM (auth).
  POST /v1/command   — órdenes de una lista blanca cerrada (auth).

Configuración por variables de entorno:
  EE_URL                  — URL interna del juego (p. ej. http://game:8080).
  BRIDGE_TOKEN            — token Bearer obligatorio para /v1/*.
  BRIDGE_PORT             — puerto de escucha (por defecto 8090).
  BRIDGE_ALLOWED_ORIGINS  — orígenes web permitidos, separados por comas.

Este archivo es el orquestador puro: settings, auth, ejecución de Lua contra
el juego y cableado de rutas. El middleware ASGI vive en http_middleware.py,
el limitador de frecuencia en rate_limit.py, los modelos de las órdenes de
/v1/command en command_models.py y las plantillas Lua fijas en
lua_templates.py — misma extracción mecánica que separó estos archivos de
un app.py que llegó a mezclarlo todo (ver foundry-module/scripts/main.mjs
y su propia extracción en el PR #283 para el precedente).
"""

from __future__ import annotations

import hmac
import json
import os
from typing import Annotated, Any

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from command_models import (
    Command,
    EncounterArchetype,
    EncounterBearing,
    RepositionShip,
    SetImpulse,
    SetPause,
    SetShields,
    SetSystemCoolant,
    SetSystemHealth,
    SetSystemPower,
    SetTargetHeading,
    SetWarp,
    ShipAnchor,
    SpawnEncounter,
    SystemName,
)
from http_middleware import (
    _configure_cors,
    _parse_allowed_origins,
    _replay_receive,
    _RequestBodyLimitMiddleware,
)
from lua_templates import (
    _CONTACTS_LUA,
    _DATABASE_LUA,
    _EVENTS_LUA,
    _HEALTH_LUA,
    _SCENARIO_LUA,
    _STATE_LUA,
    _command_lua,
)
from rate_limit import _TokenBucket

EE_URL = os.environ.get("EE_URL", "http://game:8080")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")
BRIDGE_ALLOWED_ORIGINS = os.environ.get("BRIDGE_ALLOWED_ORIGINS", "")

EXEC_TIMEOUT_SECONDS = 5.0
MAX_GAME_RESPONSE_BYTES = 64 * 1024
MAX_REQUEST_BODY_BYTES = 16 * 1024
RATE_LIMIT_PER_SECOND = 10
RATE_LIMIT_BURST = 20

app = FastAPI(
    title="Espaciokoop Lagunak — puente Foundry VTT",
    version="0.1.0",
    description=__doc__,
)
app.add_middleware(_RequestBodyLimitMiddleware, max_bytes=MAX_REQUEST_BODY_BYTES)
_configure_cors(app, BRIDGE_ALLOWED_ORIGINS)

_bearer = HTTPBearer(auto_error=False)
_rate_limiter = _TokenBucket(RATE_LIMIT_PER_SECOND, RATE_LIMIT_BURST)


async def _require_auth(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> None:
    if not BRIDGE_TOKEN:
        raise HTTPException(503, "BRIDGE_TOKEN sin configurar en el puente")
    if credentials is None or not hmac.compare_digest(
        credentials.credentials, BRIDGE_TOKEN
    ):
        raise HTTPException(401, "Token inválido o ausente")
    if not _rate_limiter.allow():
        raise HTTPException(429, "Demasiadas peticiones")


async def _run_lua(lua: str) -> Any:
    """Ejecuta un fragmento de Lua DEFINIDO EN ESTE ARCHIVO contra el juego.

    El fragmento debe devolver una cadena JSON. Cualquier error del juego se
    traduce a un 502 sin filtrar contenido sensible.
    """
    try:
        async with httpx.AsyncClient(timeout=EXEC_TIMEOUT_SECONDS) as client:
            async with client.stream("POST", f"{EE_URL}/exec.lua", content=lua) as response:
                if response.status_code != 200:
                    raise HTTPException(502, "Respuesta inválida del servidor de juego")
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    if len(body) + len(chunk) > MAX_GAME_RESPONSE_BYTES:
                        raise HTTPException(502, "Respuesta inválida del servidor de juego")
                    body.extend(chunk)
                # Preserve HTTPX's existing charset handling, but only after
                # accepting a bounded body. The stream closes on every exit.
                text = bytes(body).decode(response.encoding or "utf-8", errors="replace")
    except httpx.HTTPError:
        raise HTTPException(502, "El servidor de juego no responde")
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(502, "El servidor de juego devolvió JSON inválido")
    if isinstance(payload, dict) and "ERROR" in payload:
        raise HTTPException(502, "Error de script en el servidor de juego")
    return payload


# --- Endpoints ---------------------------------------------------------------


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    game = "ok"
    try:
        await _run_lua(_HEALTH_LUA)
    except HTTPException:
        game = "unreachable"
    return {"bridge": "ok", "game": game, "version": app.version}


@app.get("/v1/state", dependencies=[Depends(_require_auth)])
async def state() -> Any:
    return await _run_lua(_STATE_LUA)


@app.get("/v1/scenario", dependencies=[Depends(_require_auth)])
async def scenario() -> Any:
    return await _run_lua(_SCENARIO_LUA)


@app.get("/v1/events", dependencies=[Depends(_require_auth)])
async def events() -> Any:
    return await _run_lua(_EVENTS_LUA)


@app.get("/v1/contacts", dependencies=[Depends(_require_auth)])
async def contacts() -> Any:
    return await _run_lua(_CONTACTS_LUA)


@app.get("/v1/database", dependencies=[Depends(_require_auth)])
async def database() -> Any:
    """Base de datos científica del escenario: CONSULTA, no orden (#520).

    Recurso propio y no un campo de ``/v1/state`` porque son cosas de ritmo
    distinto: el estado se sondea cada pocos segundos y describe lo que cambia;
    esto es contenido de referencia casi inmóvil y mucho más grande. Meterlo en
    el estado haría que cada sondeo reenviara siempre lo mismo.

    Es información asimétrica pura —el pilar 1 del roadmap de producto— sin
    tocar la autoridad de nadie: no hay nada que ordenar aquí.
    """
    return await _run_lua(_DATABASE_LUA)


@app.get("/v1/encounters", dependencies=[Depends(_require_auth)])
async def encounters() -> Any:
    """Catálogo cerrado de encuentros que acepta ``spawn_encounter``.

    Es la misma fuente de verdad que valida /v1/command (los enums de
    ``SpawnEncounter``): el módulo de Foundry lee este catálogo en vez de
    hardcodear arquetipos, y nunca puede ofrecer uno que el puente rechazaría.
    No consulta al juego: si el escenario cargado no publica el callback, la
    orden degradará honestamente a ``not_supported`` al ejecutarse.
    """
    return {
        "archetypes": [archetype.value for archetype in EncounterArchetype],
        "bearings": [bearing.value for bearing in EncounterBearing],
    }


@app.get("/v1/anchors", dependencies=[Depends(_require_auth)])
async def anchors() -> Any:
    """Catálogo cerrado de anclas a las que acepta reposicionar ``reposition_ship``.

    Es la misma fuente de verdad que valida /v1/command (el enum ``ShipAnchor``):
    el módulo de Foundry lee este catálogo en vez de hardcodear nombres, y nunca
    puede ofrecer uno que el puente rechazaría. No consulta al juego: si el
    escenario cargado no publica el callback, la orden degradará honestamente a
    ``not_supported`` al ejecutarse.
    """
    return {"anchors": [anchor.value for anchor in ShipAnchor]}


@app.post("/v1/command", dependencies=[Depends(_require_auth)])
async def command(cmd: Command) -> Any:
    result = await _run_lua(cmd.lua())
    return {"op": cmd.op, "result": result}
