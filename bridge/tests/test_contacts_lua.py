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
ship_obj.typeName = "PlayerSpaceship"
local npc_dup = obj("Itsaso 1", "Kraylor", 100.0, 200.0, false)
npc_dup.typeName = "CpuShip"

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
    # typeName es opcional: se publica cuando el objeto lo expone y queda
    # null cuando no (el asteroide del mundo falso no lo define).
    assert contactos[0]["type"] == "PlayerSpaceship"
    npc = next(c for c in contactos if c["callsign"] == "Itsaso 1" and not c["is_player"])
    assert npc["type"] == "CpuShip"
    assert asteroide["type"] is None


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
