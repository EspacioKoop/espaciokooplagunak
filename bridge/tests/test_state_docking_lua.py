"""Prueba adversarial del atraque publicado por /v1/state (#391).

El juego falso de ``test_endpoints.py`` devuelve el JSON que le inyectamos: no
ejecuta el Lua real, así que no vería si ``_STATE_LUA`` produce JSON válido ni si
normaliza bien el enum de ``DockingPort``. Aquí se ejecuta el Lua de verdad —el
mismo string que el puente envía a ``/exec.lua``— contra un mundo simulado.

Lo que se comprueba, y por qué cada cosa:

- que el enum se acepta con la forma que el binding produce de verdad —cadena en
  minúsculas con guión bajo, `src/script/enum.h`— y no una inventada: probar una
  forma que el juego no entrega deja pasar un atraque invisible en partida;
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
        # Lo que el binding entrega de verdad (enum.h): minúsculas con guión bajo.
        ('"docking"', "docking"),
        ('"docked"', "docked"),
        # Normalizado a minúsculas, para que una recapitalización aguas arriba
        # no apague el atraque en silencio.
        ('"Docking"', "docking"),
        ('"DOCKED"', "docked"),
    ],
)
def test_el_enum_se_normaliza_llegue_como_llegue(tmp_path, crudo, esperado):
    # Las cadenas del binding real son las minúsculas; las capitalizadas pasan
    # por la normalización. Aceptar solo una forma dejaría el atraque invisible.
    mundo = _mundo(
        "{ state = " + crudo + ", target = " + _objetivo_lua("Argia", "Station") + " }"
    )
    docking = _ejecutar_state_lua(tmp_path, mundo)["ship"]["docking"]
    assert docking["state"] == esperado
    assert docking["target"] == {"callsign": "Argia", "class": "Station"}


@pytest.mark.parametrize(
    "crudo",
    ['"not_docking"', '"none"', "nil", '"Undocking"', "1", "2", "7", "{}"],
)
def test_lo_que_no_se_reconoce_es_null_y_no_un_estado_inventado(tmp_path, crudo):
    # `not_docking` es «no está atracando»: publicar algo ahí haría que la consola
    # dibujara un atraque que no está pasando, que es peor que no dibujar. Los
    # números tampoco valen: el binding no los produce, y tomar un 1 cualquiera
    # por «atracando» convertiría un campo mal leído en un atraque inventado.
    mundo = _mundo("{ state = " + crudo + " }")
    assert _ejecutar_state_lua(tmp_path, mundo)["ship"]["docking"] is None


def test_sin_componente_de_atraque_no_hay_atraque(tmp_path):
    assert _ejecutar_state_lua(tmp_path, _CABECERA)["ship"]["docking"] is None


def test_atracando_sin_objetivo_legible_publica_el_estado(tmp_path):
    # «Estamos atracando» es cierto aunque no se sepa contra qué, y callarlo
    # entero perdería el dato que sí hay.
    docking = _ejecutar_state_lua(tmp_path, _mundo('{ state = "docking" }'))["ship"]["docking"]
    assert docking == {"state": "docking", "target": None}


def test_objetivo_sin_clase_publicada_conserva_el_indicativo(tmp_path):
    mundo = _mundo('{ state = "docked", target = ' + _objetivo_lua("Hondar 4", None) + " }")
    docking = _ejecutar_state_lua(tmp_path, mundo)["ship"]["docking"]
    assert docking["target"] == {"callsign": "Hondar 4", "class": None}


def test_un_indicativo_hostil_no_rompe_el_json(tmp_path):
    # El bug de `%q`, que escapa para Lua y no para JSON: si el escapador no
    # fuera el compartido, json.loads reventaría antes de llegar a la aserción.
    hostil = 'Bad" .. string.char(1) .. "\\\\Name'
    mundo = _mundo(
        '{ state = "docking", target = (function() local t = {} '
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
    # Y la forma EXACTA del enum, que es el bug que se colaría si solo se ancla
    # el nombre del campo: el binding escribe minúsculas con guión bajo, y una
    # plantilla que espere "Docking" publica `null` con las pruebas en verde.
    enum_h = (raiz / "src" / "script" / "enum.h").read_text(encoding="utf-8")
    assert 'case DockingPort::State::Docking: lua_pushstring(L, "docking")' in enum_h
    assert 'case DockingPort::State::Docked: lua_pushstring(L, "docked")' in enum_h
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
