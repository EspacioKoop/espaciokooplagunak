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

    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(
            prefix="hermes-verify-scenario-header-locale-mutacion-"
        )
        self.root = Path(self.temporary.name)

    def tearDown(self) -> None:
        self.temporary.cleanup()

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

    def test_quitar_una_clave_propia_hace_fallar_al_guardian(self) -> None:
        """La mutación negativa, ejecutada de verdad y no solo declarada.

        El test de arriba sale verde tanto si el guardián vigila como si no
        mira nada: hoy no faltan claves, así que `{}` es el resultado
        esperado en los dos casos. Lo que demuestra que sirve es que al
        RETIRAR una clave el guardián la señale.

        Se hace sobre una copia del árbol real —no sobre un escenario de
        juguete— porque lo que se quiere demostrar es que la puerta protege
        ESTE escenario y ESTOS catálogos.
        """
        raiz = Path(__file__).resolve().parents[2]
        relativo = f"scripts/{self.NUESTRO}.lua"

        copia = self.root / relativo
        copia.parent.mkdir(parents=True, exist_ok=True)
        copia.write_bytes((raiz / relativo).read_bytes())

        for idioma in ("en", "es"):
            origen = raiz / f"scripts/locale/{self.NUESTRO}.{idioma}.po"
            destino = self.root / f"scripts/locale/{self.NUESTRO}.{idioma}.po"
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(origen.read_bytes())

        # Sin tocar nada, la copia pasa igual que el árbol real. Si esto
        # fallara, la mutación de abajo no demostraría nada.
        intacta = audit(self.root, ("en", "es"))
        self.assertEqual(intacta["missing_keys"], 0, "la copia del árbol ya venía rota")

        # La mutación: se retira UNA opción del ajuste Modo del catálogo
        # castellano. Es exactamente el hueco que abrió este PR.
        # Lleva `msgctxt` porque es una opción del ajuste, no una cadena
        # suelta: el guardián distingue "Prueba individual" DE Modo de una
        # cadena igual que apareciera en otro sitio, y esta prueba lo fija.
        VICTIMA = "Prueba individual"
        CONTEXTO = "Modo"
        catalogo_es = self.root / f"scripts/locale/{self.NUESTRO}.es.po"
        catalogo = polib.pofile(str(catalogo_es))
        antes = len(catalogo)
        for entrada in [e for e in catalogo if e.msgid == VICTIMA]:
            catalogo.remove(entrada)
        self.assertEqual(len(catalogo), antes - 1, f"{VICTIMA} no estaba en el catálogo")
        catalogo.save(str(catalogo_es))

        mutado = audit(self.root, ("en", "es"))

        self.assertEqual(mutado["missing_keys"], 1)
        self.assertEqual(
            mutado["missing"][f"scripts/locale/{self.NUESTRO}.es.po"],
            [{"context": CONTEXTO, "msgid": VICTIMA}],
        )
