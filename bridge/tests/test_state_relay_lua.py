"""Prueba adversarial de lo que /v1/state publica para Relay (#517).

Dos campos, y los dos existen por la misma razón: el puesto que toma una
decisión tiene que poder leer su resultado en vez de suponerlo.

- ``alert_level``: la condición DECLARADA por la tripulación. No es el nivel que
  el módulo Foundry deriva del daño (`nivel-alerta.mjs`, #338) — aquello dice
  cómo está la nave, esto dice en qué postura la han puesto. Se normaliza a los
  mismos valores que acepta la orden ``set_alert_level`` para que el contrato
  sea uno solo en las dos direcciones.
- ``probes``: sondas restantes y máximo. Lanzar una es una decisión con coste, y
  "quedan 3" sin saber de cuántas es media frase.

Mismo método que ``test_state_auto_repair_lua.py``: se ejecuta el Lua real
contra un mundo simulado, porque el juego falso devuelve el JSON que le
inyectamos y no vería un error de lectura. Requiere un intérprete Lua; si no lo
hay, se salta en vez de fallar.
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
    ruta = tmp_path / "driver_state_relay.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    return json.loads(proc.stdout.decode("utf-8"))


# --- alert_level --------------------------------------------------------------


@pytest.mark.parametrize(
    "crudo,esperado",
    [
        ("Normal", "normal"),
        ("YELLOW ALERT", "yellow"),
        ("RED ALERT", "red"),
        # El binding entrega las de `toLua`, pero `fromLua` también acepta las
        # cortas: normalizar las dos deja el campo a salvo de que upstream
        # cambie de una forma a la otra.
        ("yellow", "yellow"),
        ("red", "red"),
    ],
)
def test_nivel_declarado_se_normaliza_al_vocabulario_de_la_orden(tmp_path, crudo, esperado):
    mundo = _mundo('{ player_control = { alert_level = "' + crudo + '" } }')
    assert _ejecutar_state_lua(tmp_path, mundo)["ship"]["alert_level"] == esperado


@pytest.mark.parametrize("crudo", ['"AZUL"', '""', "nil", "5", "{}"])
def test_nivel_desconocido_es_null_y_no_normal(tmp_path, crudo):
    # Caer a "normal" ante lo que no se entiende sería lo peor posible: diría
    # que la nave está tranquila justo cuando no se sabe si lo está.
    mundo = _mundo("{ player_control = { alert_level = " + crudo + " } }")
    assert _ejecutar_state_lua(tmp_path, mundo)["ship"]["alert_level"] is None


def test_sin_componente_player_control_no_hay_nivel(tmp_path):
    assert _ejecutar_state_lua(tmp_path, _mundo(None))["ship"]["alert_level"] is None


# --- probes -------------------------------------------------------------------


def test_sondas_publican_stock_y_maximo(tmp_path):
    mundo = _mundo("{ scan_probe_launcher = { stock = 3, max = 8 } }")
    assert _ejecutar_state_lua(tmp_path, mundo)["ship"]["probes"] == {"stock": 3, "max": 8}


def test_sin_sondas_es_cero_y_no_ausencia(tmp_path):
    # Aquí la distinción va al revés que en la carga de maniobra: cero sondas es
    # una lectura legítima y frecuente (se han gastado), y debe llegar como 0.
    mundo = _mundo("{ scan_probe_launcher = { stock = 0, max = 8 } }")
    assert _ejecutar_state_lua(tmp_path, mundo)["ship"]["probes"] == {"stock": 0, "max": 8}


@pytest.mark.parametrize(
    "crudo",
    ['{ stock = "3", max = 8 }', "{ stock = 3 }", "{ max = 8 }", "{}"],
)
def test_lanzador_incompleto_o_mal_tipado_es_null(tmp_path, crudo):
    mundo = _mundo("{ scan_probe_launcher = " + crudo + " }")
    assert _ejecutar_state_lua(tmp_path, mundo)["ship"]["probes"] is None


def test_sin_componente_lanzador_no_hay_sondas(tmp_path):
    assert _ejecutar_state_lua(tmp_path, _mundo(None))["ship"]["probes"] is None


def test_contrato_anclado_al_binding_real():
    """El Lua del puente lee las MISMAS rutas que el juego registra.

    Si upstream renombra un componente o un campo, esto falla aquí en vez de
    degenerar en `null` silencioso: los pcall se tragarían el error sin decir
    nada y Relay se quedaría sin lecturas sin que nadie supiera por qué.
    """
    raiz = Path(__file__).resolve().parents[2]
    components = (raiz / "src" / "script" / "components.cpp").read_text(encoding="utf-8")
    assert 'ComponentHandler<PlayerControl>::name("player_control")' in components
    assert "BIND_MEMBER(PlayerControl, alert_level)" in components
    assert 'ComponentHandler<ScanProbeLauncher>::name("scan_probe_launcher")' in components
    assert "BIND_MEMBER(ScanProbeLauncher, stock)" in components
    assert "BIND_MEMBER(ScanProbeLauncher, max)" in components
    assert "ship.components.player_control" in bridge._STATE_LUA
    assert "ship.components.scan_probe_launcher" in bridge._STATE_LUA
