"""Prueba adversarial de la carga de maniobra de combate en /v1/state (#519).

Mismo método que ``test_state_auto_repair_lua.py`` y por el mismo motivo: el
juego falso devuelve el JSON que le inyectamos, así que no vería si
``_STATE_LUA`` lee bien ``combat_maneuvering_thrusters.charge``. Aquí se ejecuta
el Lua real contra un mundo simulado.

Lo que importa de este campo en concreto: la consola de navegación necesita
saber cuánta maniobra queda ANTES de pedirla, y el criterio de #519 dice que ese
dato se lee, no se estima. Por eso la distinción entre `null` (no hay lectura) y
`0.0` (la hay, y es cero) no es cosmética: son dos frases distintas, y pintar la
segunda cuando solo se sabe la primera es inventar telemetría.

Requiere un intérprete Lua; si no lo hay, se salta en vez de fallar.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

import app as bridge

_CABECERA = r"""
local function nave(cs)
    local o = {}
    function o:getCallSign() return cs end
    function o:getPosition() return 10.0, 20.0 end
    function o:getVelocity() return 1.0, 2.0 end
    function o:getHeading() return 90.0 end
    function o:getHull() return 100.0 end
    function o:getHullMax() return 200.0 end
    function o:getEnergyLevel() return 500.0 end
    function o:getEnergyLevelMax() return 1000.0 end
    function o:getShieldsActive() return true end
    function o:getRepairCrewCount() return 3 end
    function o:getSystemHealth() return 1.0 end
    function o:getSystemHeat() return 0.0 end
    function o:getSystemPower() return 1.0 end
    function o:getSystemCoolant() return 0.0 end
    return o
end
local ship_obj = nave("Itsaso 1")
function getPlayerShip(n) return ship_obj end
function getObjectsInRadius(x, y, r) return {} end
"""


def _mundo(thrusters_lua: str | None) -> str:
    if thrusters_lua is None:
        return _CABECERA
    return (
        _CABECERA
        + "\nship_obj.components = { combat_maneuvering_thrusters = "
        + thrusters_lua
        + " }\n"
    )


def _interprete_lua():
    for nombre in ("lua5.3", "lua5.4", "lua"):
        ruta = shutil.which(nombre)
        if ruta:
            return ruta
    return None


def _ejecutar_state_lua(tmp_path, mundo: str) -> dict:
    lua = _interprete_lua()
    if lua is None:
        pytest.skip("no hay intérprete Lua para probar el encoder real")
    driver = (
        mundo
        + "\nlocal function cuerpo()\n"
        + bridge._STATE_LUA
        + "\nend\nio.write(cuerpo())\n"
    )
    ruta = tmp_path / "driver_state_combat_maneuver.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    return json.loads(proc.stdout.decode("utf-8"))


@pytest.mark.parametrize("crudo,esperado", [("1.0", 1.0), ("0.5", 0.5), ("0.0", 0.0)])
def test_carga_legitima_se_publica_tal_cual(tmp_path, crudo, esperado):
    mundo = _mundo("{ charge = " + crudo + " }")
    estado = _ejecutar_state_lua(tmp_path, mundo)["ship"]["combat_maneuver"]
    assert estado == {"charge": esperado}


def test_carga_cero_no_es_lo_mismo_que_ausencia(tmp_path):
    # El caso que motiva el campo: sin carga hay lectura y vale cero; sin
    # componente no hay lectura. Si estos dos coincidieran, la consola no
    # podría distinguir "no puedes maniobrar" de "no sé si puedes".
    con_cero = _ejecutar_state_lua(tmp_path, _mundo("{ charge = 0.0 }"))["ship"]
    sin_componente = _ejecutar_state_lua(tmp_path, _mundo(None))["ship"]
    assert con_cero["combat_maneuver"] == {"charge": 0.0}
    assert sin_componente["combat_maneuver"] is None


@pytest.mark.parametrize("crudo", ['"0.5"', "nil", "{}", "true"])
def test_tipo_no_numerico_es_null_y_no_una_carga_inventada(tmp_path, crudo):
    mundo = _mundo("{ charge = " + crudo + " }")
    assert _ejecutar_state_lua(tmp_path, mundo)["ship"]["combat_maneuver"] is None


def test_contrato_anclado_al_binding_real():
    """El Lua del puente lee la MISMA ruta que el juego registra.

    Si upstream renombra el componente o el campo, esto falla aquí en vez de
    degenerar en `combat_maneuver: null` silencioso: el pcall se tragaría el
    error sin decir nada, y la consola de navegación se quedaría para siempre
    sin lectura sin que nadie supiera por qué.
    """
    raiz = Path(__file__).resolve().parents[2]
    components = (raiz / "src" / "script" / "components.cpp").read_text(encoding="utf-8")
    assert (
        'ComponentHandler<CombatManeuveringThrusters>::name("combat_maneuvering_thrusters")'
        in components
    )
    assert "BIND_MEMBER(CombatManeuveringThrusters, charge)" in components
    assert "ship.components.combat_maneuvering_thrusters" in bridge._STATE_LUA
