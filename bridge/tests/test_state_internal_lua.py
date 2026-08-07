"""Prueba adversarial del interior de la nave publicado por /v1/state (#522).

Aquí se publica la PLANTA REAL del motor —salas con su posición, tamaño y
sistema— y la posición de cada equipo de reparación. Es lo que permite que
Damage Control en Foundry pinte el plano de esta nave y no uno parecido: la
sección de la nave del módulo (#427) tiene su propia planta declarativa, pensada
para andar por ella, y pintar equipos encima de aquella sería pintar sobre un
plano que no es este.

Se ejecuta el Lua real contra un mundo simulado. Requiere un intérprete Lua.
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

-- Constructores: una sala es {position, size, system}; un equipo, una entidad
-- con componente internal_crew que apunta a su nave.
local function sala(x, y, w, h, sistema)
    return { position = {x = x, y = y}, size = {x = w, y = h}, system = sistema }
end
local function equipo(nave_, px, py, tx, ty)
    local destino = nil
    if tx ~= nil then destino = {x = tx, y = ty} end
    return {
        components = {
            internal_crew = {
                ship = nave_,
                position = {x = px, y = py},
                target_position = destino,
            },
        },
    }
end
"""


def _interprete_lua():
    for nombre in ("lua5.3", "lua5.4", "lua"):
        ruta = shutil.which(nombre)
        if ruta:
            return ruta
    return None


def _ejecutar(tmp_path, cuerpo: str) -> dict:
    lua = _interprete_lua()
    if lua is None:
        pytest.skip("no hay intérprete Lua para probar el encoder real")
    driver = (
        _CABECERA
        + cuerpo
        + "\nlocal function cuerpo()\n"
        + bridge._STATE_LUA
        + "\nend\nio.write(cuerpo())\n"
    )
    ruta = tmp_path / "driver_state_internal.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    return json.loads(proc.stdout.decode("utf-8"))


_NAVE_CON_INTERIOR = """
ship_obj.components = {
    internal_rooms = { sala(0, 0, 2, 1, "reactor"), sala(2, 0, 1, 1, nil) },
}
local equipos = {
    equipo(ship_obj, 0, 0, 2, 0),
    equipo(ship_obj, 1, 0, nil, nil),
}
function getEntitiesWithComponent(nombre) return equipos end
"""


def test_publica_la_planta_real_con_sistema_por_sala(tmp_path):
    interior = _ejecutar(tmp_path, _NAVE_CON_INTERIOR)["ship"]["internal"]
    assert interior["rooms"] == [
        {"x": 0, "y": 0, "w": 2, "h": 1, "system": "reactor"},
        # Una sala sin sistema publica null, no una cadena vacía: "pasillo" y
        # "sala del reactor" no se distinguirían.
        {"x": 2, "y": 0, "w": 1, "h": 1, "system": None},
    ]


def test_cada_equipo_lleva_donde_esta_y_adonde_va(tmp_path):
    interior = _ejecutar(tmp_path, _NAVE_CON_INTERIOR)["ship"]["internal"]
    assert interior["crews"] == [
        {"position": {"x": 0, "y": 0}, "target": {"x": 2, "y": 0}},
        # Sin destino va null: un equipo parado no está yendo a su propia
        # casilla, simplemente no va a ninguna parte.
        {"position": {"x": 1, "y": 0}, "target": None},
    ]


def test_los_equipos_de_otras_naves_no_se_publican(tmp_path):
    # Sin este filtro, Damage Control vería moverse por su plano a gente que no
    # está en su nave.
    cuerpo = """
ship_obj.components = { internal_rooms = { sala(0, 0, 1, 1, nil) } }
local otra = {}
local equipos = { equipo(ship_obj, 0, 0, nil, nil), equipo(otra, 5, 5, nil, nil) }
function getEntitiesWithComponent(nombre) return equipos end
"""
    interior = _ejecutar(tmp_path, cuerpo)["ship"]["internal"]
    assert len(interior["crews"]) == 1
    assert interior["crews"][0]["position"] == {"x": 0, "y": 0}


def test_sin_interior_no_se_publica_una_planta_vacia(tmp_path):
    # Una nave sin salas no es una nave con cero salas: Damage Control debe
    # decir "esta nave no tiene interior", no pintar un plano en blanco.
    cuerpo = "function getEntitiesWithComponent(nombre) return {} end\n"
    assert _ejecutar(tmp_path, cuerpo)["ship"]["internal"] is None


def test_una_nave_con_salas_pero_sin_equipos_si_publica_su_planta(tmp_path):
    # El plano sirve aunque no haya nadie que mover: es la vista de la nave.
    cuerpo = """
ship_obj.components = { internal_rooms = { sala(0, 0, 1, 1, "impulse") } }
function getEntitiesWithComponent(nombre) return {} end
"""
    interior = _ejecutar(tmp_path, cuerpo)["ship"]["internal"]
    assert len(interior["rooms"]) == 1
    assert interior["crews"] == []


def test_contrato_anclado_al_binding_real():
    """Las rutas que lee el Lua son las que el juego registra, y
    `target_position` tiene SETTER — que es lo que permite que #522 no necesite
    una línea de C++ nueva.

    Si upstream renombrara el componente o quitara el setter, esto falla aquí en
    vez de degenerar en una orden que no hace nada.
    """
    raiz = Path(__file__).resolve().parents[2]
    components = (raiz / "src" / "script" / "components.cpp").read_text(encoding="utf-8")
    assert 'ComponentHandler<InternalCrew>::name("internal_crew")' in components
    assert "BIND_MEMBER(InternalCrew, position)" in components
    assert "BIND_MEMBER(InternalCrew, target_position)" in components
    assert "BIND_MEMBER(InternalCrew, ship)" in components
    assert "BIND_ARRAY_DIRTY_FLAG_MEMBER(InternalRooms, rooms, position, rooms_dirty)" in components
    # BIND_MEMBER define lector Y escritor; sin el segundo, `target_position`
    # sería de solo lectura y la orden de #522 no podría existir sin C++.
    macro = components[components.index("#define BIND_MEMBER(T, MEMBER)"):][:600]
    assert macro.count("[](lua_State* L,") >= 2
    assert "ship.components.internal_rooms" in bridge._STATE_LUA
    assert "getEntitiesWithComponent(\"internal_crew\")" in bridge._STATE_LUA
