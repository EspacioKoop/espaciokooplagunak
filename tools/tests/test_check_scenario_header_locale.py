from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import polib

from tools.check_scenario_header_locale import audit


class ScenarioHeaderLocaleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(
            prefix="hermes-verify-scenario-header-locale-"
        )
        self.root = Path(self.temporary.name)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def write_script(
        self, relative: str, *, name: str | None = None, description: str | None = None
    ) -> Path:
        path = self.root / "scripts" / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        lines = []
        if name is not None:
            lines.append(f"-- Name: {name}")
        if description is not None:
            lines.append(f"-- Description: {description}")
        lines.append("local helper = true")
        path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return path

    def write_catalog(self, relative_script: str, *msgids: str) -> Path:
        relative = Path(relative_script).with_suffix(".en.po")
        path = self.root / "scripts/locale" / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        catalog = polib.POFile()
        for msgid in msgids:
            catalog.append(polib.POEntry(msgid=msgid, msgstr=""))
        catalog.save(str(path))
        return path

    def test_audit_discovers_root_and_nested_headers_but_ignores_helpers(self) -> None:
        self.write_script("scenario_root.lua", name="Root", description="Root description")
        self.write_script("tutorial/02_helm.lua", name="Helm", description="Helm tutorial")
        self.write_script("lib/helper.lua")
        self.write_catalog("scenario_root.lua", "Root", "Root description")
        self.write_catalog("tutorial/02_helm.lua", "Helm", "Helm tutorial")

        result = audit(self.root, ("en",))

        self.assertEqual(result["scenarios"], 2)
        self.assertEqual(result["catalogs_checked"], 2)
        self.assertEqual(result["missing_catalogs"], [])
        self.assertEqual(result["missing_keys"], 0)

    def test_audit_reports_the_nested_catalog_path_when_missing(self) -> None:
        self.write_script("tutorial/02_helm.lua", name="Helm", description="Helm tutorial")

        result = audit(self.root, ("en",))

        self.assertEqual(
            result["missing_catalogs"],
            ["scripts/locale/tutorial/02_helm.en.po"],
        )
        self.assertEqual(result["catalogs_checked"], 0)

    def test_audit_reports_stale_nested_header_key(self) -> None:
        self.write_script("tutorial/02_helm.lua", name="Helm", description="New description")
        self.write_catalog("tutorial/02_helm.lua", "Helm")

        result = audit(self.root, ("en",))

        self.assertEqual(result["missing_keys"], 1)
        self.assertEqual(
            result["missing"]["scripts/locale/tutorial/02_helm.en.po"],
            [{"context": None, "msgid": "New description"}],
        )


if __name__ == "__main__":
    unittest.main()


class NuestroEscenarioTests(unittest.TestCase):
    """El escenario propio del fork, contrastado contra el repositorio real.

    Los tests de arriba usan árboles temporales y comprueban la herramienta.
    Este comprueba el repositorio: que la cabecera Lua de nuestro escenario y
    sus catálogos no se separen. Nació de un hueco real (25-ago-2026): el
    bloque `Setting[Modo]` llevaba dos opciones que no estaban en ninguno de
    los dos catálogos, así que la pantalla de selección mostraba las cadenas
    en crudo y en inglés se quedaban en castellano.

    Se acota al escenario propio a propósito. Los 47 escenarios heredados de
    EmptyEpsilon acumulan cientos de claves ausentes en sus catálogos, y por
    ADR-0007 no los tocamos: exigirlos aquí sería una puerta que no puede
    ponerse verde.
    """

    NUESTRO = "scenario_90_lagunak_primera_guardia"

    def test_los_catalogos_propios_no_se_quedan_atras(self) -> None:
        raiz = Path(__file__).resolve().parents[2]
        resultado = audit(raiz, ("en", "es"))
        rezagados = {
            catalogo: entradas
            for catalogo, entradas in resultado["missing"].items()
            if self.NUESTRO in catalogo
        }
        self.assertEqual(
            rezagados,
            {},
            "la cabecera Lua declara claves que los catálogos propios no tienen; "
            "ejecuta tools/check_scenario_header_locale.py para el detalle",
        )
