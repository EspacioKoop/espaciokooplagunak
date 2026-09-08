"""Regresión de la guarda `check_po_no_pierde_claves.py`.

Se monta un repositorio git de verdad en cada caso porque lo que se comprueba
es precisamente cómo git PRESENTA el cambio: la vía de escape que encontró la
revisión de #794 era un renombrado, que con la detección de renames activada
—el defecto de `git diff`— llega como una sola `R` y esconde la ruta antigua.
Un doble de `git` no reproduciría eso, que es el fallo entero.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
GUARDA = RAIZ / "tools" / "check_po_no_pierde_claves.py"

CATALOGO = """msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

msgid "Puente a ingenieria"
msgstr ""

msgid "Escudos al veinte por ciento"
msgstr ""
"""

UNA_CLAVE = """msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"

msgid "Puente a ingenieria"
msgstr ""
"""


class GuardaPoNoPierdeClaves(unittest.TestCase):
    def setUp(self) -> None:
        self.temporal = tempfile.TemporaryDirectory(prefix="lagunak-guarda-po-")
        self.raiz = Path(self.temporal.name)
        self.ruta = self.raiz / "scripts/locale/scenario_33_early.en.po"
        self.ruta.parent.mkdir(parents=True)
        self.ruta.write_text(CATALOGO, encoding="utf-8")
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "guarda@example.invalid")
        self.git("config", "user.name", "Guarda")
        self.git("add", "-A")
        self.git("commit", "-qm", "base")
        self.git("branch", "-q", "base")

    def tearDown(self) -> None:
        self.temporal.cleanup()

    def git(self, *args: str) -> None:
        subprocess.run(["git", *args], cwd=self.raiz, check=True, capture_output=True)

    def commit(self, mensaje: str) -> None:
        self.git("add", "-A")
        self.git("commit", "-qm", mensaje)

    def ejecutar(self) -> subprocess.CompletedProcess[str]:
        entorno = dict(os.environ, PYTHONPATH=str(RAIZ))
        return subprocess.run(
            [sys.executable, str(GUARDA), "--base", "base"],
            cwd=self.raiz,
            capture_output=True,
            text=True,
            env=entorno,
        )

    def test_crecer_pasa(self) -> None:
        self.ruta.write_text(CATALOGO + '\nmsgid "Nueva linea"\nmsgstr ""\n', encoding="utf-8")
        self.commit("crece")
        resultado = self.ejecutar()
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)
        self.assertIn("ok", resultado.stdout)

    def test_encoger_falla_y_nombra_la_clave(self) -> None:
        self.ruta.write_text(UNA_CLAVE, encoding="utf-8")
        self.commit("encoge")
        resultado = self.ejecutar()
        self.assertEqual(resultado.returncode, 1, resultado.stdout)
        self.assertIn("PIERDE", resultado.stdout)
        self.assertIn("Escudos al veinte por ciento", resultado.stdout)

    def test_borrar_el_catalogo_falla(self) -> None:
        self.ruta.unlink()
        self.commit("borra")
        resultado = self.ejecutar()
        self.assertEqual(resultado.returncode, 1, resultado.stdout)
        self.assertIn("BORRADO", resultado.stdout)

    def test_renombrar_falla_pese_a_la_deteccion_de_renames(self) -> None:
        # La vía de escape de la revisión: el catálogo esperado desaparece, y
        # con renames detectados el diff solo enseñaba la ruta nueva.
        self.git("mv", "scripts/locale/scenario_33_early.en.po",
                 "scripts/locale/scenario_33_otro.en.po")
        self.commit("renombra")
        resultado = self.ejecutar()
        self.assertEqual(resultado.returncode, 1, resultado.stdout)
        self.assertIn("BORRADO", resultado.stdout)
        self.assertIn("scenario_33_early.en.po", resultado.stdout)

    def test_catalogo_nuevo_no_puede_encoger(self) -> None:
        nuevo = self.raiz / "scripts/locale/scenario_99_nuevo.en.po"
        nuevo.write_text(UNA_CLAVE, encoding="utf-8")
        self.commit("nuevo")
        resultado = self.ejecutar()
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)
        self.assertIn("nuevo", resultado.stdout)

    def test_base_inexistente_no_dice_que_todo_esta_bien(self) -> None:
        entorno = dict(os.environ, PYTHONPATH=str(RAIZ))
        resultado = subprocess.run(
            [sys.executable, str(GUARDA), "--base", "no/existe"],
            cwd=self.raiz, capture_output=True, text=True, env=entorno,
        )
        self.assertEqual(resultado.returncode, 2, resultado.stdout + resultado.stderr)


if __name__ == "__main__":
    unittest.main()
