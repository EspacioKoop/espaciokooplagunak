from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from tools.check_cpp_locale_coverage import cadenas_del_fuente, sin_comentarios

REPO = Path(__file__).resolve().parents[2]


class ExtraccionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="lagunak-locale-coverage-")
        self.root = Path(self.temporary.name)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def escribir(self, contenido: str, nombre: str = "pantalla.cpp") -> None:
        destino = self.root / "src" / nombre
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(contenido, encoding="utf-8")

    def test_extrae_con_contexto_y_sin_contexto(self) -> None:
        self.escribir(
            'auto a = tr("content_editor", "Engines");\n'
            'auto b = tr("Next");\n'
            'auto c = trMark("gm_info", "Hull");\n'
        )
        claves = set(cadenas_del_fuente(self.root))
        self.assertIn(("content_editor", "Engines"), claves)
        self.assertIn((None, "Next"), claves)
        self.assertIn(("gm_info", "Hull"), claves)

    def test_un_tr_comentado_no_obliga_a_traducir_nada(self) -> None:
        # El árbol tiene líneas de upstream desactivadas; contarlas obligaría a
        # traducir texto que nadie llega a ver.
        self.escribir(
            '// auto viejo = tr("tweak-tab", "AI ship");\n'
            "/* from missile weapons\n"
            'ret[trMark("gm_info", "Lifetime")] = lifetime;\n'
            "*/\n"
            'auto vivo = tr("content_editor", "Speed");\n'
        )
        claves = set(cadenas_del_fuente(self.root))
        self.assertEqual(claves, {("content_editor", "Speed")})

    def test_una_barra_doble_dentro_de_una_cadena_no_es_comentario(self) -> None:
        fuente = 'auto u = "http://ejemplo"; auto v = tr("ctx", "Vivo");\n'
        self.assertIn('tr("ctx", "Vivo")', sin_comentarios(fuente))


class CoberturaRealTests(unittest.TestCase):
    """La regresión que importa: el propio árbol, no un fixture.

    #55 añadió 22 `msgid` del contexto `content_editor` sin tocar los catálogos y
    la CI siguió verde, porque `validate_es_locale.py` solo compara en-US contra
    es-ES y ambos coincidían en no tenerlos. Esto mira la otra costura: del
    código al catálogo.
    """

    def test_toda_cadena_de_cpp_esta_en_los_dos_catalogos(self) -> None:
        import polib

        fuente = cadenas_del_fuente(REPO)
        self.assertGreater(len(fuente), 500, "no se extrajo casi nada: ¿regex rota?")
        for rel in ("resources/locale/main.en.po", "resources/locale/main.es.po"):
            po = polib.pofile(str(REPO / rel), encoding="utf-8")
            catalogo = {(e.msgctxt, e.msgid) for e in po if not e.obsolete}
            faltan = sorted(k for k in fuente if k not in catalogo)
            self.assertEqual(faltan, [], f"{rel}: cadenas de C++ sin entrada")

    def test_el_editor_de_naves_habla_espanol(self) -> None:
        # La cara concreta de #55: los controles de motores y armamento. Si esto
        # falla, en una partida en español el editor sale mezclado.
        import polib

        po = polib.pofile(str(REPO / "resources/locale/main.es.po"), encoding="utf-8")
        traducciones = {
            e.msgid: e.msgstr for e in po if e.msgctxt == "content_editor" and not e.obsolete
        }
        for msgid in (
            "Engines",
            "Allowed armament",
            "Capacity",
            "Speed",
            "Set engine",
            "Set armament",
            "Ship engine override staged.",
            "Ship armament override staged.",
        ):
            with self.subTest(msgid=msgid):
                self.assertIn(msgid, traducciones)
                self.assertTrue(traducciones[msgid].strip(), f"{msgid} sin traducir")


if __name__ == "__main__":
    unittest.main()
