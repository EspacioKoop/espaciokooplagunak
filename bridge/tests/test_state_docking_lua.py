"""Prueba adversarial del atraque publicado por /v1/state (#391).

El juego falso de ``test_endpoints.py`` devuelve el JSON que le inyectamos: no
ejecuta el Lua real, así que no vería si ``_STATE_LUA`` produce JSON válido ni si
normaliza bien el enum de ``DockingPort``. Aquí se ejecuta el Lua de verdad —el
mismo string que el puente envía a ``/exec.lua``— contra un mundo simulado.

Lo que se comprueba, y por qué cada cosa:

- que el enum se normaliza llegue como número o como cadena, porque el binding
  puede entregar cualquiera de las dos y de eso no manda el puente;
- que un valor no reconocido publica ``null`` y NO un estado inventado: la
  consola dibujaría un atraque que no está pasando;
- que un objetivo con indicativo hostil (comillas, control, barra) sigue saliendo
  como JSON válido, que es el bug de ``%q`` que ya cazó el encoder de contactos;
- que sin objetivo legible el estado se publica igualmente, porque «estamos
  atracando» es cierto aunque no se sepa contra qué.

Requiere un intérprete Lua; si no lo hay, se salta en vez de fallar.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

import app as bridge
import lua_templates

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


def _mundo(port_lua: str) -> str:
    return _CABECERA + "\nship_obj.components = { docking_port = " + port_lua + " }\n"


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
    ruta = tmp_path / "driver_state.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    return json.loads(proc.stdout.decode("utf-8"))


def _objetivo_lua(callsign: str, dock_class: str | None) -> str:
    clase = f'{{ dock_class = "{dock_class}" }}' if dock_class else "nil"
    return (
        "(function() local t = {} "
        f'function t:getCallSign() return "{callsign}" end '
        f"t.components = {{ docking_port = {clase} }} "
        "return t end)()"
    )


@pytest.mark.parametrize(
    "crudo,esperado",
    [
        ("1", "docking"),
        ('"Docking"', "docking"),
        ("2", "docked"),
        ('"Docked"', "docked"),
    ],
)
def test_el_enum_se_normaliza_llegue_como_llegue(tmp_path, crudo, esperado):
    # El binding puede entregar el enum como número o como cadena, y de eso no
    # manda el puente: aceptar solo una forma dejaría el atraque invisible según
    # cómo compile upstream.
    mundo = _mundo(
        "{ state = " + crudo + ", target = " + _objetivo_lua("Argia", "Station") + " }"
    )
    docking = _ejecutar_state_lua(tmp_path, mundo)["ship"]["docking"]
    assert docking["state"] == esperado
    assert docking["target"] == {"callsign": "Argia", "class": "Station"}


@pytest.mark.parametrize("crudo", ["0", "nil", '"Undocking"', "7", "{}"])
def test_lo_que_no_se_reconoce_es_null_y_no_un_estado_inventado(tmp_path, crudo):
    # `NotDocking` (0) es «no está atracando»: publicar algo ahí haría que la
    # consola dibujara un atraque que no está pasando, que es peor que no dibujar.
    mundo = _mundo("{ state = " + crudo + " }")
    assert _ejecutar_state_lua(tmp_path, mundo)["ship"]["docking"] is None


def test_sin_componente_de_atraque_no_hay_atraque(tmp_path):
    assert _ejecutar_state_lua(tmp_path, _CABECERA)["ship"]["docking"] is None


def test_atracando_sin_objetivo_legible_publica_el_estado(tmp_path):
    # «Estamos atracando» es cierto aunque no se sepa contra qué, y callarlo
    # entero perdería el dato que sí hay.
    docking = _ejecutar_state_lua(tmp_path, _mundo("{ state = 1 }"))["ship"]["docking"]
    assert docking == {"state": "docking", "target": None}


def test_objetivo_sin_clase_publicada_conserva_el_indicativo(tmp_path):
    mundo = _mundo("{ state = 2, target = " + _objetivo_lua("Hondar 4", None) + " }")
    docking = _ejecutar_state_lua(tmp_path, mundo)["ship"]["docking"]
    assert docking["target"] == {"callsign": "Hondar 4", "class": None}


def test_un_indicativo_hostil_no_rompe_el_json(tmp_path):
    # El bug de `%q`, que escapa para Lua y no para JSON: si el escapador no
    # fuera el compartido, json.loads reventaría antes de llegar a la aserción.
    hostil = 'Bad" .. string.char(1) .. "\\\\Name'
    mundo = _mundo(
        "{ state = 1, target = (function() local t = {} "
        f'function t:getCallSign() return "{hostil}" end '
        "return t end)() }"
    )
    docking = _ejecutar_state_lua(tmp_path, mundo)["ship"]["docking"]
    assert docking["target"]["callsign"] == 'Bad\x01\\Name'


def test_contrato_anclado_al_binding_real():
    """El Lua del puente lee la MISMA ruta que el juego registra.

    Si upstream renombra el componente o el campo, esto falla aquí en vez de
    degenerar en `docking: null` silencioso en producción: el pcall del encoder
    se tragaría el error sin decir nada.
    """
    raiz = Path(__file__).resolve().parents[2]
    components = (raiz / "src" / "script" / "components.cpp").read_text(encoding="utf-8")
    assert 'ComponentHandler<DockingPort>::name("docking_port")' in components
    assert "BIND_MEMBER(DockingPort, state)" in components
    assert "BIND_MEMBER(DockingPort, target)" in components
    assert "object.components.docking_port" in bridge._CONTACTS_LUA
    assert "ship.components.docking_port" in bridge._STATE_LUA


def test_el_escapador_json_es_uno_solo():
    """Dos copias del escapador se separan en cuanto alguien arregle una."""
    assert bridge._STATE_LUA.count("local function json_escape") == 1
    assert bridge._CONTACTS_LUA.count("local function json_escape") == 1
    # Se mira la constante en su módulo y no un reexport del puente: lo que se
    # está fijando es que las dos plantillas comparten ESTE escapador.
    assert lua_templates._JSON_ESCAPE_LUA in bridge._STATE_LUA
    assert lua_templates._JSON_ESCAPE_LUA in bridge._CONTACTS_LUA
