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
  POST /v1/command   — órdenes de una lista blanca cerrada (auth).

Configuración por variables de entorno:
  EE_URL                  — URL interna del juego (p. ej. http://game:8080).
  BRIDGE_TOKEN            — token Bearer obligatorio para /v1/*.
  BRIDGE_PORT             — puerto de escucha (por defecto 8090).
  BRIDGE_ALLOWED_ORIGINS  — orígenes web permitidos, separados por comas.
"""

from __future__ import annotations

import hmac
import json
import os
import threading
import time
from enum import Enum
from typing import Annotated, Any, Literal, Union
from urllib.parse import urlsplit

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, StrictBool

EE_URL = os.environ.get("EE_URL", "http://game:8080")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")
BRIDGE_ALLOWED_ORIGINS = os.environ.get("BRIDGE_ALLOWED_ORIGINS", "")

EXEC_TIMEOUT_SECONDS = 5.0
MAX_GAME_RESPONSE_BYTES = 64 * 1024
RATE_LIMIT_PER_SECOND = 10
RATE_LIMIT_BURST = 20

app = FastAPI(
    title="Espaciokoop Lagunak — puente Foundry VTT",
    version="0.1.0",
    description=__doc__,
)


def _parse_allowed_origins(raw: str) -> list[str]:
    """Valida una allowlist CORS de orígenes HTTP(S) exactos."""
    origins: list[str] = []
    for value in raw.split(","):
        origin = value.strip()
        if not origin:
            continue
        if origin == "*":
            raise RuntimeError("BRIDGE_ALLOWED_ORIGINS no admite el comodín '*'")

        parsed = urlsplit(origin)
        try:
            parsed.port
        except ValueError as exc:
            raise RuntimeError(
                f"Origen CORS inválido en BRIDGE_ALLOWED_ORIGINS: {origin!r}"
            ) from exc
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.netloc.endswith(":")
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise RuntimeError(
                f"Origen CORS inválido en BRIDGE_ALLOWED_ORIGINS: {origin!r}"
            )
        if origin not in origins:
            origins.append(origin)
    return origins


def _configure_cors(application: FastAPI, raw_origins: str) -> None:
    origins = _parse_allowed_origins(raw_origins)
    if not origins:
        return
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
        allow_credentials=False,
        max_age=600,
    )


_configure_cors(app, BRIDGE_ALLOWED_ORIGINS)

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
        '"%%s":{"health":%%.3f,"heat":%%.3f,"power":%%.3f,"coolant":%%.3f}',
        name, ship:getSystemHealth(name), ship:getSystemHeat(name),
        ship:getSystemPower(name), ship:getSystemCoolant(name))
end
return string.format(
    '{"ship":{"callsign":%%q,"position":{"x":%%.1f,"y":%%.1f},"heading":%%.2f,'
    .. '"velocity":{"x":%%.2f,"y":%%.2f},"destination":%%s,'
    .. '"distance_to_destination":%%s,"eta_seconds":%%s,'
    .. '"hull":%%.1f,"hull_max":%%.1f,"energy":%%.1f,"energy_max":%%.1f,'
    .. '"shields_active":%%s,"repair_crew":%%d,"systems":{%%s}}}',
    ship:getCallSign() or "?", x, y, ship:getHeading(), vx, vy,
    destination_json, distance_json, eta_json,
    ship:getHull(), ship:getHullMax(),
    ship:getEnergyLevel(), ship:getEnergyLevelMax(),
    tostring(ship:getShieldsActive()), ship:getRepairCrewCount(),
    table.concat(systems, ","))
""" % ", ".join(f'"{name}"' for name in _SYSTEMS)

_SCENARIO_LUA = """
return string.format('{"scenario_time":%.1f,"paused":%s}',
    getScenarioTime(), tostring(isGamePaused()))
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

# Contactos cercanos a la nave del jugador: base de datos para un mapa vivo en
# Foundry (starfield + puntos). VISTA GM OMNISCIENTE, no de sensores: publica
# indicativo y facción de todo objeto en radio sin filtrar por detección
# (isScannedBy / nivel de identificación). Es deliberado — la consume la
# ventana de mapa vivo, solo-GM, detrás del Bearer que solo tiene el GM — y NO
# debe reutilizarse como contrato para jugadores sin añadir ese filtrado.
#
# Solo lectura, radio y número acotados para limitar el tamaño de la
# respuesta. El truncamiento es honesto: se ordenan TODOS los objetos del
# radio por distancia y se devuelven los `limite` más cercanos (el índice
# espacial de getObjectsInRadius no garantiza orden), con el jugador SIEMPRE
# incluido (se separa por identidad de objeto — __eq del binding de
# SeriousProton — y encabeza la lista), y `truncated`/`total` en la respuesta
# para que el consumidor sepa si hay más. Cada accesor opcional va en pcall:
# objetos como asteroides o nebulosas no responden a getFaction y no deben
# romper la lista. json_escape serializa cada string como JSON válido
# (comillas, barra inversa y controles como \\u00XX); %q de Lua escapa para
# Lua, no para JSON. Cadena "raw" de Python para que las barras invertidas
# lleguen intactas a Lua.
_CONTACTS_LUA = r"""
local function json_escape(s)
    s = string.gsub(s, '[%c"\\]', function(c)
        if c == '"' then return '\\"' end
        if c == '\\' then return '\\\\' end
        return string.format('\\u%04x', string.byte(c))
    end)
    return '"' .. s .. '"'
end
local ship = getPlayerShip(-1)
if ship == nil then
    return '{"contacts":[],"truncated":false,"total":0}'
end
local x, y = ship:getPosition()
local limite = 60
local otros = {}
for _, object in ipairs(getObjectsInRadius(x, y, 30000)) do
    if object ~= ship then
        local ox, oy = object:getPosition()
        local dx = ox - x
        local dy = oy - y
        otros[#otros + 1] = {obj = object, ox = ox, oy = oy, d2 = dx * dx + dy * dy}
    end
end
table.sort(otros, function(a, b) return a.d2 < b.d2 end)
local function entrada(object, ox, oy, es_jugador)
    local ok_cs, callsign = pcall(function() return object:getCallSign() end)
    if not ok_cs or callsign == nil then callsign = "?" end
    local faction_json = "null"
    local ok_f, faction = pcall(function() return object:getFaction() end)
    if ok_f and faction ~= nil and faction ~= "" then
        faction_json = json_escape(faction)
    end
    local type_json = "null"
    -- Contrato real del juego: el componente ECS `typename` (registrado en
    -- src/script/components.cpp) con su campo `type_name`. Las entidades sin
    -- ese componente (asteroides…) hacen fallar el pcall y quedan en null.
    local ok_t, tname = pcall(function() return object.components.typename.type_name end)
    if ok_t and tname ~= nil and tname ~= "" then
        type_json = json_escape(tname)
    end
    local class_json = "null"
    local subclass_json = "null"
    -- ShipTemplate:setClass() copia la clasificación semántica al componente
    -- `docking_port`. Es opcional: estaciones y objetos de escenario pueden
    -- no publicarlo, por lo que cada acceso permanece dentro de pcall.
    local ok_dp, docking = pcall(function() return object.components.docking_port end)
    if ok_dp and docking ~= nil then
        local ok_c, class = pcall(function() return docking.dock_class end)
        if ok_c and class ~= nil and class ~= "" then class_json = json_escape(class) end
        local ok_sc, subclass = pcall(function() return docking.dock_subclass end)
        if ok_sc and subclass ~= nil and subclass ~= "" then subclass_json = json_escape(subclass) end
    end
    return string.format(
        '{"callsign":%s,"position":{"x":%.1f,"y":%.1f},"faction":%s,"type":%s,"class":%s,"subclass":%s,"is_player":%s}',
        json_escape(callsign), ox, oy, faction_json, type_json, class_json, subclass_json, es_jugador)
end
local contacts = {entrada(ship, x, y, "true")}
for i = 1, math.min(#otros, limite - 1) do
    contacts[#contacts + 1] = entrada(otros[i].obj, otros[i].ox, otros[i].oy, "false")
end
return string.format('{"contacts":[%s],"truncated":%s,"total":%d}',
    table.concat(contacts, ","), tostring(#otros > limite - 1), #otros + 1)
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


class SetSystemHealth(BaseModel):
    """Avería (o reparación) directa de un sistema: palanca narrativa del GM.

    Rango -1.0..1.0, el del propio juego (`setSystemHealth` en
    scripts/api/entity/spaceship.lua): bajo 0.0 el sistema queda inutilizado.
    Es una escritura GM sobre la verdad de la nave — la REPARACIÓN normal
    sigue siendo trabajo de la tripulación en su estación de ingeniería; el
    puente solo publica el progreso vía health/coolant/repair_crew en /v1/state.
    """

    op: Literal["set_system_health"]
    system: SystemName
    # strict=True: sin coacción de booleanos (true → 1.0 sería una reparación
    # total silenciosa); acepta enteros/decimales JSON, rechaza bool y cadenas.
    value: Annotated[float, Field(strict=True, ge=-1.0, le=1.0)]

    def lua(self) -> str:
        return _command_lua(
            f'ship:setSystemHealth("{self.system.value}", {self.value:.3f})'
        )


class EncounterArchetype(str, Enum):
    """Catálogo cerrado de encuentros que el GM puede pedir desde Foundry.

    Foundry decide el *qué* (arquetipo); el escenario decide el *cómo*
    (posición exacta, facción, stats, IA). Nunca se aceptan coordenadas ni
    definiciones de objeto desde el cliente: eso sería doble autoridad sobre
    el estado de la nave (ADR-0002) y la puerta de /exec.lua disfrazada.
    """

    derelict = "derelict"


class EncounterBearing(str, Enum):
    """Rumbo grueso relativo a la nave: una sugerencia, no una coordenada."""

    ahead = "ahead"
    astern = "astern"
    port = "port"
    starboard = "starboard"


class SpawnEncounter(BaseModel):
    """Encuentro inyectado por el GM: la mitad narrativa que faltaba (#117).

    El Lua emitido es fijo y solo llama al callback que el escenario publica
    en ``getScriptStorage()``. Ese almacén es la frontera compartida con
    ``/exec.lua``: los globales del entorno del escenario no son visibles
    desde el endpoint heredado. Si el escenario no registra el callback,
    degrada honestamente a ``not_supported``. El escenario puede honrar el
    rumbo laxamente.
    """

    # extra="forbid": una coordenada o campo colado (x, y, faction…) rechaza la
    # orden entera en vez de ignorarse — la frontera de autoridad falla cerrado.
    model_config = ConfigDict(extra="forbid")

    op: Literal["spawn_encounter"]
    archetype: EncounterArchetype
    bearing: EncounterBearing | None = None

    def lua(self) -> str:
        bearing = f'"{self.bearing.value}"' if self.bearing is not None else "nil"
        return (
            "local storage = getScriptStorage()\n"
            "local integration = storage and storage.espaciokoop_lagunak\n"
            "local spawn = integration and integration.spawnEncounter\n"
            "if type(spawn) ~= 'function' then\n"
            "  return '{\"ok\":false,\"reason\":\"not_supported\"}'\n"
            "end\n"
            "local ship = getPlayerShip(-1)\n"
            "if ship == nil then return '{\"ok\":false,\"reason\":\"no_ship\"}' end\n"
            f'local ok = spawn("{self.archetype.value}", {bearing})\n'
            "if ok then return '{\"ok\":true}' end\n"
            "return '{\"ok\":false,\"reason\":\"not_supported\"}'"
        )


class ShipAnchor(str, Enum):
    """Catálogo cerrado de anclas con nombre a las que el GM puede reposicionar
    la nave del jugador (#176).

    Foundry decide el *dónde* eligiendo un nombre del catálogo; el escenario es
    dueño de la coordenada exacta que ese nombre resuelve. Nunca se aceptan
    coordenadas crudas desde el cliente: el ADR de encuentros ya fijó que
    aceptar ``x``/``y`` para la nave sería doble autoridad sobre su posición
    (ADR-0002). El nombre nombrado es además la forma en que un GM piensa la
    mesa ("llévalos al pecio"), no un par de flotantes.
    """

    lagunak = "lagunak"
    argia = "argia"


class RepositionShip(BaseModel):
    """Reposición de la nave del jugador a un ancla nombrada: palanca puntual
    del GM (#176).

    Misma figura aceptada que ``set_system_health``: una escritura GM sobre la
    verdad de la nave (ADR-0002), orden única en vuelo, no un bucle de
    sincronización. El Lua emitido es fijo y solo llama al callback que el
    escenario publica en ``getScriptStorage()`` — la misma frontera compartida
    con ``/exec.lua`` que usa ``spawn_encounter``. Si el escenario no registra
    el callback, degrada honestamente a ``not_supported``.
    """

    # extra="forbid": una coordenada colada (x, y) o cualquier campo extra
    # rechaza la orden entera en vez de ignorarse — la frontera de autoridad
    # falla cerrado.
    model_config = ConfigDict(extra="forbid")

    op: Literal["reposition_ship"]
    anchor: ShipAnchor

    def lua(self) -> str:
        return (
            "local storage = getScriptStorage()\n"
            "local integration = storage and storage.espaciokoop_lagunak\n"
            "local reposition = integration and integration.repositionShip\n"
            "if type(reposition) ~= 'function' then\n"
            "  return '{\"ok\":false,\"reason\":\"not_supported\"}'\n"
            "end\n"
            "local ship = getPlayerShip(-1)\n"
            "if ship == nil then return '{\"ok\":false,\"reason\":\"no_ship\"}' end\n"
            f'local ok = reposition("{self.anchor.value}")\n'
            "if ok then return '{\"ok\":true}' end\n"
            "return '{\"ok\":false,\"reason\":\"not_supported\"}'"
        )


class SetPause(BaseModel):
    op: Literal["set_pause"]
    paused: StrictBool

    def lua(self) -> str:
        call = "pauseGame()" if self.paused else "unpauseGame()"
        return f"{call}\nreturn '{{\"ok\":true}}'"


Command = Annotated[
    Union[
        SetImpulse,
        SetWarp,
        SetTargetHeading,
        SetShields,
        SetSystemPower,
        SetSystemHealth,
        SpawnEncounter,
        RepositionShip,
        SetPause,
    ],
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


@app.get("/v1/contacts", dependencies=[Depends(_require_auth)])
async def contacts() -> Any:
    return await _run_lua(_CONTACTS_LUA)


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
