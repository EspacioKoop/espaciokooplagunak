"""Vertical Lua de ``spawn_encounter`` entre escenario y ``/exec.lua``.

El endpoint heredado ejecuta otro entorno Lua, por lo que una global del
escenario no basta. Estas regresiones ejecutan el chunk real del puente con
Lua 5.3/5.4 y fijan ``getScriptStorage()`` como frontera compartida.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import cast

import pytest

import app as bridge


def _interprete_lua() -> str | None:
    for nombre in ("lua5.3", "lua5.4", "lua"):
        ruta = shutil.which(nombre)
        if ruta is not None:
            return ruta
    return None


def _ejecutar_spawn_lua(tmp_path: Path, preambulo: str) -> dict:
    lua = _interprete_lua()
    if lua is None:
        pytest.skip("no hay intérprete Lua para probar el vertical real")
    lua = cast(str, lua)
    driver = (
        preambulo
        + "\nlocal function entorno_exec()\n"
        + bridge.SpawnEncounter(
            op="spawn_encounter",
            archetype=bridge.EncounterArchetype.derelict,
            bearing=bridge.EncounterBearing.port,
        ).lua()
        + "\nend\nio.write(entorno_exec())\n"
    )
    ruta = tmp_path / "spawn-driver.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    return json.loads(proc.stdout.decode("utf-8"))


def test_callback_publicado_en_storage_cruza_al_entorno_exec(tmp_path):
    payload = _ejecutar_spawn_lua(
        tmp_path,
        """
local storage = {}
function getScriptStorage() return storage end
function getPlayerShip(_) return {} end

-- Simula el entorno del escenario: el callback es local y solo se exporta
-- mediante ScriptStorage. El entorno exec no puede verlo como global.
local function registrar_escenario()
    local function spawn(arquetipo, rumbo)
        return arquetipo == "derelict" and rumbo == "port"
    end
    storage.espaciokoop_lagunak = { spawnEncounter = spawn }
end
registrar_escenario()
""",
    )
    assert payload == {"ok": True}


def test_global_del_escenario_no_sustituye_el_storage(tmp_path):
    payload = _ejecutar_spawn_lua(
        tmp_path,
        """
local storage = {}
function getScriptStorage() return storage end
function getPlayerShip(_) return {} end
function lagunakSpawnEncounter(_, _) return true end
""",
    )
    assert payload == {"ok": False, "reason": "not_supported"}


def test_callback_publicado_falla_cerrado_sin_nave(tmp_path):
    payload = _ejecutar_spawn_lua(
        tmp_path,
        """
local storage = {
    espaciokoop_lagunak = { spawnEncounter = function(_, _) return true end }
}
function getScriptStorage() return storage end
function getPlayerShip(_) return nil end
""",
    )
    assert payload == {"ok": False, "reason": "no_ship"}


def test_escenario_crea_y_conserva_marcador_de_evento(tmp_path):
    lua = _interprete_lua()
    if lua is None:
        pytest.skip("no hay intérprete Lua para probar el escenario real")
    lua = cast(str, lua)
    raiz = Path(__file__).resolve().parents[2]
    escenario = raiz / "scripts" / "scenario_90_lagunak_primera_guardia.lua"
    driver = f'''
package.preload["utils.lua"] = function() end
package.preload["lagunak_crisis_scenario_utility.lua"] = function() end
package.preload["public_domain_names_scenario_utility.lua"] = function()
    function getPublicDomainName(theme)
        assert(theme == "lovecraft" or theme == "verne")
        return theme == "lovecraft" and "Kadath" or "Nautilus"
    end
end
local wreck = nil
local marker = nil
local function entity(kind)
    local value = {{ kind = kind, x = 100, y = 200, heading = 30, valid = true }}
    return setmetatable(value, {{ __index = function(_, key)
        if key == "getPosition" then
            return function(self) return self.x, self.y end
        elseif key == "getHeading" then
            return function(self) return self.heading end
        elseif key == "isValid" then
            return function(self) return self.valid end
        end
        return function(self, ...)
            local args = {{...}}
            if key == "setPosition" then self.x, self.y = args[1], args[2] end
            if key == "setCallSign" then self.callsign = args[1] end
            if key == "setDescription" then self.description = args[1] end
            return self
        end
    end }})
end
function CpuShip() wreck = entity("wreck") return wreck end
function Artifact() marker = entity("marker") return marker end
local ship = entity("player")
function getPlayerShip(_) return ship end
assert(loadfile({json.dumps(str(escenario))}))()
eventoLlegadaId = "654321"
marcadoresEventosEncuentro = {{}}
contadorEncuentros = nil
assert(lagunakSpawnEncounter("derelict", "port") == true)
assert(wreck.callsign == "Hondar 1")
assert(wreck.description == "Kadath")
assert(marker.callsign == "LAGUNAK_EVT_encounter_started_s90_654321_000001_derelict")
assert(#marcadoresEventosEncuentro == 1)
local first_marker = marker
assert(lagunakSpawnEncounter("derelict", "ahead") == true)
assert(wreck.callsign == "Hondar 2")
assert(wreck.description == "Kadath")
assert(marker.callsign == "LAGUNAK_EVT_encounter_started_s90_654321_000002_derelict")
assert(#marcadoresEventosEncuentro == 2)
getPublicDomainName = function(_) error("tema retirado") end
assert(lagunakSpawnEncounter("freighter", "port") == true)
assert(wreck.callsign == "Merkatari 3")
assert(rawget(wreck, "description") == nil)
assert(#marcadoresEventosEncuentro == 2)
ship:setPosition(700, 800)
player = ship
actualizarMarcadoresEventosEncuentro()
assert(first_marker.x == 700 and first_marker.y == 800)
assert(marker.x == 700 and marker.y == 800)
io.write("ok")
'''
    ruta = tmp_path / "scenario-encounter-driver.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    assert proc.stdout == b"ok"


def test_escenario_despacha_ambush_a_la_crisis_y_no_a_la_tabla_de_nave_suelta(tmp_path):
    """`ambush` (#484) es un grupo con máquina de estados, no un arquetipo de una nave.

    Esta regresión existe porque el vertical de #484 llegó sin ninguna prueba de
    su propio despacho: lo único que rompió al añadirlo fue el `require` nuevo
    en los drivers de estos tests, y eso no dice nada sobre si el arquetipo hace
    lo que dice. Fija las dos mitades: que delega en la utilidad pasándole nave
    y rumbo, y que NO toca el camino de una sola nave (ni `CpuShip`, ni marcador
    de evento, ni el contador de encuentros).
    """
    lua = _interprete_lua()
    if lua is None:
        pytest.skip("no hay intérprete Lua para probar el escenario real")
    lua = cast(str, lua)
    raiz = Path(__file__).resolve().parents[2]
    escenario = raiz / "scripts" / "scenario_90_lagunak_primera_guardia.lua"
    driver = f'''
package.preload["utils.lua"] = function() end
package.preload["public_domain_names_scenario_utility.lua"] = function()
    function getPublicDomainName(_) return "Kadath" end
end
-- Doble de la utilidad: el escenario solo debe conocer su nombre y su contrato
-- (recibe nave y rumbo, devuelve una crisis o nil). La crisis de verdad se
-- prueba jugando (#467), no desde aquí.
local recibido = nil
local devolver = nil
package.preload["lagunak_crisis_scenario_utility.lua"] = function()
    function lagunakCrisisEmboscada(nave, rumbo)
        recibido = {{ nave = nave, rumbo = rumbo }}
        return devolver
    end
end
local naves = 0
local marcadores = 0
function CpuShip() naves = naves + 1 return setmetatable({{}}, {{ __index = function()
    return function(self) return self end
end }}) end
function Artifact() marcadores = marcadores + 1 return setmetatable({{}}, {{ __index = function()
    return function(self) return self end
end }}) end
local ship = {{}}
function ship:getPosition() return 10, 20 end
function ship:getHeading() return 0 end
function ship:isValid() return true end
function getPlayerShip(_) return ship end
assert(loadfile({json.dumps(str(escenario))}))()
eventoLlegadaId = "654321"
marcadoresEventosEncuentro = {{}}
crisisActivas = {{}}
contadorEncuentros = nil

-- 1) Despacho normal: delega y guarda la crisis viva.
devolver = {{ soyLaCrisis = true }}
assert(lagunakSpawnEncounter("ambush", "starboard") == true)
assert(recibido.nave == ship, "la crisis debe recibir la nave del jugador")
assert(recibido.rumbo == "starboard", "el rumbo grueso debe llegar tal cual")
assert(#crisisActivas == 1 and crisisActivas[1].soyLaCrisis)
-- La propiedad que importa: no se ha materializado ninguna nave suelta ni
-- marcador por el camino de ARQUETIPOS_ENCUENTRO.
assert(naves == 0, "ambush no debe crear una CpuShip desde la tabla de arquetipos")
assert(marcadores == 0, "ambush no debe crear marcador de evento de encuentro")
assert(contadorEncuentros == nil, "ambush no debe consumir el contador de encuentros")
assert(#marcadoresEventosEncuentro == 0)

-- 2) Si la utilidad no puede montarla, se rechaza y no queda basura viva.
devolver = nil
assert(lagunakSpawnEncounter("ambush", "ahead") == false)
assert(#crisisActivas == 1, "una crisis rechazada no debe encolarse")
io.write("ok")
'''
    ruta = tmp_path / "scenario-ambush-driver.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    assert proc.stdout == b"ok"


def test_escenario_registra_el_callback_bajo_namespace_propio():
    raiz = Path(__file__).resolve().parents[2]
    escenario = (
        raiz / "scripts" / "scenario_90_lagunak_primera_guardia.lua"
    ).read_text(encoding="utf-8")
    assert "local storage = getScriptStorage()" in escenario
    assert (
        "storage.espaciokoop_lagunak.spawnEncounter = lagunakSpawnEncounter"
        in escenario
    )
    assert "LAGUNAK_EVT_encounter_started_s90_" in escenario
    assert "actualizarMarcadoresEventosEncuentro()" in escenario
