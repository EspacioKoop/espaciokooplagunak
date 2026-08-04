"""Prueba adversarial del encoder Lua de /v1/contacts.

Los tests de ``test_contacts.py`` usan el juego falso, que se limita a devolver
el JSON que le inyectamos: nunca ejecutan el Lua real, así que no ven si el
propio ``_CONTACTS_LUA`` genera JSON válido. Aquí ejecutamos el Lua real (el
mismo string que el puente envía a ``/exec.lua``) contra un mundo de juego
simulado en Lua, y comprobamos:

- que la salida es JSON válido incluso con caracteres de control, comillas y
  barras invertidas en indicativos y facciones (el bug de ``%q``, que escapa
  para Lua y no para JSON);
- que el jugador se marca por identidad de objeto y no por indicativo, de modo
  que una nave NPC con el mismo callsign no queda marcada como el jugador;
- que con más objetos que el límite se devuelven los MÁS CERCANOS ordenados
  (el índice espacial no garantiza orden), el jugador siempre entra aunque el
  índice lo devuelva el último, y el truncamiento queda declarado con
  ``truncated``/``total``.

Requiere un intérprete Lua (el mismo que la CI usa para ``luac -p``). Si no hay
ninguno, la prueba se salta en vez de fallar.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

import app as bridge

# Mundo de juego simulado en Lua. Cadena "raw" para que las barras invertidas
# lleguen intactas. Define los globales que el Lua del puente espera del juego
# (getPlayerShip / getObjectsInRadius) y objetos con métodos getCallSign /
# getPosition / getFaction. `ship_obj` es la MISMA tabla que devuelve
# getPlayerShip y que aparece en la lista, así que `object == ship` es identidad
# de referencia. `npc_dup` comparte indicativo con la nave del jugador pero es
# otra tabla: no debe salir como jugador. `hostile` lleva un carácter de
# control (0x01), una barra invertida y una comilla en el indicativo, y una
# comilla en la facción. `asteroid` no tiene getFaction: el pcall del puente lo
# convierte en faction:null.
_MUNDO_LUA = r"""
local function obj(cs, fac, x, y, sin_faccion)
    local o = {}
    function o:getCallSign() return cs end
    function o:getPosition() return x, y end
    if not sin_faccion then
        function o:getFaction() return fac end
    end
    return o
end
local ship_obj = obj("Itsaso 1", "Human Navy", 0.0, 0.0, false)
-- Mismo shape que el binding ECS real: components.typename.type_name
-- (src/script/components.cpp registra el componente; scripts/api/shipTemplate.lua
-- lo rellena al crear naves desde plantilla).
ship_obj.components = {
    typename = { type_name = "Phobos M3P" },
    docking_port = { dock_class = "Frigate", dock_subclass = "Cruiser" },
}
local npc_dup = obj("Itsaso 1", "Kraylor", 100.0, 200.0, false)
npc_dup.components = {
    typename = { type_name = "Adder MK5" },
    docking_port = { dock_class = "Starfighter", dock_subclass = "Gunship" },
}

local hostile = obj("Bad" .. string.char(1) .. "\\Name\"X", 'Pirati "Rossa"', -50.0, -60.0, false)
local asteroid = obj("?", nil, 300.0, 300.0, true)
local mundo = { ship_obj, npc_dup, hostile, asteroid }
function getPlayerShip(n) return ship_obj end
function getObjectsInRadius(x, y, r) return mundo end
"""


# Mundo grande: 80 objetos y la nave del jugador la ÚLTIMA de la lista (el
# índice espacial real no garantiza orden — este es el peor caso que la
# revisión pidió cubrir: sin ordenación, un `break` a 60 dejaría fuera al
# jugador y devolvería los 60 primeros del índice, no los más cercanos). Las
# distancias crecen con el índice (NPC-i a x=i*100), así "más cercano" es
# verificable: los 59 acompañantes deben ser los de índice más bajo, en orden.
_MUNDO_GRANDE_LUA = r"""
local function obj(cs, fac, x, y)
    local o = {}
    function o:getCallSign() return cs end
    function o:getPosition() return x, y end
    function o:getFaction() return fac end
    return o
end
local ship_obj = obj("Itsaso 1", "Human Navy", 0.0, 0.0)
local mundo = {}
for i = 1, 79 do
    mundo[#mundo + 1] = obj("NPC-" .. i, "Kraylor", i * 100.0, 0.0)
end
mundo[#mundo + 1] = ship_obj
function getPlayerShip(n) return ship_obj end
function getObjectsInRadius(x, y, r) return mundo end
"""


# Dos marcadores internos quedan más cerca que cualquier contacto jugable. Si
# consumieran cupo, desplazarían NPC-58/59 y declararían truncamiento falso.
_MUNDO_CON_MARCADORES_LUA = r"""
local function obj(cs, fac, x, y)
    local o = {}
    function o:getCallSign() return cs end
    function o:getPosition() return x, y end
    function o:getFaction() return fac end
    return o
end
local ship_obj = obj("Itsaso 1", "Human Navy", 0.0, 0.0)
local mundo = {
    ship_obj,
    obj("LAGUNAK_EVT_arrival_s90_654321", "Independent", 0.0, 0.0),
    obj("LAGUNAK_EVT_encounter_started_s90_654321_000002_derelict", "Independent", 0.0, 0.0),
}
for i = 1, 59 do
    mundo[#mundo + 1] = obj("NPC-" .. i, "Kraylor", i * 100.0, 0.0)
end
function getPlayerShip(n) return ship_obj end
function getObjectsInRadius(x, y, r) return mundo end
"""


# Mundo dedicado a `scan_state` (#462): tres objetivos con un componente
# `scan_state` de tres formas distintas -sin entrada para la facción propia,
# con entrada "fof", y sin componente en absoluto (fully scanned por
# defecto)- más la nave propia, que debe salir "full" sin mirar su propio
# componente (una nave no se escanea a sí misma).
_MUNDO_SCAN_LUA = r"""
local function obj(cs, fac, x, y, scan_state)
    local o = {}
    function o:getCallSign() return cs end
    function o:getPosition() return x, y end
    function o:getFaction() return fac end
    if scan_state ~= nil then
        o.components = { scan_state = scan_state }
    end
    return o
end
local ship_obj = obj("Itsaso 1", "Human Navy", 0.0, 0.0, nil)
function ship_obj:getFactionId() return "human-navy-id" end
-- Sin entrada para "human-navy-id": debe degradar a "none".
local sin_faccion_propia = obj(
    "Lapur 1", "Exuari", 100.0, 0.0,
    {{faction = "kraylor-id", state = "full"}}
)
local identificado_fof = obj(
    "Lapur 2", "Exuari", 200.0, 0.0,
    {{faction = "human-navy-id", state = "fof"}}
)
-- Sin `components` en absoluto: nace fully scanned (estación de escenario).
local sin_componente = obj("Argia", "Independent", 300.0, 0.0, nil)
local mundo = {ship_obj, sin_faccion_propia, identificado_fof, sin_componente}
function getPlayerShip(n) return ship_obj end
function getObjectsInRadius(x, y, r) return mundo end
"""


def test_scan_state_usa_el_estado_real_por_faccion_no_la_distancia(tmp_path):
    payload = _ejecutar_contacts_lua(tmp_path, mundo=_MUNDO_SCAN_LUA)
    contactos = {c["callsign"]: c for c in payload["contacts"]}

    assert contactos["Itsaso 1"]["scan_state"] == "full"  # la nave propia
    assert contactos["Lapur 1"]["scan_state"] == "none"  # sin entrada para mi facción
    assert contactos["Lapur 2"]["scan_state"] == "fof"  # identificado, no escaneado
    assert contactos["Argia"]["scan_state"] == "full"  # sin componente = ya escaneado


def _interprete_lua() -> str | None:
    for nombre in ("lua5.3", "lua5.4", "lua"):
        ruta = shutil.which(nombre)
        if ruta is not None:
            return ruta
    return None


def _ejecutar_contacts_lua(tmp_path, mundo: str = _MUNDO_LUA) -> dict:
    lua = _interprete_lua()
    if lua is None:
        pytest.skip("no hay intérprete Lua para probar el encoder real")
    # Envolvemos el Lua del puente (que hace `return ...`) en una función para
    # capturar su valor de retorno y escribirlo por stdout.
    driver = (
        mundo
        + "\nlocal function cuerpo()\n"
        + bridge._CONTACTS_LUA
        + "\nend\nio.write(cuerpo())\n"
    )
    ruta = tmp_path / "driver.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run(
        [lua, str(ruta)], capture_output=True, timeout=10
    )
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    # La aserción central: el Lua real produce JSON que json.loads acepta.
    return json.loads(proc.stdout.decode("utf-8"))


def test_encoder_lua_genera_json_valido_con_caracteres_hostiles(tmp_path):
    payload = _ejecutar_contacts_lua(tmp_path)
    contactos = payload["contacts"]
    assert len(contactos) == 4
    assert payload["truncated"] is False
    assert payload["total"] == 4

    hostile = next(c for c in contactos if c["callsign"].startswith("Bad"))
    # Carácter de control (0x01), barra invertida y comilla sobreviven el
    # viaje por JSON válido; con %q json.loads habría lanzado antes de llegar.
    assert hostile["callsign"] == "Bad\x01\\Name\"X"
    assert hostile["faction"] == 'Pirati "Rossa"'

    asteroide = next(c for c in contactos if c["callsign"] == "?")
    assert asteroide["faction"] is None
    # `type` sale del componente ECS `typename` (components.typename.type_name);
    # es opcional: las entidades sin el componente (el asteroide, y también el
    # hostile de este mundo, que ni siquiera define `components`) quedan null.
    assert contactos[0]["type"] == "Phobos M3P"
    assert contactos[0]["class"] == "Frigate"
    assert contactos[0]["subclass"] == "Cruiser"
    npc = next(c for c in contactos if c["callsign"] == "Itsaso 1" and not c["is_player"])
    assert npc["type"] == "Adder MK5"
    assert npc["class"] == "Starfighter"
    assert npc["subclass"] == "Gunship"
    assert asteroide["type"] is None
    assert asteroide["class"] is None
    assert asteroide["subclass"] is None
    hostile_c = next(c for c in contactos if c["callsign"].startswith("Bad"))
    assert hostile_c["type"] is None


def test_contrato_typename_anclado_al_binding_real():
    """El Lua del puente debe leer la MISMA ruta que el juego registra.

    Esta prueba fija el contrato en ambos extremos: el binding C++ que
    registra el componente `typename` con su campo `type_name`, y el
    encoder Lua que lo consume. Si upstream renombra el componente o el
    campo, esto falla aquí en vez de degenerar en `type: null` silencioso
    en producción (el pcall del encoder se tragaría el error).
    """
    raiz = Path(__file__).resolve().parents[2]
    components = (raiz / "src" / "script" / "components.cpp").read_text(encoding="utf-8")
    templates = (raiz / "scripts" / "api" / "shipTemplate.lua").read_text(encoding="utf-8")
    apply_template = (raiz / "scripts" / "api" / "entity" / "shiptemplatebasedobject.lua").read_text(encoding="utf-8")
    assert 'ComponentHandler<TypeName>::name("typename")' in components
    assert "BIND_MEMBER(TypeName, type_name)" in components
    assert 'ComponentHandler<DockingPort>::name("docking_port")' in components
    assert "BIND_MEMBER(DockingPort, dock_class)" in components
    assert "BIND_MEMBER(DockingPort, dock_subclass)" in components
    assert "self.typename = {type_name=name, localized=name}" in templates
    assert "self.docking_port =" in templates
    assert "comp[key] = value" in apply_template
    assert "object.components.typename.type_name" in bridge._CONTACTS_LUA
    assert "object.components.docking_port" in bridge._CONTACTS_LUA


def test_encoder_lua_identifica_al_jugador_por_objeto_no_por_indicativo(tmp_path):
    contactos = _ejecutar_contacts_lua(tmp_path)["contacts"]

    jugadores = [c for c in contactos if c["is_player"]]
    # Exactamente uno, encabezando la lista, y es la nave del jugador
    # (posición 0,0), no la NPC que comparte indicativo.
    assert len(jugadores) == 1
    assert contactos[0]["is_player"] is True
    assert jugadores[0]["position"] == {"x": 0.0, "y": 0.0}

    homonimos = [c for c in contactos if c["callsign"] == "Itsaso 1"]
    assert len(homonimos) == 2
    assert sum(1 for c in homonimos if c["is_player"]) == 1


def test_encoder_lua_ordena_por_distancia_e_incluye_al_jugador(tmp_path):
    # 80 objetos y el jugador el ÚLTIMO del índice espacial: aun así entra
    # (encabezando la lista), los 59 acompañantes son los MÁS CERCANOS en
    # orden de distancia creciente, y el truncamiento queda declarado.
    payload = _ejecutar_contacts_lua(tmp_path, mundo=_MUNDO_GRANDE_LUA)
    contactos = payload["contacts"]

    assert len(contactos) == 60
    assert payload["truncated"] is True
    assert payload["total"] == 80

    assert contactos[0]["is_player"] is True
    assert contactos[0]["callsign"] == "Itsaso 1"
    acompanantes = [c["callsign"] for c in contactos[1:]]
    assert acompanantes == [f"NPC-{i}" for i in range(1, 60)]
    assert all(not c["is_player"] for c in contactos[1:])


def test_encoder_lua_excluye_marcadores_de_evento_sin_consumir_cupo(tmp_path):
    payload = _ejecutar_contacts_lua(tmp_path, mundo=_MUNDO_CON_MARCADORES_LUA)
    contactos = payload["contacts"]

    assert len(contactos) == 60
    assert payload["total"] == 60
    assert payload["truncated"] is False
    assert all(not c["callsign"].startswith("LAGUNAK_EVT_") for c in contactos)
    assert [c["callsign"] for c in contactos[1:]] == [f"NPC-{i}" for i in range(1, 60)]
