"""La atribución del rojo: NUEVO frente a HEREDADO.

Existe porque el 26-ago-2026 los PRs #789 y #793 se fusionaron con esta puerta
en rojo. A partir de ahí el mismo rojo salía en #794, #796 y #797, que no
habían tocado ningún catálogo — y con un rojo que no distingue quién lo rompió,
el rojo deja de significar nada. Lo que se comprueba aquí no es la auditoría
(eso ya lo cubre `validate_es_locale.py` de siempre) sino la clasificación.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
HERRAMIENTA = RAIZ / "tools" / "validate_es_locale.py"

CABECERA_EN = 'msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=UTF-8\\n"\n'
CABECERA_ES = (
    'msgid ""\nmsgstr ""\n"Language: es_ES\\n"\n'
    '"Content-Type: text/plain; charset=UTF-8\\n"\n'
)


def entrada(msgid: str, msgstr: str) -> str:
    return f'\nmsgid "{msgid}"\nmsgstr "{msgstr}"\n'


class AtribucionDelRojo(unittest.TestCase):
    def setUp(self) -> None:
        self.temporal = tempfile.TemporaryDirectory(prefix="lagunak-validate-es-")
        self.raiz = Path(self.temporal.name)
        self.locale = self.raiz / "scripts/locale"
        self.locale.mkdir(parents=True)
        self.en = self.locale / "scenario_01.en.po"
        self.es = self.locale / "scenario_01.es.po"
        self.en.write_text(CABECERA_EN + entrada("Shields down", ""), encoding="utf-8")
        self.es.write_text(CABECERA_ES + entrada("Shields down", "Escudos caidos"), encoding="utf-8")
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "guarda@example.invalid")
        self.git("config", "user.name", "Guarda")
        self.commit("base")
        self.git("branch", "-q", "base")

    def tearDown(self) -> None:
        self.temporal.cleanup()

    def git(self, *args: str) -> None:
        subprocess.run(["git", *args], cwd=self.raiz, check=True, capture_output=True)

    def commit(self, mensaje: str) -> None:
        self.git("add", "-A")
        self.git("commit", "-qm", mensaje)

    def romper(self, fichero: Path, msgid: str) -> None:
        """Añade una clave al `.en.po` sin su pareja en `.es.po`: el fallo real."""
        fichero.write_text(fichero.read_text(encoding="utf-8") + entrada(msgid, ""), encoding="utf-8")

    def ejecutar(self, *extra: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(HERRAMIENTA), str(self.raiz), *extra],
            cwd=self.raiz, capture_output=True, text=True,
            env=dict(os.environ, PYTHONPATH=str(RAIZ)),
        )

    def test_sin_base_no_clasifica(self) -> None:
        resultado = self.ejecutar()
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)
        self.assertNotIn("nuevos=", resultado.stdout)

    def test_error_propio_sale_como_nuevo(self) -> None:
        self.romper(self.en, "Hull breach")
        self.commit("rompe")
        resultado = self.ejecutar("--base", "base")
        self.assertEqual(resultado.returncode, 1)
        self.assertIn("nuevos=1 heredados=0", resultado.stdout)
        self.assertIn("NUEVO", resultado.stderr)

    def test_error_de_la_base_sale_como_heredado(self) -> None:
        self.romper(self.en, "Hull breach")
        self.commit("rompe en la base")
        self.git("branch", "-qf", "base")
        # La rama toca otra cosa: hereda el rojo pero no lo ha causado.
        (self.raiz / "otro.txt").write_text("nada que ver\n", encoding="utf-8")
        self.commit("cambio ajeno")
        resultado = self.ejecutar("--base", "base")
        self.assertEqual(resultado.returncode, 1, "un catálogo roto sigue siendo un fallo")
        self.assertIn("nuevos=0 heredados=1", resultado.stdout)
        self.assertIn("HEREDADO", resultado.stderr)
        self.assertIn("este cambio no ha roto ninguno", resultado.stderr)

    def test_distingue_el_propio_del_heredado_a_la_vez(self) -> None:
        self.romper(self.en, "Hull breach")
        self.commit("rompe en la base")
        self.git("branch", "-qf", "base")
        otro_en = self.locale / "scenario_02.en.po"
        otro_es = self.locale / "scenario_02.es.po"
        otro_en.write_text(CABECERA_EN + entrada("Warp core", ""), encoding="utf-8")
        otro_es.write_text(CABECERA_ES + entrada("Warp core", "Nucleo de curvatura"), encoding="utf-8")
        self.commit("cataologo nuevo sano")
        self.romper(otro_en, "Coolant leak")
        self.commit("y lo rompe")
        resultado = self.ejecutar("--base", "base")
        self.assertEqual(resultado.returncode, 1)
        self.assertIn("nuevos=1 heredados=1", resultado.stdout)
        self.assertIn("NUEVO    key mismatch: scripts/locale/scenario_02.es.po", resultado.stderr)
        self.assertIn("HEREDADO key mismatch: scripts/locale/scenario_01.es.po", resultado.stderr)

    def test_base_ilegible_no_clasifica_pero_sigue_auditando(self) -> None:
        self.romper(self.en, "Hull breach")
        self.commit("rompe")
        resultado = self.ejecutar("--base", "no/existe")
        self.assertEqual(resultado.returncode, 1)
        self.assertIn("no se pudo leer la base", resultado.stderr)
        self.assertNotIn("nuevos=", resultado.stdout)


if __name__ == "__main__":
    unittest.main()
