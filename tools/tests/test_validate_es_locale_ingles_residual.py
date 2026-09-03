"""Heurística de inglés residual (#813): traducciones por sustitución de palabras.

`tools/validate_es_locale.py` comprobaba vacíos, placeholders y saltos finales,
pero un msgstr como "Configures the amount/strength of enemigos spawned in the
scenario." pasaba sin rozar ninguna de esas comprobaciones — msgstr no vacío,
placeholders y saltos cuadrando. Estos tests fijan el contrato de la heurística
que lo detecta: qué cuenta como inglés residual, qué no (placeholders, texto
sin traducir en absoluto) y las fichas de naves ya revisadas de
scenario_59_border.
"""

from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

import polib

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "tools"))

import validate_es_locale  # noqa: E402
from validate_es_locale import residual_english  # noqa: E402


NAVES_REVISADAS = {
    "Destroyer III(Simian)",
    "Atlantis",
    "Benedict",
    "Crucible",
    "Ender",
    "Flavia P.Falcon",
    "Hathcock",
    "Kiriya",
    "MP52 Hornet",
    "Maverick",
    "Nautilus",
    "Phobos MP3",
    "Piranha",
    "Player Cruiser",
    "Player Fighter",
    "Player Missile Cr.",
    "Repulse",
    "Striker",
    "ZX-Lindworm",
}

ETIQUETAS_INGLESAS = (
    "Hull:",
    "Shield:",
    "Size:",
    "Repair Crew:",
    "Cargo:",
    "Cargo Space:",
    "R.Strength:",
    "Default advanced engine:",
    "Speeds:",
    "Impulse:",
    "Spin:",
    "Accelerate:",
    "C.Maneuver:",
    "Boost:",
    "Strafe:",
    "Energy:",
    "Beam:",
    "Beams:",
    "Turreted Speed:",
    "Arc:",
    "Direction:",
    "Range:",
    "Cycle:",
    "Damage:",
    "Tube:",
    "Tubes:",
    "Load Speed:",
    "Front:",
    "Side:",
    "Back:",
    "Type:",
    "Ordnance stock and type:",
)


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

    def test_fichas_de_naves_de_border_estan_retraducidas(self) -> None:
        catalogo = polib.pofile(str(RAIZ / "scripts/locale/scenario_59_border.es.po"))
        fichas = {
            entrada.msgid.split(":", 1)[0]: entrada
            for entrada in catalogo
            if entrada.msgctxt == "msgGM" and entrada.msgid
        }

        self.assertEqual(NAVES_REVISADAS, NAVES_REVISADAS & fichas.keys())
        for nave in NAVES_REVISADAS:
            entrada = fichas[nave]
            with self.subTest(nave=nave):
                lineas_originales = entrada.msgid.splitlines()
                lineas_traducidas = entrada.msgstr.splitlines()
                self.assertEqual(len(lineas_originales), len(lineas_traducidas))
                for original, traduccion in zip(lineas_originales, lineas_traducidas):
                    self.assertEqual(re.findall(r"-?\d+(?:\.\d+)?", original),
                                     re.findall(r"-?\d+(?:\.\d+)?", traduccion))
                    self.assertEqual(len(original) - len(original.lstrip()),
                                     len(traduccion) - len(traduccion.lstrip()))
                self.assertEqual(residual_english(entrada.msgstr), [])
                for etiqueta in ETIQUETAS_INGLESAS:
                    self.assertNotIn(etiqueta, entrada.msgstr)

    def test_las_fichas_de_border_ya_no_tienen_excepcion(self) -> None:
        self.assertFalse(hasattr(validate_es_locale, "RESIDUAL_ENGLISH_IGNORE"))


if __name__ == "__main__":
    unittest.main()
