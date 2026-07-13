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
  POST /v1/command   — órdenes de una lista blanca cerrada (auth).

Configuración por variables de entorno:
  EE_URL        — URL interna del juego (p. ej. http://game:8080).
  BRIDGE_TOKEN  — token Bearer obligatorio para /v1/*.
  BRIDGE_PORT   — puerto de escucha (por defecto 8090).
"""

from __future__ import annotations

import hmac
import json
import os
import threading
import time
from enum import Enum
from typing import Annotated, Any, Literal, Union

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, StrictBool

EE_URL = os.environ.get("EE_URL", "http://game:8080")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")

EXEC_TIMEOUT_SECONDS = 5.0
MAX_GAME_RESPONSE_BYTES = 64 * 1024
RATE_LIMIT_PER_SECOND = 10
RATE_LIMIT_BURST = 20

app = FastAPI(
    title="Espaciokoop Lagunak — puente Foundry VTT",
    version="0.1.0",
    description=__doc__,
)

_bearer = HTTPBearer(auto_error=False)


class _TokenBucket:
    """Límite de frecuencia global, suficiente para una mesa de juego."""

    def __init__(self, rate: float, burst: float) -> None:
        self._rate = rate
        self._capacity = burst
        self._tokens = burst
        self._updated = time.monotonic()
        self._lock = threading.Lock()

    def allow(self) -> bool:
        with self._lock:
            now = time.monotonic()
            self._tokens = min(
                self._capacity, self._tokens + (now - self._updated) * self._rate
            )
            self._updated = now
            if self._tokens < 1:
                return False
            self._tokens -= 1
            return True


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
            response = await client.post(f"{EE_URL}/exec.lua", content=lua)
    except httpx.HTTPError:
        raise HTTPException(502, "El servidor de juego no responde")
    if response.status_code != 200 or len(response.content) > MAX_GAME_RESPONSE_BYTES:
        raise HTTPException(502, "Respuesta inválida del servidor de juego")
    try:
        payload = json.loads(response.text)
    except json.JSONDecodeError:
        raise HTTPException(502, "El servidor de juego devolvió JSON inválido")
    if isinstance(payload, dict) and "ERROR" in payload:
        raise HTTPException(502, "Error de script en el servidor de juego")
    return payload


# --- Lua fijo del servidor ---------------------------------------------------

_SYSTEMS = (
    "reactor",
    "beamweapons",
    "missilesystem",
    "maneuver",
    "impulse",
    "warp",
    "jumpdrive",
    "frontshield",
    "rearshield",
)

_STATE_LUA = """
local ship = getPlayerShip(-1)
if ship == nil then
    return '{"ship":null}'
end
local x, y = ship:getPosition()
local vx, vy = ship:getVelocity()
local destination = nil
for _, object in ipairs(getObjectsInRadius(x, y, 1000000)) do
    if (object:getCallSign() or "") == "LAGUNAK_ROUTE_s90_argia" then
        local destination_x, destination_y = object:getPosition()
        destination = {name = "Argia", x = destination_x, y = destination_y}
        break
    end
end
local destination_json = "null"
local distance_json = "null"
local eta_json = "null"
if destination ~= nil then
    local dx = destination.x - x
    local dy = destination.y - y
    local distance = math.sqrt(dx * dx + dy * dy)
    local speed = math.sqrt(vx * vx + vy * vy)
    destination_json = string.format(
        '{"name":"Argia","position":{"x":%%.1f,"y":%%.1f}}',
        destination.x, destination.y)
    distance_json = string.format("%%.1f", distance)
    if speed > 0.01 then
        eta_json = string.format("%%.1f", distance / speed)
    end
end
local systems = {}
for _, name in ipairs({%s}) do
    systems[#systems + 1] = string.format(
        '"%%s":{"health":%%.3f,"heat":%%.3f,"power":%%.3f}',
        name, ship:getSystemHealth(name), ship:getSystemHeat(name),
        ship:getSystemPower(name))
end
return string.format(
    '{"ship":{"callsign":%%q,"position":{"x":%%.1f,"y":%%.1f},"heading":%%.2f,'
    .. '"velocity":{"x":%%.2f,"y":%%.2f},"destination":%%s,'
    .. '"distance_to_destination":%%s,"eta_seconds":%%s,'
    .. '"hull":%%.1f,"hull_max":%%.1f,"energy":%%.1f,"energy_max":%%.1f,'
    .. '"shields_active":%%s,"systems":{%%s}}}',
    ship:getCallSign() or "?", x, y, ship:getHeading(), vx, vy,
    destination_json, distance_json, eta_json,
    ship:getHull(), ship:getHullMax(),
    ship:getEnergyLevel(), ship:getEnergyLevelMax(),
    tostring(ship:getShieldsActive()), table.concat(systems, ","))
""" % ", ".join(f'"{name}"' for name in _SYSTEMS)

_SCENARIO_LUA = """
return string.format('{"scenario_time":%.1f}', getScenarioTime())
"""

_HEALTH_LUA = """
return '{"ok":true}'
"""

_EVENTS_LUA = """
local ship = getPlayerShip(-1)
if ship == nil then
    return '{"events":[]}'
end
local x, y = ship:getPosition()
local events = {}
for _, object in ipairs(getObjectsInRadius(x, y, 5000)) do
    local call_sign = object:getCallSign() or ""
    local suffix = string.match(call_sign, "^LAGUNAK_EVT_arrival_s90_(%d+)$")
    if suffix ~= nil then
        events[#events + 1] = string.format(
            '{"id":"arrival-s90-%s","type":"arrival",'
            .. '"scenario":"scenario_90_lagunak_primera_guardia",'
            .. '"destination":"Argia","scenario_time":%.1f}',
            suffix, getScenarioTime())
    end
end
return '{"events":[' .. table.concat(events, ",") .. ']}'
"""


# --- Órdenes de lista blanca -------------------------------------------------


class SystemName(str, Enum):
    reactor = "reactor"
    beamweapons = "beamweapons"
    missilesystem = "missilesystem"
    maneuver = "maneuver"
    impulse = "impulse"
    warp = "warp"
    jumpdrive = "jumpdrive"
    frontshield = "frontshield"
    rearshield = "rearshield"


class SetImpulse(BaseModel):
    op: Literal["set_impulse"]
    value: Annotated[float, Field(ge=-1.0, le=1.0)]

    def lua(self) -> str:
        return _command_lua(f"ship:commandImpulse({self.value:.3f})")


class SetWarp(BaseModel):
    op: Literal["set_warp"]
    level: Annotated[int, Field(ge=0, le=4)]

    def lua(self) -> str:
        return _command_lua(f"ship:commandWarp({self.level})")


class SetTargetHeading(BaseModel):
    op: Literal["set_target_heading"]
    heading: Annotated[float, Field(ge=0.0, le=360.0)]

    def lua(self) -> str:
        # El rumbo de juego difiere 90 grados de la rotación interna.
        return _command_lua(f"ship:commandTargetRotation({self.heading - 90.0:.3f})")


class SetShields(BaseModel):
    op: Literal["set_shields"]
    active: bool

    def lua(self) -> str:
        return _command_lua(f"ship:commandSetShields({str(self.active).lower()})")


class SetSystemPower(BaseModel):
    op: Literal["set_system_power"]
    system: SystemName
    level: Annotated[float, Field(ge=0.0, le=3.0)]

    def lua(self) -> str:
        return _command_lua(
            f'ship:commandSetSystemPowerRequest("{self.system.value}", {self.level:.3f})'
        )


class SetPause(BaseModel):
    op: Literal["set_pause"]
    paused: StrictBool

    def lua(self) -> str:
        call = "pauseGame()" if self.paused else "unpauseGame()"
        return f"{call}\nreturn '{{\"ok\":true}}'"


Command = Annotated[
    Union[SetImpulse, SetWarp, SetTargetHeading, SetShields, SetSystemPower, SetPause],
    Field(discriminator="op"),
]


def _command_lua(call: str) -> str:
    return (
        "local ship = getPlayerShip(-1)\n"
        "if ship == nil then return '{\"ok\":false,\"reason\":\"no_ship\"}' end\n"
        f"{call}\n"
        "return '{\"ok\":true}'"
    )


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


@app.post("/v1/command", dependencies=[Depends(_require_auth)])
async def command(cmd: Command) -> Any:
    result = await _run_lua(cmd.lua())
    return {"op": cmd.op, "result": result}
