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


class LosClientesNuevosNoPidenSinClave(unittest.TestCase):
    """Europeana y Freesound prometen `None` sin clave. Que lo cumplan.

    Los dos llegaron al árbol SIN prueba y sin estar exportados: `core.py` ya
    declaraba su ritmo y `__init__.py` ya documentaba su variable de entorno,
    pero el cliente no existía. Un cliente de API sin prueba de que respeta la
    clave y el presupuesto es exactamente el que se come el tier gratuito.

    Lo que se comprueba aquí es lo que puede fallar de verdad: que sin clave NO
    salga a la red —no basta con que devuelva `None`, tiene que no pedir—, que la
    clave no se cuele en lo que devuelve, y que una respuesta vacía o incompleta
    no reviente.
    """

    def setUp(self):
        from apis import europeana as mod_e, freesound as mod_f
        self.europeana = mod_e
        self.freesound = mod_f

    def _sin_claves(self):
        return patch.dict(os.environ, {"EUROPEANA_API_KEY": "",
                                       "FREESOUND_API_KEY": ""}, clear=False)

    def test_sin_clave_no_se_toca_la_red(self):
        with self._sin_claves():
            with patch("apis.core.pedir") as red:
                self.assertIsNone(self.europeana("Vermeer"))
                self.assertIsNone(self.freesound("piano"))
                red.assert_not_called()

    def test_un_marcador_de_relleno_cuenta_como_no_tener_clave(self):
        # `_clave` descarta placeholders; si no, se saldría a la red con basura.
        with patch.dict(os.environ, {"EUROPEANA_API_KEY": "TODO"}, clear=False):
            with patch("apis.core.pedir") as red:
                self.assertIsNone(self.europeana("Vermeer"))
                red.assert_not_called()

    def test_europeana_normaliza_al_contrato_comun(self):
        respuesta = {"items": [{
            "title": ["La lechera"], "dcCreator": ["Vermeer"],
            "guid": ["https://europeana.eu/item/1"], "rights": ["http://creativecommons.org/publicdomain/mark/1.0/"],
            "edmPreview": ["https://img/1.jpg"], "dataProvider": ["Rijksmuseum"],
        }]}
        with patch.dict(os.environ, {"EUROPEANA_API_KEY": "k"}, clear=False):
            with patch("apis.europeana.pedir", return_value=respuesta):
                r = self.europeana("Vermeer")
        self.assertEqual(len(r), 1)
        self.assertEqual(r[0]["fuente"], "europeana")
        self.assertEqual(r[0]["titulo"], "La lechera")
        self.assertEqual(r[0]["autor"], "Vermeer")
        self.assertEqual(r[0]["proveedor"], "Rijksmuseum")

    def test_freesound_normaliza_al_contrato_comun(self):
        respuesta = {"results": [{
            "id": 7, "name": "puerta", "username": "alguien",
            "license": "http://creativecommons.org/publicdomain/zero/1.0/",
            "url": "https://freesound.org/s/7/",
            "previews": {"preview-hq-mp3": "https://freesound.org/7.mp3"},
            "description": "una puerta",
        }]}
        with patch.dict(os.environ, {"FREESOUND_API_KEY": "k"}, clear=False):
            with patch("apis.freesound.pedir", return_value=respuesta):
                r = self.freesound("puerta")
        self.assertEqual(len(r), 1)
        self.assertEqual(r[0]["fuente"], "freesound")
        self.assertEqual(r[0]["preview"], "https://freesound.org/7.mp3")

    def test_un_resultado_al_que_le_faltan_campos_no_revienta(self):
        # Las dos APIs devuelven listas y omiten campos con soltura; un cliente
        # que dé por hecho que están se cae el día que uno falte.
        with patch.dict(os.environ, {"EUROPEANA_API_KEY": "k",
                                     "FREESOUND_API_KEY": "k"}, clear=False):
            with patch("apis.europeana.pedir", return_value={"items": [{}]}):
                self.assertEqual(len(self.europeana("x")), 1)
            with patch("apis.freesound.pedir", return_value={"results": [{}]}):
                self.assertEqual(len(self.freesound("x")), 1)

    def test_caida_es_None_y_busqueda_sin_resultados_es_lista_vacia(self):
        """Dos cosas distintas que un cliente descuidado confunde.

        «No he podido preguntar» (`None`) y «he preguntado y no hay nada»
        (`[]`) no significan lo mismo para quien llama: lo primero se reintenta,
        lo segundo no. Los dos clientes distinguen ambos casos, y esta prueba
        es lo que impide que un futuro `return []` de más los iguale.
        """
        with patch.dict(os.environ, {"EUROPEANA_API_KEY": "k",
                                     "FREESOUND_API_KEY": "k"}, clear=False):
            # Caída o presupuesto agotado: `pedir` devuelve None (o algo falsy).
            for falsy in (None, {}):
                with patch("apis.europeana.pedir", return_value=falsy):
                    self.assertIsNone(self.europeana("x"))
                with patch("apis.freesound.pedir", return_value=falsy):
                    self.assertIsNone(self.freesound("x"))
            # Respuesta buena, sin coincidencias: lista vacía, no None.
            with patch("apis.europeana.pedir", return_value={"items": []}):
                self.assertEqual(self.europeana("x"), [])
            with patch("apis.freesound.pedir", return_value={"results": []}):
                self.assertEqual(self.freesound("x"), [])

    def test_la_clave_no_viaja_en_lo_que_se_devuelve(self):
        """La clave va en la query. No puede acabar en el resultado ni en un log."""
        secreto = "CLAVE-SECRETA-DE-PRUEBA"
        with patch.dict(os.environ, {"FREESOUND_API_KEY": secreto}, clear=False):
            with patch("apis.freesound.pedir", return_value={"results": [{"id": 1}]}):
                r = self.freesound("x")
        self.assertNotIn(secreto, repr(r))

    def test_los_dos_estan_exportados_por_el_paquete(self):
        """Llegaron al árbol sin exportar: un cliente que nadie puede importar."""
        import apis
        self.assertIn("europeana", apis.__all__)
        self.assertIn("freesound", apis.__all__)
        self.assertTrue(callable(apis.europeana))
        self.assertTrue(callable(apis.freesound))


class NasaYLospecNoNecesitanClavePeroSiPresupuesto(unittest.TestCase):
    """Los otros dos rescatados. Sin clave, pero con las mismas obligaciones.

    A diferencia de Europeana y Freesound, estas dos APIs son anónimas: no hay
    clave que proteger. Lo que sí hay que respetar es el ritmo y el tope diario
    —el tier gratuito es todo el presupuesto que hay— y eso ya lo garantiza
    `pedir`, así que lo que se prueba aquí es que **pasen por `pedir`** y no se
    monten su propio HTTP por su cuenta.

    No es una precaución teórica: `avisar.py` llegó en el mismo lote haciendo
    justo eso, y es exactamente lo que #671 acababa de quitarle a `artic.py`.
    """

    def setUp(self):
        from apis import nasa as mod_n, nasa_asset as mod_na
        from apis import lospec as mod_l, lospec_aleatoria as mod_la
        self.nasa, self.nasa_asset = mod_n, mod_na
        self.lospec, self.lospec_aleatoria = mod_l, mod_la

    def test_los_dos_hosts_declaran_su_ritmo(self):
        # Sin entrada en RITMO no hay tope diario que agotar: se pediría sin
        # freno hasta que la API corte, que es el fallo que el modulo evita.
        self.assertIn("images-api.nasa.gov", core.RITMO)
        self.assertIn("lospec.com", core.RITMO)

    def test_no_hacen_su_propio_HTTP(self):
        """Todo tiene que salir por `pedir`, que es quien cuenta el gasto."""
        import glob
        raiz = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "apis")
        for nombre in ("nasa.py", "lospec.py"):
            texto = open(os.path.join(raiz, nombre), encoding="utf-8").read()
            self.assertNotIn("urlopen", texto, f"{nombre} se salta `pedir`")

    def test_nasa_normaliza_y_DESCARTA_el_item_sin_datos(self):
        """Un item sin `data` se tira, no se devuelve a medias.

        Es lo correcto y conviene fijarlo: sin `data` no hay ni id ni titulo, o
        sea que la entrada no sirve para nada y colarla obligaria a cada
        consumidor a filtrarla otra vez. Mi primera version de esta prueba
        esperaba que se devolviera; el cliente tenia razon.
        """
        respuesta = {"collection": {"items": [
            {"data": [{"nasa_id": "as11-40-5874", "title": "Aldrin",
                       "date_created": "1969-07-20", "center": "JSC",
                       "media_type": "image"}],
             "links": [{"rel": "preview", "href": "https://img/preview.jpg"}]},
            {},        # sin `data`: se descarta
            {"data": []},   # `data` vacia: tambien
        ]}}
        with patch("apis.nasa.pedir", return_value=respuesta):
            r = self.nasa("apollo 11")
        self.assertEqual(len(r), 1, "los items sin datos no se devuelven")
        self.assertEqual(r[0]["fuente"], "nasa")
        self.assertEqual(r[0]["nasa_id"], "as11-40-5874")
        self.assertEqual(r[0]["preview_url"], "https://img/preview.jpg")

    def test_lospec_devuelve_los_colores_de_la_paleta(self):
        respuesta = {"name": "Pico-8", "author": "zep",
                     "colors": ["000000", "1D2B53", "7E2553"]}
        with patch("apis.lospec.pedir", return_value=respuesta):
            r = self.lospec("pico-8")
        self.assertEqual(r["fuente"], "lospec")
        self.assertEqual(len(r["colores"]), 3)

    def test_una_paleta_sin_colores_da_lista_vacia_y_no_revienta(self):
        with patch("apis.lospec.pedir", return_value={"name": "x"}):
            self.assertEqual(self.lospec("x")["colores"], [])

    def test_caida_es_None_en_las_cuatro_funciones(self):
        with patch("apis.nasa.pedir", return_value=None):
            self.assertIsNone(self.nasa("x"))
            self.assertIsNone(self.nasa_asset("x"))
        with patch("apis.lospec.pedir", return_value=None):
            self.assertIsNone(self.lospec("x"))
            self.assertIsNone(self.lospec_aleatoria())

    def test_estan_exportadas_las_cuatro(self):
        import apis
        for nombre in ("nasa", "nasa_asset", "lospec", "lospec_aleatoria"):
            self.assertIn(nombre, apis.__all__)
            self.assertTrue(callable(getattr(apis, nombre)))
