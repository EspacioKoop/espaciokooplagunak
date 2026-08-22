# -*- coding: utf-8 -*-
"""Tests del cliente de APIs. Sin red.

Los tests que traía este módulo eran estos tres:

    resultado = met("JP1847")
    assert resultado is None or isinstance(resultado, dict)

Eso pasa **pase lo que pase**: si la API cae, si la clave falta, si el módulo
devuelve basura. Y encima salían a la red, así que el resultado dependía de que
hubiera internet. Un test que no puede fallar no es un test.

Aquí se comprueba lo que el módulo promete de verdad: que respeta el ritmo, que
respeta el presupuesto, que cachea, y que no lleva rutas de nadie dentro.
"""
import os
import sys
import sqlite3
import tempfile
import time
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from apis import core  # noqa: E402


class SinRutasDeNadie(unittest.TestCase):
    """Este repositorio es público: ni nombres ni directorios personales."""

    def test_el_modulo_no_lleva_rutas_personales(self):
        import glob
        raiz = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "apis")
        agujas = ["/" + "home" + "/", "~" + "/", ".her" + "mes"]
        for f in glob.glob(os.path.join(raiz, "*.py")):
            texto = open(f, encoding="utf-8").read()
            for a in agujas:
                self.assertNotIn(a, texto, f"{os.path.basename(f)} contiene {a!r}")

    def test_la_cache_va_fuera_del_repositorio(self):
        self.assertNotIn(os.path.sep + "tools" + os.path.sep, core.CACHE)


class ElRitmoEstaDocumentado(unittest.TestCase):
    """Cada límite del módulo tiene que venir de la documentación de su API."""

    def test_todo_host_declara_ritmo_y_tope_diario(self):
        for host, valores in core.RITMO.items():
            self.assertEqual(len(valores), 2, host)
            espera, tope = valores
            self.assertGreater(espera, 0, f"{host}: ritmo no positivo")
            self.assertGreater(tope, 0, f"{host}: tope diario no positivo")

    def test_el_aic_respeta_su_recomendacion_de_una_por_segundo(self):
        # «Anonymous users are throttled to 60 requests per minute», y además
        # recomiendan no más de una por segundo.
        espera, _ = core.RITMO["api.artic.edu"]
        self.assertGreaterEqual(espera, 1.0)

    def test_ningun_host_va_mas_rapido_que_cinco_por_segundo(self):
        for host, (espera, _) in core.RITMO.items():
            self.assertGreaterEqual(espera, 0.2, f"{host} pide más de 5/s")


class ElPresupuestoSeRespeta(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self._cache = core.CACHE
        core.CACHE = os.path.join(self.tmp, "c.sqlite")

    def tearDown(self):
        core.CACHE = self._cache

    def test_agotado_el_tope_diario_no_se_pide_nada_mas(self):
        host = "api.artic.edu"
        _, tope = core.RITMO[host]
        c = core._con()
        # se simula el día ya consumido
        hoy = time.strftime("%Y-%m-%d")
        c.execute("INSERT OR REPLACE INTO gasto(host, dia, n, ultima) VALUES (?,?,?,?)",
                  (host, hoy, tope, 0.0))
        c.commit()
        with patch("apis.core.urllib.request.urlopen") as red:
            r = core.pedir(f"https://{host}/api/v1/artworks/1")
            self.assertIsNone(r, "pidió a la red con el presupuesto agotado")
            red.assert_not_called()
        self.assertEqual(core.ULTIMO_MOTIVO, "presupuesto")


class LaCacheEvitaLaRed(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self._cache = core.CACHE
        core.CACHE = os.path.join(self.tmp, "c.sqlite")

    def tearDown(self):
        core.CACHE = self._cache

    def test_la_segunda_llamada_no_toca_la_red(self):
        url = "https://api.artic.edu/api/v1/artworks/999999"
        respuesta = MagicMock()
        respuesta.read.return_value = b'{"data": {"id": 999999}}'
        respuesta.__enter__ = lambda s: s
        respuesta.__exit__ = lambda s, *a: False
        with patch("apis.core.urllib.request.urlopen", return_value=respuesta) as red:
            core.pedir(url)
            self.assertEqual(red.call_count, 1)
        with patch("apis.core.urllib.request.urlopen") as red2:
            r = core.pedir(url)
            red2.assert_not_called()
            self.assertEqual(r["data"]["id"], 999999)


class LasClavesSalenDelEntorno(unittest.TestCase):
    def test_una_plantilla_sin_rellenar_no_cuenta_como_clave(self):
        # Un `CLAVE=tu-clave` copiado de un ejemplo mandaría peticiones
        # condenadas a fallar, gastando presupuesto para nada.
        for marcador in ("tu-clave", "changeme", "...", ""):
            with patch.dict(os.environ, {"PRUEBA_CLAVE": marcador}):
                self.assertIsNone(core._clave("PRUEBA_CLAVE"), repr(marcador))

    def test_una_clave_de_verdad_si_cuenta(self):
        with patch.dict(os.environ, {"PRUEBA_CLAVE": "abc123def456"}):
            self.assertEqual(core._clave("PRUEBA_CLAVE"), "abc123def456")

    def test_no_se_leen_ficheros_de_configuracion_del_disco(self):
        # La versión anterior leía un .env de un directorio personal.
        with patch("builtins.open", side_effect=AssertionError("leyó un fichero")):
            core._cargar_env()


if __name__ == "__main__":
    unittest.main()
