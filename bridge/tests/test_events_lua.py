"""Ejecución real del Lua fijo que normaliza eventos de escenario."""

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


def test_events_lua_normaliza_solo_marcadores_cerrados(tmp_path: Path):
    lua = _interprete_lua()
    if lua is None:
        pytest.skip("no hay intérprete Lua para probar el DTO real de eventos")
    lua = cast(str, lua)

    preambulo = r'''
local function object(callsign)
    return { getCallSign = function() return callsign end }
end
local player = {
    getPosition = function() return 100, 200 end,
}
local objects = {
    object("LAGUNAK_EVT_arrival_s90_654321"),
    object("LAGUNAK_EVT_encounter_started_s90_654321_000002_derelict"),
    object("LAGUNAK_EVT_encounter_started_s90_654321_000003_kraken"),
    object("LAGUNAK_EVT_encounter_started_s90_654321_2_derelict"),
    object("LAGUNAK_EVT_encounter_started_s90_654321_000004_derelict_extra"),
    object("LAGUNAK_EVT_ship_repositioned_s90_654321_000007_argia_0000000425"),
    object("LAGUNAK_EVT_ship_repositioned_s90_654321_000008_mordor_0000000425"),
    object("LAGUNAK_EVT_ship_repositioned_s90_654321_000009_lagunak_42"),
    object("LAGUNAK_EVT_ship_repositioned_s90_654321_000010_argia_0000000425_extra"),
}
function getPlayerShip(_) return player end
function getObjectsInRadius(_, _, radius)
    assert(radius == 5000)
    return objects
end
function getScenarioTime() return 42.5 end
'''
    driver = preambulo + "\nlocal function events_endpoint()\n" + bridge._EVENTS_LUA
    driver += "\nend\nio.write(events_endpoint())\n"
    ruta = tmp_path / "events-driver.lua"
    ruta.write_text(driver, encoding="utf-8")

    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    payload = json.loads(proc.stdout.decode("utf-8"))

    assert payload == {
        "events": [
            {
                "id": "arrival-s90-654321",
                "type": "arrival",
                "scenario": "scenario_90_lagunak_primera_guardia",
                "destination": "Argia",
                "scenario_time": 42.5,
            },
            {
                "id": "encounter-started-s90-654321-000002",
                "type": "encounter_started",
                "scenario": "scenario_90_lagunak_primera_guardia",
                "archetype": "derelict",
                "encounter_callsign": "Hondar 2",
                "scenario_time": 42.5,
            },
            {
                "id": "ship-repositioned-s90-654321-000007-argia-0000000425",
                "type": "ship_repositioned",
                "scenario": "scenario_90_lagunak_primera_guardia",
                "anchor": "argia",
                "scenario_time": 42.5,
            },
        ]
    }
