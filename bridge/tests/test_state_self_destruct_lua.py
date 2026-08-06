"""Prueba adversarial de lo que /v1/state publica de autodestrucción y escudos
(#518).

Lo que de verdad se está fijando aquí es una AUSENCIA. El componente
``SelfDestruct`` expone a Lua ``active``, ``countdown``, ``damage`` y ``size``,
pero no ``code`` ni ``confirmed`` (``src/script/components.cpp``). Publicar los
códigos disolvería el puzle cooperativo del puesto —tres códigos, tres personas
distintas— y además la telemetría que el GM reparte a la tripulación viaja por
un ajuste de mundo que toda la mesa puede leer. Así que el campo se queda en
"está armada y queda esto", y hay una prueba de que nada más se cuela.

Mismo método que ``test_state_auto_repair_lua.py``: se ejecuta el Lua real
contra un mundo simulado. Requiere un intérprete Lua; si no lo hay, se salta.
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


def _mundo(componentes: str | None) -> str:
    if componentes is None:
        return _CABECERA
    return _CABECERA + "\nship_obj.components = " + componentes + "\n"


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
    ruta = tmp_path / "driver_state_self_destruct.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    return json.loads(proc.stdout.decode("utf-8"))


# --- self_destruct ------------------------------------------------------------


def test_secuencia_armada_publica_su_cuenta_atras(tmp_path):
    mundo = _mundo("{ self_destruct = { active = true, countdown = 42.5 } }")
    estado = _ejecutar_state_lua(tmp_path, mundo)["ship"]["self_destruct"]
    assert estado == {"active": True, "countdown": 42.5}


def test_sin_armar_no_se_publica_una_cuenta_atras(tmp_path):
    # `countdown` sin armar no significa "cero segundos para estallar". Un
    # consumidor que lo pintara diría que la nave va a reventar ya.
    mundo = _mundo("{ self_destruct = { active = false, countdown = 0 } }")
    estado = _ejecutar_state_lua(tmp_path, mundo)["ship"]["self_destruct"]
    assert estado == {"active": False, "countdown": None}


def test_sin_componente_no_hay_autodestruccion(tmp_path):
    # Una nave sin `SelfDestruct` no es una nave con la secuencia desarmada:
    # es una nave que no puede autodestruirse, y la consola no debe ofrecerlo.
    assert _ejecutar_state_lua(tmp_path, _mundo(None))["ship"]["self_destruct"] is None


@pytest.mark.parametrize("crudo", ['{ active = "true" }', "{ countdown = 10 }", "{}"])
def test_componente_mal_tipado_es_null(tmp_path, crudo):
    mundo = _mundo("{ self_destruct = " + crudo + " }")
    assert _ejecutar_state_lua(tmp_path, mundo)["ship"]["self_destruct"] is None


def test_los_codigos_no_salen_por_aqui_ni_aunque_esten_en_el_componente(tmp_path):
    # LA prueba de este archivo. Aunque un mundo (o un upstream futuro) ponga
    # los códigos al alcance, el encoder no los toca: lo que sale por /v1/state
    # acaba en un ajuste de mundo que toda la mesa puede leer.
    mundo = _mundo(
        "{ self_destruct = { active = true, countdown = 10,"
        " code = { 1111, 2222, 3333 }, confirmed = { true, false, false } } }"
    )
    crudo = json.dumps(_ejecutar_state_lua(tmp_path, mundo))
    assert "1111" not in crudo
    assert "2222" not in crudo
    assert "confirmed" not in crudo


# --- shield_calibration -------------------------------------------------------


def test_frecuencia_y_recalibrado_se_publican_juntos(tmp_path):
    mundo = _mundo("{ shields = { frequency = 12, calibration_delay = 3.5 } }")
    estado = _ejecutar_state_lua(tmp_path, mundo)["ship"]["shield_calibration"]
    assert estado == {"frequency": 12, "calibration_delay": 3.5}


def test_frecuencia_negativa_significa_sin_frecuencia_y_va_null(tmp_path):
    # -1 es el "estos escudos no tienen frecuencia" de src/components/shields.h.
    # Publicarlo como número lo pintaría como una frecuencia válida.
    mundo = _mundo("{ shields = { frequency = -1, calibration_delay = 0 } }")
    assert _ejecutar_state_lua(tmp_path, mundo)["ship"]["shield_calibration"] is None


def test_sin_componente_shields_no_hay_calibracion(tmp_path):
    assert _ejecutar_state_lua(tmp_path, _mundo(None))["ship"]["shield_calibration"] is None


def test_contrato_anclado_al_binding_real():
    """El Lua lee las MISMAS rutas que el juego registra, y la ausencia de
    `code`/`confirmed` en el binding queda afirmada aquí.

    Si upstream llegara a exponer los códigos, esta prueba falla y obliga a
    decidir a conciencia qué hacer con ellos, en vez de que empiecen a viajar
    solos el día que alguien amplíe el encoder.
    """
    raiz = Path(__file__).resolve().parents[2]
    components = (raiz / "src" / "script" / "components.cpp").read_text(encoding="utf-8")
    assert 'ComponentHandler<SelfDestruct>::name("self_destruct")' in components
    assert "BIND_MEMBER(SelfDestruct, active)" in components
    assert "BIND_MEMBER(SelfDestruct, countdown)" in components
    assert "BIND_MEMBER(SelfDestruct, code)" not in components
    assert "BIND_MEMBER(SelfDestruct, confirmed)" not in components
    assert "BIND_MEMBER(Shields, frequency)" in components
    assert "BIND_MEMBER(Shields, calibration_delay)" in components
    assert "ship.components.self_destruct" in bridge._STATE_LUA
    assert "ship.components.shields" in bridge._STATE_LUA
