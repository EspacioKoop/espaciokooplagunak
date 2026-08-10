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
    # #484: el unico arquetipo que no materializa UNA nave sino un grupo con su
    # propia maquina de estados en el escenario (la crisis multipuesto de la
    # Etapa B). Para esta frontera no cambia nada —sigue siendo un nombre de un
    # catalogo cerrado, sin coordenadas ni definicion de objeto desde el
    # cliente—, y esa es justamente la propiedad que se queria conservar: una
    # crisis coordinada no necesito abrir ni un campo nuevo hacia el puente.
    ambush = "ambush"


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


# --- Navegación: maniobra de combate y atraque (#519) -------------------------
#
# Ambas familias llaman a globales que el motor YA registraba en src/script.cpp:
# no hay una línea de C++ nueva. Es la misma figura que el resto del bloque de
# #516 — traducir a contrato de puente agencia nativa que Foundry no exponía.


class CombatManeuverBoost(BaseModel):
    """Empujón hacia adelante de la maniobra de combate (#519):
    ``commandCombatManeuverBoost``.

    Rango 0..1, el del propio juego: el eje de empuje del control nativo
    (``GuiCombatManeuver``, ``glm::vec2(1.0, 0.0)`` en Y) solo va hacia
    adelante. Un valor negativo aquí no es "marcha atrás", es una errata — y
    por eso se rechaza en vez de recortarse.

    Es un recurso que se gasta: ``CombatManeuveringThrusters::charge`` baja al
    usarlo y tarda ``charge_time`` en rellenarse. El puente no lleva esa cuenta
    (la publica ``/v1/state``, que sí la lee del juego); pedir empuje sin carga
    simplemente no tiene efecto, como cualquier otra orden que el motor valida
    server-side.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["combat_maneuver_boost"]
    amount: Annotated[float, Field(allow_inf_nan=False, ge=0.0, le=1.0)]

    def lua(self) -> str:
        return _command_lua(f"commandCombatManeuverBoost(ship, {self.amount:.3f})")


# --- Damage Control (#522) ----------------------------------------------------
#
# Coordenada de sala del interior de la nave. Entera y acotada: las plantas de
# EmptyEpsilon son rejillas pequeñas (el `Phobos M3P` del escenario declara doce
# salas), así que este rango es holgadísimo y solo está para que un valor absurdo
# no llegue al `string.format` del Lua fijo.
RoomCoordField = Annotated[int, Field(strict=True, ge=-128, le=128)]


class RoomPoint(BaseModel):
    """Una casilla del interior de la nave."""

    model_config = ConfigDict(extra="forbid")

    x: RoomCoordField
    y: RoomCoordField


class MoveRepairCrew(BaseModel):
    """Manda un equipo de reparación a otra sala (#522).

    **El equipo se identifica por DÓNDE ESTÁ, no por un índice.** El orden en que
    el motor devuelve las entidades no está garantizado, así que un índice podría
    referirse a un equipo distinto entre dos sondeos, y mover al equipo
    equivocado en mitad de una avería es peor que no mover a ninguno. Si en
    ``origin`` ya no hay equipo cuando la orden llega —porque echó a andar entre
    el sondeo y el clic— degrada a ``crew_not_found`` en vez de acertarle a otro.

    **No hace falta C++ nuevo**, en contra de lo que suponía el issue: el
    componente ``internal_crew`` expone ``target_position`` con SETTER
    (``BIND_MEMBER`` en ``src/script/components.cpp``), así que el Lua fijo del
    servidor escribe el destino directamente. Esa escritura es además la
    autoritativa: ``commandCrewSetTargetPosition`` existe para que un *cliente*
    se lo pida al servidor, y aquí ya estamos dentro del servidor.

    Lo que se fija es el DESTINO. Que el equipo llegue —puertas, ruta, tiempo— lo
    resuelve la simulación, y eso es lo que hace de esta una orden legítima y no
    un efecto instantáneo (contraste deliberado con el hackeo, ADR-0010).
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["move_repair_crew"]
    origin: RoomPoint
    destination: RoomPoint

    def lua(self) -> str:
        no_ship = '\'{"ok":false,"reason":"no_ship"}\''
        no_crew = '\'{"ok":false,"reason":"crew_not_found"}\''
        return (
            "local ship = getPlayerShip(-1)\n"
            f"if ship == nil then return {no_ship} end\n"
            "local elegido = nil\n"
            "for _, entidad in ipairs(getEntitiesWithComponent('internal_crew')) do\n"
            "  local ok, ic = pcall(function() return entidad.components.internal_crew end)\n"
            "  if ok and ic ~= nil and ic.ship == ship and elegido == nil\n"
            f"    and ic.position.x == {self.origin.x}"
            f" and ic.position.y == {self.origin.y} then\n"
            "    elegido = ic\n"
            "  end\n"
            "end\n"
            f"if elegido == nil then return {no_crew} end\n"
            f"elegido.target_position = {{x = {self.destination.x},"
            f" y = {self.destination.y}}}\n"
            "return '{\"ok\":true}'"
        )


class CombatManeuverStrafe(BaseModel):
    """Desplazamiento lateral de la maniobra de combate (#519):
    ``commandCombatManeuverStrafe``.

    Rango −1..1 (babor..estribor), el del eje X del control nativo. A
    diferencia del empuje, aquí el signo sí es información.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["combat_maneuver_strafe"]
    amount: Annotated[float, Field(allow_inf_nan=False, ge=-1.0, le=1.0)]

    def lua(self) -> str:
        return _command_lua(f"commandCombatManeuverStrafe(ship, {self.amount:.3f})")


class Dock(BaseModel):
    """Atraca con el objeto de este indicativo (#519): ``commandDock``.

    Mismo camino que ``scan_object``: el objetivo se referencia por indicativo
    y se resuelve dentro del Lua fijo con ``_find_target_lua``; el cliente
    nunca envía una entidad. Que el objeto admita atraque, esté en rango y sea
    de una facción que lo permita lo decide el juego — el puente solo pide.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["dock"]
    callsign: CallsignField

    def lua(self) -> str:
        return (
            _find_target_lua(self.callsign)
            + "commandDock(ship, target)\n"
            + 'return \'{"ok":true}\''
        )


class Undock(BaseModel):
    """Suelta amarras (#519): ``commandUndock``."""

    op: Literal["undock"]

    def lua(self) -> str:
        return _command_lua("commandUndock(ship)")


class AbortDock(BaseModel):
    """Cancela una maniobra de atraque en curso (#519): ``commandAbortDock``.

    Es una orden distinta de ``undock`` y no un sinónimo: cancela el
    *acercamiento* (estado ``docking``), mientras que ``undock`` suelta un
    atraque ya consumado (estado ``docked``). ``/v1/state`` publica cuál de los
    dos estados hay, así que la interfaz puede ofrecer la que toca.
    """

    op: Literal["abort_dock"]

    def lua(self) -> str:
        return _command_lua("commandAbortDock(ship)")


# --- Ingeniería: autodestrucción y frecuencia de escudos (#518) ---------------
#
# Las cuatro llaman a globales que el motor ya registraba en src/script.cpp: sin
# una línea de C++ nueva, como el resto del bloque de #516.


class ActivateSelfDestruct(BaseModel):
    """Arma la secuencia de autodestrucción (#518): ``commandActivateSelfDestruct``.

    Armarla NO destruye la nave: genera los códigos y arranca el ritual. La
    destrucción exige confirmar los tres (``SelfDestruct::max_codes``), y el
    motor reparte cada código a una posición de tripulación distinta. Es
    cooperación incorporada al motor, no una ceremonia añadida por el fork.
    """

    op: Literal["activate_self_destruct"]

    def lua(self) -> str:
        return _command_lua("commandActivateSelfDestruct(ship)")


class CancelSelfDestruct(BaseModel):
    """Desarma la secuencia (#518): ``commandCancelSelfDestruct``.

    El motor solo deja cancelar mientras la cuenta atrás no ha empezado
    (``countdown <= 0``): pasado ese punto ya no hay marcha atrás, y eso es
    parte del peso de la decisión, no un fallo que el puente deba tapar.
    """

    op: Literal["cancel_self_destruct"]

    def lua(self) -> str:
        return _command_lua("commandCancelSelfDestruct(ship)")


class ConfirmSelfDestructCode(BaseModel):
    """Confirma uno de los códigos de autodestrucción (#518):
    ``commandConfirmDestructCode``.

    **El puente no conoce los códigos y no puede conocerlos**: el componente
    ``SelfDestruct`` expone a Lua ``active``, ``countdown``, ``damage`` y
    ``size``, pero NO ``code`` ni ``confirmed`` (ver
    ``src/script/components.cpp``). Eso no es un obstáculo a rodear, es lo que
    mantiene el puzle en pie: quien teclea aquí un código tiene que haberlo
    leído en la pantalla nativa que se lo mostró a él, o habérselo oído a quien
    lo leyó. El motor comprueba que el código case con el índice, así que la
    validación de verdad no está aquí ni puede estarlo.

    ``strict=True`` en los dos campos: sin coacción de booleanos ni de cadenas.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["confirm_self_destruct_code"]
    # 0..2: SelfDestruct::max_codes es 3 (src/components/selfdestruct.h). El
    # motor vuelve a comprobar el rango antes de tocar nada.
    index: Annotated[int, Field(strict=True, ge=0, le=2)]
    # Los códigos del motor son uint32. La cota superior es la de ese tipo, no
    # una inventada: recortarla dejaría códigos legítimos sin poder teclearse.
    code: Annotated[int, Field(strict=True, ge=0, le=4_294_967_295)]

    def lua(self) -> str:
        return _command_lua(f"commandConfirmDestructCode(ship, {self.index}, {self.code})")


class SetShieldFrequency(BaseModel):
    """Recalibra los escudos a una frecuencia (#518):
    ``commandSetShieldFrequency``.

    Rango 0..20, el del propio juego (``BeamWeaponSys::max_frequency``).
    Decisión con coste real y no un ajuste: recalibrar arranca
    ``calibration_delay`` y **deja los escudos caídos mientras dura**. Elegir el
    momento es la decisión; el número solo es la mitad.
    """

    model_config = ConfigDict(extra="forbid")

    op: Literal["set_shield_frequency"]
    frequency: Annotated[int, Field(strict=True, ge=0, le=20)]

    def lua(self) -> str:
        return _command_lua(f"commandSetShieldFrequency(ship, {self.frequency})")


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
        CombatManeuverBoost,
        CombatManeuverStrafe,
        Dock,
        Undock,
        AbortDock,
        ActivateSelfDestruct,
        CancelSelfDestruct,
        ConfirmSelfDestructCode,
        SetShieldFrequency,
        AddWaypoint,
        MoveWaypoint,
        RemoveWaypoint,
        LaunchProbe,
        SetScienceLink,
        ClearScienceLink,
        SetAlertLevel,
        MoveRepairCrew,
    ],
    Field(discriminator="op"),
]
