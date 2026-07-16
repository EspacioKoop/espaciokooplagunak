"""Regresión de .luarc.json: la whitelist de globales debe ser API real.

La lista `diagnostics.globals` solo puede contener globales registradas por el
runtime (`setGlobal("...")` en C++). Una whitelist construida por observación
de los escenarios ocultaría erratas ejecutables — véase la review del PR #164:
`nill`, `dificulty`, `setCommsmessage` y `setComsMessage` son fallos reales de
escenarios upstream y deben seguir siendo diagnosticables.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

# Erratas reales observadas en escenarios upstream que una whitelist sana
# jamás debe aceptar como global válida.
KNOWN_TYPOS = {"nill", "dificulty", "setCommsmessage", "setComsMessage"}

# Globales registradas por un runtime externo a este repositorio (hoy ninguna:
# SeriousProton no registra globales de escenario mediante setGlobal). Si un
# merge de upstream añade alguna, documenta aquí su fuente exacta.
EXTERNAL_RUNTIME_GLOBALS: dict[str, str] = {}

SET_GLOBAL = re.compile(r'setGlobal\("([A-Za-z_][A-Za-z_0-9]*)"')


def runtime_globals() -> set[str]:
    names: set[str] = set(EXTERNAL_RUNTIME_GLOBALS)
    for path in (REPO / "src").rglob("*"):
        if path.suffix in {".cpp", ".h", ".hpp"}:
            names.update(SET_GLOBAL.findall(path.read_text(errors="replace")))
    return names


def configured_globals() -> list[str]:
    config = json.loads((REPO / ".luarc.json").read_text())
    return config["diagnostics"]["globals"]


class LuarcGlobalsTests(unittest.TestCase):
    def test_whitelist_solo_contiene_bindings_reales(self) -> None:
        allowed = runtime_globals()
        unknown = [name for name in configured_globals() if name not in allowed]
        self.assertEqual(
            unknown,
            [],
            "Entradas de diagnostics.globals sin binding setGlobal en src/ "
            f"(ni fuente externa documentada): {unknown}",
        )

    def test_whitelist_no_acepta_erratas_conocidas(self) -> None:
        polluted = KNOWN_TYPOS.intersection(configured_globals())
        self.assertEqual(set(), polluted)

    def test_luals_acepta_api_real_y_diagnostica_erratas(self) -> None:
        """Focal: con la config del repo, LuaLS acepta API real y señala erratas.

        Requiere lua-language-server en el PATH; si no está (p. ej. en CI), se
        omite — los dos tests estáticos anteriores siguen protegiendo la lista.
        """
        luals = shutil.which("lua-language-server")
        if luals is None:
            self.skipTest("lua-language-server no disponible")
        fixture = (
            "setCommsMessage('API real: aceptada')\n"
            "getPlayerShip(-1)\n"
            "setCommsmessage('errata: diagnosticable')\n"
            "setComsMessage('errata: diagnosticable')\n"
            "local a = nill\n"
            "local b = 1 - dificulty\n"
        )
        with tempfile.TemporaryDirectory(prefix="luarc-focal-") as tmp:
            root = Path(tmp)
            (root / "fixture.lua").write_text(fixture)
            out = root / "check.json"
            # LuaLS sale con 1 cuando emite diagnósticos, que es justo lo que
            # este fixture provoca; solo un fallo real (>1) es error del test.
            result = subprocess.run(
                [
                    luals,
                    "--check", str(root),
                    "--checklevel=Warning",
                    f"--configpath={REPO / '.luarc.json'}",
                    f"--check_out_path={out}",
                    f"--logpath={root / 'log'}",
                ],
                capture_output=True,
            )
            self.assertIn(result.returncode, (0, 1), result.stderr)
            report = json.loads(out.read_text()) if out.exists() else {}
            undefined = {
                message.split("`")[1]
                for diagnostics in report.values()
                for diagnostic in diagnostics
                if diagnostic["code"] == "undefined-global"
                for message in [diagnostic["message"]]
                if "`" in message
            }
        self.assertTrue(
            KNOWN_TYPOS.issubset(undefined),
            f"Erratas no diagnosticadas: {KNOWN_TYPOS - undefined}",
        )
        self.assertNotIn("setCommsMessage", undefined)
        self.assertNotIn("getPlayerShip", undefined)


if __name__ == "__main__":
    unittest.main()
