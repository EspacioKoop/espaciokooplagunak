"""El alcance de radar publicado por /v1/state (#331 paso 3).

Sin este dato, degradar los contactos de la tripulación por distancia obligaría a
inventarse dos constantes, y una banda inventada es una mentira con forma de
sensor. Sale del componente `long_range_radar`, que el juego ya expone a Lua.

Se ejecuta el Lua REAL contra un mundo simulado: el juego falso de
``test_endpoints.py`` devuelve el JSON que le inyectamos y no vería un encoder
roto. Requiere intérprete Lua; si no lo hay, se salta.
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
    function o:getPosition() return 0.0, 0.0 end
    function o:getVelocity() return 0.0, 0.0 end
    function o:getHeading() return 0.0 end
    function o:getHull() return 100.0 end
    function o:getHullMax() return 100.0 end
    function o:getEnergyLevel() return 100.0 end
    function o:getEnergyLevelMax() return 100.0 end
    function o:getShieldsActive() return false end
    function o:getRepairCrewCount() return 0 end
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


def _interprete_lua():
    for nombre in ("lua5.3", "lua5.4", "lua"):
        ruta = shutil.which(nombre)
        if ruta:
            return ruta
    return None


def _ejecutar(tmp_path, componentes: str | None) -> dict:
    lua = _interprete_lua()
    if lua is None:
        pytest.skip("no hay intérprete Lua para probar el encoder real")
    mundo = _CABECERA
    if componentes is not None:
        mundo += f"\nship_obj.components = {componentes}\n"
    driver = mundo + "\nlocal function cuerpo()\n" + bridge._STATE_LUA + "\nend\nio.write(cuerpo())\n"
    ruta = tmp_path / "driver_radar.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    return json.loads(proc.stdout.decode("utf-8"))


def test_publica_los_dos_alcances(tmp_path):
    mundo = "{ long_range_radar = { short_range = 5000.0, long_range = 30000.0 } }"
    assert _ejecutar(tmp_path, mundo)["ship"]["radar"] == {
        "short_range": 5000.0,
        "long_range": 30000.0,
    }


def test_sin_componente_no_hay_radar(tmp_path):
    assert _ejecutar(tmp_path, None)["ship"]["radar"] is None
    assert _ejecutar(tmp_path, "{}")["ship"]["radar"] is None


@pytest.mark.parametrize(
    "componente",
    [
        "{ long_range_radar = { short_range = 5000.0 } }",
        "{ long_range_radar = { long_range = 30000.0 } }",
        '{ long_range_radar = { short_range = "cerca", long_range = 30000.0 } }',
        "{ long_range_radar = {} }",
    ],
)
def test_un_alcance_a_medias_es_null_entero(tmp_path, componente):
    # Medio radar no es un radar: con un solo alcance habría que completar el
    # otro a ojo, y esa constante inventada es justo lo que este dato evita.
    assert _ejecutar(tmp_path, componente)["ship"]["radar"] is None


def test_contrato_anclado_al_binding_real():
    """Si upstream renombra el componente, falla aquí y no en silencio."""
    raiz = Path(__file__).resolve().parents[2]
    components = (raiz / "src" / "script" / "components.cpp").read_text(encoding="utf-8")
    assert 'ComponentHandler<LongRangeRadar>::name("long_range_radar")' in components
    assert "BIND_MEMBER(LongRangeRadar, short_range)" in components
    assert "BIND_MEMBER(LongRangeRadar, long_range)" in components
    assert "ship.components.long_range_radar" in bridge._STATE_LUA
