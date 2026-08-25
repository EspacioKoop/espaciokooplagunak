"""Cliente de Openverse: solo audio con licencia libre comprobada.

Los tests venian en la rama original como `test_openverse_adversarial.py` y
`test_pagination.py` EN LA RAIZ del repositorio, con `sys.path.insert(0, 'tools')`
y `from apis import openverse`. Esa forma de importar es justo la que rompe en
CI --el mismo problema que documenta `tools/artic.py` en su cabecera: la suite
usa `tools.apis`, y elegir la otra ruta hace fallar una de las dos formas de
invocacion. Aqui se importa como el resto de la suite.
"""
from unittest.mock import patch

from tools.apis.openverse import openverse_audio


def _item(id_, licencia, version="1.0"):
    return {"id": id_, "license": licencia, "license_version": version,
            "url": f"http://ejemplo/{id_}.mp3",
            "foreign_landing_url": f"http://ejemplo/{id_}",
            "creator": "Alguien"}


class TestFiltroDeLicencia:
    def test_deja_pasar_cc0_y_dominio_publico(self):
        with patch("tools.apis.openverse.pedir") as p:
            p.return_value = {"results": [_item("1", "cc0")]}
            r = openverse_audio("mar")
        # Se consulta DOS veces (cc0 y publicdomain) pero el mismo `id` se
        # deduplica, asi que sale UNA vez. Esa dedup es la que evita que un
        # elemento presente en las dos consultas entre por duplicado.
        assert len(r) == 1
        assert r[0]["licencia"] == "cc0"

    def test_descarta_licencias_con_condiciones(self):
        """`by`, `by-sa`, `by-nc`… NO son dominio publico. Que la API las
        devuelva no las hace usables: la politica de assets del repositorio
        exige licencia del fichero concreto, no de la coleccion."""
        with patch("tools.apis.openverse.pedir") as p:
            p.return_value = {"results": [_item("1", "by"), _item("2", "by-sa"),
                                          _item("3", "by-nc-nd")]}
            assert openverse_audio("mar") == []

    def test_licencia_en_mayusculas_tambien_vale(self):
        with patch("tools.apis.openverse.pedir") as p:
            p.return_value = {"results": [_item("1", "CC0")]}
            assert len(openverse_audio("mar")) == 1

    def test_licencia_ausente_o_vacia_se_descarta(self):
        """Falla CERRADO: sin licencia declarada, fuera. Un fichero sin
        licencia no es un fichero libre, es un fichero sin comprobar."""
        with patch("tools.apis.openverse.pedir") as p:
            p.return_value = {"results": [{"id": "1", "url": "u"},
                                          _item("2", "")]}
            assert openverse_audio("mar") == []


class TestRobustez:
    def test_respuesta_vacia_no_revienta(self):
        with patch("tools.apis.openverse.pedir") as p:
            p.return_value = None
            assert openverse_audio("mar") == []

    def test_sin_clave_results(self):
        with patch("tools.apis.openverse.pedir") as p:
            p.return_value = {}
            assert openverse_audio("mar") == []

    def test_no_repite_el_mismo_id_entre_las_dos_consultas(self):
        """Se consulta dos veces (cc0 y publicdomain) y un mismo elemento
        puede salir en ambas: sin deduplicar, el catalogo tendria duplicados."""
        with patch("tools.apis.openverse.pedir") as p:
            p.return_value = {"results": [_item("mismo", "cc0")]}
            r = openverse_audio("mar")
        assert len({x["url"] for x in r}) == len(r)


class TestPaginacion:
    def test_solo_lee_la_primera_pagina(self):
        """LIMITACION CONOCIDA, fijada a proposito para que no se descubra
        tarde: el cliente NO pagina. Si Openverse devuelve mas resultados en
        paginas siguientes, no se ven. Vale para buscar candidatos; no vale
        para afirmar 'esto es todo lo que hay'."""
        with patch("tools.apis.openverse.pedir") as p:
            p.return_value = {"results": [_item("1", "cc0")],
                              "page_count": 5, "result_count": 100}
            r = openverse_audio("mar")
        assert len(r) == 1
        assert p.call_count == 2, "una llamada por licencia, ninguna por pagina"
