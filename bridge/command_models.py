"""Órdenes de lista blanca de /v1/command: modelos Pydantic y su Lua fijo.

Extraído de app.py (misma extracción mecánica que bridge/lua_templates.py):
ninguna validación ni Lua emitido cambia, solo su ubicación.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, StrictBool

from lua_templates import (
    _command_lua,
    _find_target_lua,
    _fire_tube_lua,
    _scan_object_lua,
    _set_weapon_target_lua,
)


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


# Indicativo de un objeto cercano, tal como lo genera `generateCallSign`
# (letras, dígitos, espacio, apóstrofo, guion, punto). Compartido por toda
# orden que referencia un objetivo por indicativo (#462, #465): es el único
# identificador estable que `/v1/contacts` expone hoy, y esta whitelist de
# caracteres es lo que impide que un valor arbitrario del cliente se cuele en
# el Lua fijo del servidor (`_find_target_lua`) — no hace falta reenviar Lua
# ajeno, solo comparar un nombre.
CallsignField = Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[\w .'-]+$")]

# Índice de tubo de armas: no negativo y con una cota defensiva (no un límite
# real del juego, que no expone cuántos tubos tiene cada plantilla de nave por
# esta vía) — el propio juego rechaza sin efecto un índice que la nave no
# tenga (playerInfo.cpp), así que esta cota solo evita valores absurdos antes
# de llegar ahí.
TubeIndexField = Annotated[int, Field(strict=True, ge=0, le=15)]


class ScanObject(BaseModel):
    """Orden de escaneo de ciencia (#462): traduce ``ship:commandScan(target)``
    -ya validado server-side por el propio juego, igual que cualquier orden de
    tripulación- a una orden del contrato del puente.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["scan_object"]
    callsign: CallsignField

    def lua(self) -> str:
        return _scan_object_lua(self.callsign)


class SetWeaponTarget(BaseModel):
    """Fija el objetivo de armas (#465): traduce ``ship:commandSetTarget``.

    Habilita el fuego automático de los haces (beams) ya cargados y con arco
    de tiro. No dispara tubos de misiles por sí sola — para eso está
    ``fire_tube``, que además fija su propio objetivo con el mismo indicativo
    en la misma llamada.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["set_weapon_target"]
    callsign: CallsignField

    def lua(self) -> str:
        return _set_weapon_target_lua(self.callsign)


class FireTube(BaseModel):
    """Dispara un tubo de misiles contra un objetivo (#465): traduce
    ``ship:commandFireTubeAtTarget(index, target)``.

    Sin comprobar aquí si el tubo existe o está cargado -el juego ya lo
    valida server-side y no tiene efecto si no procede, el mismo contrato que
    el resto de órdenes de este archivo-.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["fire_tube"]
    callsign: CallsignField
    index: TubeIndexField

    def lua(self) -> str:
        return _fire_tube_lua(self.callsign, self.index)


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


class AnswerCommHail(BaseModel):
    """Contestar o ignorar una llamada entrante (#463): globals de
    `PlayerInfo::commandAnswerCommHail`, ya registrados por el motor en todo
    escenario — no hace falta cooperación de `getScriptStorage()`.
    """

    op: Literal["answer_comm_hail"]
    accept: StrictBool

    def lua(self) -> str:
        return _command_lua(f"commandAnswerCommHail(ship, {str(self.accept).lower()})")


class CloseComm(BaseModel):
    """Cerrar/cancelar/reconocer el canal activo (#463)."""

    op: Literal["close_comm"]

    def lua(self) -> str:
        return _command_lua("commandCloseTextComm(ship)")


class SendCommReply(BaseModel):
    """Elegir una opción de diálogo scripteado por su índice (#463).

    `strict=True`: mismo motivo que `SetSystemHealth.value` — sin coacción de
    booleanos. El índice corresponde al orden en que el escenario las añadió
    con `addCommsReply()`; el puente no conoce la lista, el motor la valida
    server-side (un índice fuera de las opciones reales no tiene efecto).
    """

    op: Literal["send_comm_reply"]
    index: Annotated[int, Field(strict=True, ge=0, le=15)]

    def lua(self) -> str:
        return _command_lua(f"commandSendComm(ship, {self.index})")


class SendCommMessage(BaseModel):
    """Mensaje de chat libre a otra nave/GM con canal ya abierto (#463).

    El límite de longitud es una cota de sanidad del puente, no una que
    imponga el motor.
    """

    op: Literal["send_comm_message"]
    message: Annotated[str, Field(min_length=1, max_length=256)]

    def lua(self) -> str:
        escaped = self.message.replace("\\", "\\\\").replace("'", "\\'")
        return _command_lua(f"commandSendCommPlayer(ship, '{escaped}')")


# --- Relay (#517) ------------------------------------------------------------
#
# Coordenada del mundo del juego. Cota defensiva y deliberadamente holgada: el
# mapa de un escenario cabe de sobra dentro, y su papel no es acotar el juego
# sino impedir que un valor absurdo (o un infinito/NaN, que Pydantic ya rechaza
# al exigir float finito) llegue al `string.format` del Lua fijo. El juego es
# quien decide qué hace con una coordenada lejana.
#
# Importante: esto NO es la reposición de nave que ADR-0002 prohíbe pedir con
# coordenadas crudas. Un punto de ruta o una sonda son marcas que el propio
# tripulante coloca sobre SU radar; no mueven la nave ni escriben la verdad de
# su posición. La autoridad sobre dónde está la nave sigue entera en el juego.
CoordinateField = Annotated[float, Field(allow_inf_nan=False, ge=-500_000.0, le=500_000.0)]

# Índice de punto de ruta. Cota defensiva, no un límite del juego: el motor ya
# ignora sin efecto un índice que no exista (`luaCommandRemoveWaypoint` compara
# contra el tamaño real de la lista antes de tocarla).
WaypointIndexField = Annotated[int, Field(strict=True, ge=0, le=63)]


class AddWaypoint(BaseModel):
    """Coloca un punto de ruta (#517): `commandAddWaypoint`, global ya
    registrada por el motor (`src/script.cpp`).

    Los puntos de ruta son la moneda de coordinación de Relay con el resto del
    puente ("rumbo al waypoint 3"), y hasta ahora no había forma de crearlos
    desde Foundry.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["add_waypoint"]
    x: CoordinateField
    y: CoordinateField

    def lua(self) -> str:
        return _command_lua(f"commandAddWaypoint(ship, {self.x:.1f}, {self.y:.1f})")


class MoveWaypoint(BaseModel):
    """Mueve un punto de ruta ya colocado (#517): `commandMoveWaypoint`."""

    model_config = ConfigDict(extra="forbid")

    op: Literal["move_waypoint"]
    index: WaypointIndexField
    x: CoordinateField
    y: CoordinateField

    def lua(self) -> str:
        return _command_lua(
            f"commandMoveWaypoint(ship, {self.index}, {self.x:.1f}, {self.y:.1f})"
        )


class RemoveWaypoint(BaseModel):
    """Borra un punto de ruta por índice (#517): `commandRemoveWaypoint`."""

    model_config = ConfigDict(extra="forbid")

    op: Literal["remove_waypoint"]
    index: WaypointIndexField

    def lua(self) -> str:
        return _command_lua(f"commandRemoveWaypoint(ship, {self.index})")


class LaunchProbe(BaseModel):
    """Lanza una sonda hacia una coordenada (#517): `commandLaunchProbe`.

    Decisión con coste real: la nave lleva un número finito de sondas y el
    juego valida el stock server-side. El puente no lleva la cuenta — inventarla
    aquí sería una segunda verdad sobre el inventario de la nave.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["launch_probe"]
    x: CoordinateField
    y: CoordinateField

    def lua(self) -> str:
        return _command_lua(f"commandLaunchProbe(ship, {self.x:.1f}, {self.y:.1f})")


class SetScienceLink(BaseModel):
    """Enlaza una sonda ya lanzada al radar de ciencia (#517):
    `commandSetScienceLink`.

    Es cooperación entre puestos incorporada al motor: Relay lanza y enlaza,
    Ciencia mira por ella. La sonda se referencia por indicativo, con el mismo
    `CallsignField` y el mismo `_find_target_lua` que `scan_object` — el puente
    no acepta entidades del cliente, solo compara un nombre dentro de Lua fijo.

    Si el indicativo no corresponde a una sonda, el motor ignora el enlace: el
    puente no distingue tipos de objeto y no debe fingir que sí.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["set_science_link"]
    callsign: CallsignField

    def lua(self) -> str:
        return (
            _find_target_lua(self.callsign)
            + "commandSetScienceLink(ship, target)\n"
            + 'return \'{"ok":true}\''
        )


class ClearScienceLink(BaseModel):
    """Deshace el enlace sonda→ciencia (#517): `commandClearScienceLink`."""

    op: Literal["clear_science_link"]

    def lua(self) -> str:
        return _command_lua("commandClearScienceLink(ship)")


class AlertLevelName(str, Enum):
    """Niveles de alerta que acepta el motor.

    Catálogo cerrado y con los valores EXACTOS que `Convert<AlertLevel>::fromLua`
    (`src/script/enum.h`) reconoce en minúsculas. Importa más que en otras
    órdenes: ahí un valor desconocido no se ignora, llama a `luaL_error`. Un
    enum abierto convertiría una errata del cliente en un error de Lua.
    """

    normal = "normal"
    yellow = "yellow"
    red = "red"


class SetAlertLevel(BaseModel):
    """Fija el nivel de alerta de toda la nave (#517): `commandSetAlertLevel`.

    Es autoridad sobre la nave entera ejercida desde un solo puesto, y por eso
    vive en la matriz bajo `relay` y no en cualquier sitio.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["set_alert_level"]
    level: AlertLevelName

    def lua(self) -> str:
        return _command_lua(f'commandSetAlertLevel(ship, "{self.level.value}")')


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
        ScanObject,
        SetWeaponTarget,
        FireTube,
        AnswerCommHail,
        CloseComm,
        SendCommReply,
        SendCommMessage,
        AddWaypoint,
        MoveWaypoint,
        RemoveWaypoint,
        LaunchProbe,
        SetScienceLink,
        ClearScienceLink,
        SetAlertLevel,
    ],
    Field(discriminator="op"),
]
