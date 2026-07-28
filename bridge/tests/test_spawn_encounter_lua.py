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
