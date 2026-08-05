"""Prueba adversarial de la auto-reparación publicada por /v1/state (#464/#466).

El juego falso de ``test_endpoints.py`` devuelve el JSON que le inyectamos: no
ejecuta el Lua real, así que no vería si ``_STATE_LUA`` lee bien
``internal_rooms.auto_repair_enabled``. Aquí se ejecuta el Lua de verdad —el
mismo string que el puente envía a ``/exec.lua``— contra un mundo simulado.

Lo que se comprueba, y por qué cada cosa:

- que un booleano legítimo (true/false) se publica tal cual;
- que sin componente ``internal_rooms``, o con un valor no booleano, se publica
  ``null`` y NO un estado inventado: el casco 3D de ingeniería (#419) pintaría
  una región "reparando" que no está pasando;
- que el Lua lee la MISMA ruta que el binding real registra
  (``src/script/components.cpp``), para no degenerar en ``null`` silencioso si
  upstream renombra el componente o el campo.

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


def _mundo(rooms_lua: str | None) -> str:
    if rooms_lua is None:
        return _CABECERA
    return _CABECERA + "\nship_obj.components = { internal_rooms = " + rooms_lua + " }\n"


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
    ruta = tmp_path / "driver_state_auto_repair.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    return json.loads(proc.stdout.decode("utf-8"))


@pytest.mark.parametrize("valor", [True, False])
def test_booleano_legitimo_se_publica_tal_cual(tmp_path, valor):
    crudo = "true" if valor else "false"
    mundo = _mundo("{ auto_repair_enabled = " + crudo + " }")
    assert _ejecutar_state_lua(tmp_path, mundo)["ship"]["auto_repair"] is valor


def test_sin_componente_internal_rooms_no_hay_auto_repair(tmp_path):
    assert _ejecutar_state_lua(tmp_path, _mundo(None))["ship"]["auto_repair"] is None


@pytest.mark.parametrize("crudo", ['"true"', "1", "0", "nil", "{}"])
def test_tipo_no_booleano_es_null_y_no_un_estado_inventado(tmp_path, crudo):
    # Un 1 leído como "activo" convertiría un campo mal tipado en una lectura
    # inventada; publicar null es lo honesto cuando el dato no es el esperado.
    mundo = _mundo("{ auto_repair_enabled = " + crudo + " }")
    assert _ejecutar_state_lua(tmp_path, mundo)["ship"]["auto_repair"] is None


def test_contrato_anclado_al_binding_real():
    """El Lua del puente lee la MISMA ruta que el juego registra.

    Si upstream renombra el componente o el campo, esto falla aquí en vez de
    degenerar en `auto_repair: null` silencioso en producción: el pcall del
    encoder se tragaría el error sin decir nada.
    """
    raiz = Path(__file__).resolve().parents[2]
    components = (raiz / "src" / "script" / "components.cpp").read_text(encoding="utf-8")
    assert 'ComponentHandler<InternalRooms>::name("internal_rooms")' in components
    assert "BIND_MEMBER(InternalRooms, auto_repair_enabled)" in components
    assert "ship.components.internal_rooms" in bridge._STATE_LUA
