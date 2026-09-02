"""Heurística de inglés residual (#813): traducciones por sustitución de palabras.

`tools/validate_es_locale.py` comprobaba vacíos, placeholders y saltos finales,
pero un msgstr como "Configures the amount/strength of enemigos spawned in the
scenario." pasaba sin rozar ninguna de esas comprobaciones — msgstr no vacío,
placeholders y saltos cuadrando. Estos tests fijan el contrato de la heurística
que lo detecta: qué cuenta como inglés residual, qué no (placeholders, texto
sin traducir en absoluto) y la excepción declarada para scenario_59_border.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "tools"))

from validate_es_locale import residual_english  # noqa: E402


class InglesResidual(unittest.TestCase):
    def test_detecta_sustitucion_de_palabras(self) -> None:
        self.assertEqual(
            residual_english("Configures the amount/strength of enemigos spawned in the scenario."),
            sorted({"the", "of", "spawned"}),
        )

    def test_nombre_propio_capitalizado_no_cuenta(self) -> None:
        # "Nautilus", "MP52 Hornet", "Red Jacket": nombres propios, no palabras
        # funcionales en minúscula.
        self.assertEqual(residual_english("Nautilus: Frigate, Mine Layer"), [])
        self.assertEqual(residual_english("MP52 Hornet y Red Jacket"), [])

    def test_traduccion_real_no_falsea_positivos(self) -> None:
        self.assertEqual(
            residual_english("Enemigos disparatadamente fuertes y/o en cantidades desmedidas"),
            [],
        )

    def test_placeholder_con_and_no_cuenta(self) -> None:
        # Los `<...>` se dejan verbatim en inglés a propósito en todo el
        # catálogo (acotaciones de escena); no son texto traducible.
        self.assertEqual(
            residual_english("<Transmit 'The Itsy-Bitsy Spider' on all wavelengths>"),
            [],
        )

    def test_placeholder_printf_no_es_lo_que_se_ignora(self) -> None:
        # El propio placeholder no cuenta como texto, pero la palabra "and"
        # que queda fuera de él sigue siendo inglés residual real.
        self.assertEqual(residual_english("%s and %s"), ["and"])
        self.assertEqual(residual_english("%s el %s"), [])


if __name__ == "__main__":
    unittest.main()
