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
  GET  /v1/encounters — catálogo cerrado de encuentros del GM (auth).
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
from starlette.responses import JSONResponse

from lua_templates import (
    _CONTACTS_LUA,
    _EVENTS_LUA,
    _HEALTH_LUA,
    _SCENARIO_LUA,
    _STATE_LUA,
    _command_lua,
)

EE_URL = os.environ.get("EE_URL", "http://game:8080")
BRIDGE_TOKEN = os.environ.get("BRIDGE_TOKEN", "")
BRIDGE_ALLOWED_ORIGINS = os.environ.get("BRIDGE_ALLOWED_ORIGINS", "")

EXEC_TIMEOUT_SECONDS = 5.0
MAX_GAME_RESPONSE_BYTES = 64 * 1024
MAX_REQUEST_BODY_BYTES = 16 * 1024
RATE_LIMIT_PER_SECOND = 10
RATE_LIMIT_BURST = 20


class _RequestBodyLimitMiddleware:
    """Rechaza cuerpos grandes antes de que el parser JSON los materialice.

    ``Content-Length`` permite fallar inmediatamente. Para peticiones sin esa
    cabecera o con transferencia fragmentada se leen como máximo ``max_bytes``
    y solo se entrega al parser un cuerpo ya acotado.
    """

    def __init__(self, application: Any, max_bytes: int) -> None:
        self.application = application
        self.max_bytes = max_bytes

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") != "http" or scope.get("method") not in {
            "POST",
            "PUT",
            "PATCH",
        }:
            await self.application(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        raw_length = headers.get(b"content-length")
        if raw_length is not None:
            try:
                if int(raw_length) > self.max_bytes:
                    await self._reject(scope, receive, send)
                    return
            except ValueError:
                # El servidor HTTP decide cómo tratar una cabecera malformada;
                # el contador de abajo sigue impidiendo saltarse el límite.
                pass

        body = bytearray()
        while True:
            message = await receive()
            if message.get("type") != "http.request":
                await self.application(scope, _replay_receive(message), send)
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > self.max_bytes:
                await self._reject(scope, receive, send)
                return
            body.extend(chunk)
            if not message.get("more_body", False):
                break

        delivered = False

        async def replay_body() -> dict[str, Any]:
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.application(scope, replay_body, send)

    @staticmethod
    async def _reject(scope: dict[str, Any], receive: Any, send: Any) -> None:
        response = JSONResponse(
            status_code=413,
            content={"detail": "Cuerpo de petición demasiado grande"},
        )
        await response(scope, receive, send)


def _replay_receive(message: dict[str, Any]):
    """Devuelve una función ASGI que reproduce una desconexión ya consumida."""

    async def replay() -> dict[str, Any]:
        return message

    return replay


app = FastAPI(
    title="Espaciokoop Lagunak — puente Foundry VTT",
    version="0.1.0",
    description=__doc__,
)
app.add_middleware(_RequestBodyLimitMiddleware, max_bytes=MAX_REQUEST_BODY_BYTES)


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


class SetSystemCoolant(BaseModel):
    """Reparto de refrigerante por sistema: la otra mitad de la gestión de
    ingeniería junto a `set_system_power`.

    El juego expone el refrigerante por sistema en `/v1/state` pero hasta ahora
    no había orden para asignarlo. Rango 0.0..10.0, el de EmptyEpsilon
    (`max_coolant_per_system` en `components/coolant.h`); el juego además lo
    recorta server-side a `min(max_coolant_per_system, coolant->max)`, así que
    esta cota es la envolvente segura del contrato, no la autoridad final.
    """

    op: Literal["set_system_coolant"]
    system: SystemName
    level: Annotated[float, Field(ge=0.0, le=10.0)]

    def lua(self) -> str:
        # Llamada de función global, no de método: /exec.lua corre en un
        # sub-entorno propio (ver httpScriptAccess.cpp) donde las extensiones
        # de metatabla de Entity (scripts/api/entity/playerspaceship.lua,
        # cargadas solo por el escenario vía require) no están disponibles;
        # src/script.cpp solo registra este símbolo como global vía
        # env.setGlobal, nunca como método EFT.
        return _command_lua(
            f'commandSetSystemCoolantRequest(ship, "{self.system.value}", {self.level:.3f})'
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

    Cada valor nuevo aquí solo se vuelve jugable cuando el escenario lo honra en
    su callback ``lagunakSpawnEncounter``; un arquetipo que el puente conoce pero
    el escenario no reconoce degrada a ``not_supported`` (nunca inventa nada).
    """

    derelict = "derelict"
    patrol = "patrol"
    freighter = "freighter"
    sentry = "sentry"


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
        SetSystemCoolant,
        SetSystemHealth,
        SpawnEncounter,
        RepositionShip,
        SetPause,
    ],
    Field(discriminator="op"),
]


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
