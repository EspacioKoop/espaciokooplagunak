# -*- coding: utf-8 -*-
"""Tests de tools/nasa3d.py. Sin red: todo sale de una fixture REAL.

La versión anterior de estos tests validaba ficción —una `sample_meta`
inventada con un array `models[]` que el repositorio de NASA no tiene—, así que
pasaban en verde mientras el módulo era inservible contra la API de verdad. La
fixture de aquí está recortada del árbol real (`fixtures_nasa_tree.json`), no
escrita a mano.
"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import nasa3d  # noqa: E402

FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures_nasa_tree.json")


def arbol():
    with open(FIXTURE, encoding="utf-8") as f:
        return json.load(f)


class LaFixtureEsReal(unittest.TestCase):
    def test_la_fixture_viene_del_arbol_de_nasa_no_de_la_imaginacion(self):
        t = arbol()["tree"]
        self.assertTrue(t, "fixture vacía")
        # Cada entrada trae sha de git de 40 hex: eso no se inventa a mano.
        for nodo in t:
            if nodo.get("type") == "blob":
                self.assertRegex(nodo["sha"], r"^[0-9a-f]{40}$")

    def test_no_existe_el_array_models_que_el_modulo_viejo_esperaba(self):
        # El fallo original: se dio por hecha una estructura que NASA no publica.
        self.assertNotIn("models", arbol())


class Catalogar(unittest.TestCase):
    def test_agrupa_por_carpeta_de_modelo(self):
        piezas = nasa3d.piezas(arbol())
        ids = {p["identificador"] for p in piezas}
        self.assertIn("3D Models/Cassini Assembly", ids)

    def test_solo_devuelve_lo_que_tiene_malla(self):
        for p in nasa3d.piezas(arbol()):
            self.assertTrue(p["mallas"], f"{p['identificador']} sin malla")

    def test_separa_mallas_de_texturas(self):
        p = next(x for x in nasa3d.piezas(arbol())
                 if x["identificador"] == "3D Models/Cassini Assembly")
        self.assertEqual([m["formato"] for m in p["mallas"]], ["glb"])
        self.assertEqual([t["formato"] for t in p["texturas"]], ["png"])


class Procedencia(unittest.TestCase):
    def test_no_afirma_dominio_publico_porque_nasa_no_lo_declara(self):
        # La API de GitHub devuelve license: null para ese repositorio. Rellenar
        # el campo a ojo es exactamente lo que la verificación existe para impedir.
        for p in nasa3d.piezas(arbol()):
            self.assertIsNone(p["licencia_declarada"])

    def test_enlaza_las_condiciones_de_uso_en_vez_de_inventarse_una_licencia(self):
        for p in nasa3d.piezas(arbol()):
            self.assertTrue(p["url_condiciones"].startswith("https://www.nasa.gov/"))

    def test_trae_los_campos_que_arte_verificar_necesita(self):
        obligatorios = {"identificador", "titulo", "url_ficha",
                        "licencia_declarada", "url_condiciones", "fuente"}
        for p in nasa3d.piezas(arbol()):
            self.assertTrue(obligatorios <= set(p), obligatorios - set(p))

    def test_las_urls_apuntan_al_repositorio_correcto(self):
        # El módulo anterior usaba `nasa/3D-Resources`, que da 404. El bueno es
        # `nasa/NASA-3D-Resources`.
        self.assertEqual(nasa3d.REPO, "nasa/NASA-3D-Resources")
        for p in nasa3d.piezas(arbol()):
            self.assertIn("/nasa/NASA-3D-Resources/", p["mallas"][0]["url_fichero"])

    def test_escapa_los_espacios_de_las_rutas(self):
        p = next(x for x in nasa3d.piezas(arbol())
                 if " " in x["identificador"])
        self.assertNotIn(" ", p["mallas"][0]["url_fichero"])
        self.assertIn("%20", p["mallas"][0]["url_fichero"])


class Filtrar(unittest.TestCase):
    def test_por_texto(self):
        r = nasa3d.filtrar(nasa3d.piezas(arbol()), texto="cassini assembly")
        self.assertEqual([p["identificador"] for p in r], ["3D Models/Cassini Assembly"])

    def test_por_formato_descarta_los_que_no_lo_tienen(self):
        r = nasa3d.filtrar(nasa3d.piezas(arbol()), formato="stl")
        for p in r:
            self.assertTrue(all(m["formato"] == "stl" for m in p["mallas"]))


class Anonimato(unittest.TestCase):
    def test_no_hay_rutas_de_nadie_ni_credenciales(self):
        # El criterio original buscaba la ruta absoluta de un usuario y se le
        # escapó la forma abreviada con virgulilla. Aquí se comprueban las dos.
        #
        # Las agujas se construyen por partes a propósito: un test que escribe
        # el literal que persigue se encuentra a sí mismo, y entonces no
        # comprueba nada. Ese fallo ya pasó una vez en este mismo fichero.
        fuente = open(os.path.join(os.path.dirname(FIXTURE), "..", "nasa3d.py"),
                      encoding="utf-8").read()
        agujas = ["/" + "home" + "/", "~" + "/", "eloy" + "falces",
                  "Bear" + "er ", "to" + "ken"]
        for prohibido in agujas:
            self.assertNotIn(prohibido, fuente, f"aparece {prohibido!r}")


class SinRed(unittest.TestCase):
    """Un test que se grepea a sí mismo no demuestra nada: se comprueba de verdad.

    Se sabotea la salida de red del módulo. Si catalogar o filtrar la tocaran,
    esto reventaría con RuntimeError en vez de pasar en verde.
    """

    def test_catalogar_y_filtrar_no_tocan_la_red(self):
        original = nasa3d.urllib.request.urlopen

        def saboteada(*a, **k):
            raise RuntimeError("un test ha intentado salir a la red")

        nasa3d.urllib.request.urlopen = saboteada
        try:
            piezas = nasa3d.piezas(arbol())
            nasa3d.filtrar(piezas, texto="cassini", formato="glb")
        finally:
            nasa3d.urllib.request.urlopen = original

    def test_el_sabotaje_funciona_de_verdad(self):
        # Si el sabotaje no sirviera, el test de arriba pasaría por la razón
        # equivocada. Esto lo demuestra.
        original = nasa3d.urllib.request.urlopen

        def saboteada(*a, **k):
            raise RuntimeError("un test ha intentado salir a la red")

        nasa3d.urllib.request.urlopen = saboteada
        try:
            with self.assertRaises(RuntimeError):
                nasa3d.traer_arbol(sin_cache=True)
        finally:
            nasa3d.urllib.request.urlopen = original


if __name__ == "__main__":
    unittest.main()
