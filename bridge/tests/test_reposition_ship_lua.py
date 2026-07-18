"""Vertical Lua de ``reposition_ship`` entre escenario y ``/exec.lua``.

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


def _ejecutar_reposition_lua(tmp_path: Path, preambulo: str) -> dict:
    lua = _interprete_lua()
    if lua is None:
        pytest.skip("no hay intérprete Lua para probar el vertical real")
    lua = cast(str, lua)
    driver = (
        preambulo
        + "\nlocal function entorno_exec()\n"
        + bridge.RepositionShip(
            op="reposition_ship",
            anchor=bridge.ShipAnchor.argia,
        ).lua()
        + "\nend\nio.write(entorno_exec())\n"
    )
    ruta = tmp_path / "reposition-driver.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    return json.loads(proc.stdout.decode("utf-8"))


def test_callback_publicado_en_storage_cruza_al_entorno_exec(tmp_path):
    payload = _ejecutar_reposition_lua(
        tmp_path,
        """
local storage = {}
function getScriptStorage() return storage end
function getPlayerShip(_) return {} end

-- Simula el entorno del escenario: el callback es local y solo se exporta
-- mediante ScriptStorage. El entorno exec no puede verlo como global.
local function registrar_escenario()
    local function reposition(ancla)
        return ancla == "argia"
    end
    storage.espaciokoop_lagunak = { repositionShip = reposition }
end
registrar_escenario()
""",
    )
    assert payload == {"ok": True}


def test_global_del_escenario_no_sustituye_el_storage(tmp_path):
    payload = _ejecutar_reposition_lua(
        tmp_path,
        """
local storage = {}
function getScriptStorage() return storage end
function getPlayerShip(_) return {} end
function lagunakRepositionShip(_) return true end
""",
    )
    assert payload == {"ok": False, "reason": "not_supported"}


def test_callback_publicado_falla_cerrado_sin_nave(tmp_path):
    payload = _ejecutar_reposition_lua(
        tmp_path,
        """
local storage = {
    espaciokoop_lagunak = { repositionShip = function(_) return true end }
}
function getScriptStorage() return storage end
function getPlayerShip(_) return nil end
""",
    )
    assert payload == {"ok": False, "reason": "no_ship"}


def test_ancla_desconocida_degrada_a_not_supported(tmp_path):
    # El callback del escenario devuelve false para un nombre que no resuelve;
    # el chunk del puente lo traduce a la misma degradación honesta.
    payload = _ejecutar_reposition_lua(
        tmp_path,
        """
local storage = {
    espaciokoop_lagunak = { repositionShip = function(_) return false end }
}
function getScriptStorage() return storage end
function getPlayerShip(_) return {} end
""",
    )
    assert payload == {"ok": False, "reason": "not_supported"}


def test_escenario_registra_el_callback_bajo_namespace_propio():
    raiz = Path(__file__).resolve().parents[2]
    escenario = (
        raiz / "scripts" / "scenario_90_lagunak_primera_guardia.lua"
    ).read_text(encoding="utf-8")
    assert "local storage = getScriptStorage()" in escenario
    assert (
        "storage.espaciokoop_lagunak.repositionShip = lagunakRepositionShip"
        in escenario
    )
