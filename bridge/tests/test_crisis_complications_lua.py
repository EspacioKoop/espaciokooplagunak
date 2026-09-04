"""Complicaciones standalone de la crisis multipuesto (#807).

Ejecuta la utilidad Lua real con un doble estrecho de la nave. La autoridad es
el catálogo cerrado del escenario: un nombre desconocido no toca la simulación.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import cast

import pytest


def _interprete_lua() -> str | None:
    for nombre in ("lua5.3", "lua5.4", "lua"):
        ruta = shutil.which(nombre)
        if ruta is not None:
            return ruta
    return None


def _ejecutar(tmp_path: Path, cuerpo: str) -> str:
    lua = _interprete_lua()
    if lua is None:
        pytest.skip("no hay intérprete Lua para probar la utilidad real")
    lua = cast(str, lua)
    raiz = Path(__file__).resolve().parents[2]
    utilidad = raiz / "scripts" / "lagunak_crisis_scenario_utility.lua"
    driver = f'''
function _(contexto, texto) return texto end
local mensajes = {{}}
function globalMessage(texto) table.insert(mensajes, texto) end
assert(loadfile({str(utilidad)!r}))()

local nave = {{ valida = true, calor = 0.40, escrituras = 0 }}
function nave:isValid() return self.valida end
function nave:getHeading() return 0 end
function nave:getPosition() return 0, 0 end
function nave:isCommsChatOpen() return self.comms == true end
function nave:getSystemHeat(sistema)
    assert(sistema == "reactor")
    return self.calor
end
function nave:setSystemHeat(sistema, valor)
    assert(sistema == "reactor")
    self.calor = valor
    self.escrituras = self.escrituras + 1
end

{cuerpo}
io.write("ok")
'''
    ruta = tmp_path / "crisis-complicaciones-driver.lua"
    ruta.write_text(driver, encoding="utf-8")
    proc = subprocess.run([lua, str(ruta)], capture_output=True, timeout=10)
    assert proc.returncode == 0, proc.stderr.decode("utf-8", "replace")
    return proc.stdout.decode("utf-8")


def test_catalogo_cerrado_y_nombre_desconocido_no_mutan(tmp_path: Path):
    salida = _ejecutar(
        tmp_path,
        r'''
local catalogo = lagunakCrisisComplicaciones()
assert(#catalogo == 2)
assert(catalogo[1].id == "reactor_sobrecalentado")
assert(catalogo[2].id == "margen_parlamento_reducido")
assert(catalogo[1].aplicar == nil, "el catálogo público no expone funciones")

local crisis = {
    nave = nave,
    margenParlamento = 4.0,
    margenParlamentoMaximo = 4.0,
    desenlace = nil,
}
assert(lagunakCrisisAplicarComplicacion(crisis, "inventada") == false)
assert(lagunakCrisisAplicarComplicacion({ nave = {} }, "reactor_sobrecalentado") == false)
assert(nave.calor == 0.40 and nave.escrituras == 0)
assert(crisis.margenParlamento == 4.0)
assert(#mensajes == 0)
''',
    )
    assert salida == "ok"


def test_sobrecalentamiento_modifica_la_simulacion_y_se_acota(tmp_path: Path):
    salida = _ejecutar(
        tmp_path,
        r'''
local crisis = { nave = nave, desenlace = nil }
assert(lagunakCrisisAplicarComplicacion(crisis, "reactor_sobrecalentado") == true)
assert(math.abs(nave.calor - 0.65) < 0.0001)
assert(nave.escrituras == 1)
assert(#mensajes == 1)

nave.calor = 0.90
assert(lagunakCrisisAplicarComplicacion(crisis, "reactor_sobrecalentado") == true)
assert(nave.calor == 1.0, "el calor nunca supera el máximo")
assert(nave.escrituras == 2)
''',
    )
    assert salida == "ok"


def test_margen_reducido_afecta_la_ventana_y_no_la_amplia(tmp_path: Path):
    salida = _ejecutar(
        tmp_path,
        r'''
local crisis = {
    nave = nave,
    margenParlamento = 3.5,
    margenParlamentoMaximo = 4.0,
    desenlace = nil,
}
assert(lagunakCrisisAplicarComplicacion(crisis, "margen_parlamento_reducido") == true)
assert(crisis.margenParlamentoMaximo == 1.0)
assert(crisis.margenParlamento == 1.0)

-- Repetirla nunca recupera ni amplía el margen.
crisis.margenParlamento = 0.25
assert(lagunakCrisisAplicarComplicacion(crisis, "margen_parlamento_reducido") == true)
assert(crisis.margenParlamentoMaximo == 1.0)
assert(crisis.margenParlamento == 0.25)
''',
    )
    assert salida == "ok"


def test_crisis_terminada_rechaza_toda_complicacion(tmp_path: Path):
    salida = _ejecutar(
        tmp_path,
        r'''
local crisis = {
    nave = nave,
    margenParlamento = 4.0,
    margenParlamentoMaximo = 4.0,
    desenlace = "resuelta",
}
assert(lagunakCrisisAplicarComplicacion(crisis, "reactor_sobrecalentado") == false)
assert(lagunakCrisisAplicarComplicacion(crisis, "margen_parlamento_reducido") == false)
assert(nave.escrituras == 0 and nave.calor == 0.40)
assert(crisis.margenParlamento == 4.0)
assert(#mensajes == 0)
''',
    )
    assert salida == "ok"


def test_instancia_real_conserva_el_margen_reducido_al_actualizar(tmp_path: Path):
    salida = _ejecutar(
        tmp_path,
        r'''
local function contacto()
    local objeto = { valido = true }
    return setmetatable(objeto, { __index = function(_, clave)
        if clave == "isValid" then return function(self) return self.valido end end
        if clave == "getCallSign" then return function(self) return self.callsign end end
        return function(self, ...)
            local args = {...}
            if clave == "setCallSign" then self.callsign = args[1] end
            return self
        end
    end })
end
function CpuShip() return contacto() end

local crisis = lagunakCrisisEmboscada(nave, "ahead")
assert(crisis ~= nil)
assert(crisis:aplicarComplicacion("margen_parlamento_reducido") == true)
assert(crisis:estado().margenParlamentoMaximo == 1.0)

-- Mientras el canal sigue abierto, el ciclo refresca el margen al máximo
-- reducido, no vuelve silenciosamente a los cuatro segundos originales.
nave.comms = true
crisis.parlamento = true
crisis.margenParlamento = 0.1
assert(crisis:parlamentoActivo(0.5) == true)
assert(crisis:estado().margenParlamento == 1.0)
''',
    )
    assert salida == "ok"
