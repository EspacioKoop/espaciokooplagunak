"""Órdenes de lista blanca de /v1/command: modelos Pydantic y su Lua fijo.

Extraído de app.py (misma extracción mecánica que bridge/lua_templates.py):
ninguna validación ni Lua emitido cambia, solo su ubicación.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, StrictBool

from lua_templates import _command_lua


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


class SetAutoRepair(BaseModel):
    """Activa/desactiva el reparto automático de tripulación de reparación
    (#464): `commandSetAutoRepair`, global ya registrado por el motor
    (`src/script.cpp`). Con auto-reparación desactivada, los sistemas dañados
    no se reparan solos — la tripulación de ingeniería decide si confía en el
    reparto automático o se reserva el control (mover reparadores a mano sigue
    siendo cosa de la pantalla nativa; ese comando no está expuesto a Lua).
    """

    op: Literal["set_auto_repair"]
    enabled: StrictBool

    def lua(self) -> str:
        return _command_lua(f"commandSetAutoRepair(ship, {str(self.enabled).lower()})")


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
        SetAutoRepair,
    ],
    Field(discriminator="op"),
]
