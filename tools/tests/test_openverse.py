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
        # Se consulta DOS veces (cc0 y pdm) pero el mismo `id` se
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

    def test_licencia_null_no_revienta_el_cliente(self):
        """`"license": null` llega de la API y `None.lower()` tiraba un
        AttributeError que se llevaba por delante la busqueda ENTERA, no solo
        ese resultado. Descartado en fallo cerrado: sin licencia declarada no
        se sabe nada del fichero, asi que no pasa."""
        with patch("tools.apis.openverse.pedir") as p:
            p.return_value = {"results": [_item("1", None), _item("2", "cc0")]}
            r = openverse_audio("mar")
        assert [x["licencia"] for x in r] == ["cc0"]

    def test_licencia_de_otro_tipo_tampoco_revienta(self):
        """Lo mismo para cualquier cosa que no sea texto: se descarta en vez de
        romper. `123.lower()` fallaria igual."""
        with patch("tools.apis.openverse.pedir") as p:
            p.return_value = {"results": [_item("1", 123), _item("2", ["cc0"])]}
            assert openverse_audio("mar") == []


class TestNombreDeLaLicencia:
    """La API llama `pdm` al dominio publico, no `publicdomain`.

    Comprobado contra la API real:
        ?license=publicdomain -> 400 {"license": ["License 'publicdomain'
                                       does not exist."]}
        ?license=pdm          -> 200
    Preguntar por `publicdomain` no daba "cero resultados de dominio publico":
    daba un error que el cliente se comia en silencio, asi que esa mitad de la
    busqueda nunca se hacia. El sintoma --solo salen CC0-- es indistinguible de
    "no hay dominio publico", que es lo que lo hacia invisible.
    """

    def test_consulta_pdm_y_nunca_publicdomain(self):
        with patch("tools.apis.openverse.pedir") as p:
            p.return_value = {"results": []}
            openverse_audio("mar")
        pedidas = [c.args[0] for c in p.call_args_list]
        assert any("license=pdm" in u for u in pedidas), pedidas
        assert not any("license=publicdomain" in u for u in pedidas), pedidas

    def test_acepta_resultados_marcados_pdm(self):
        """De nada sirve pedir `pdm` si luego se descarta lo que llega."""
        with patch("tools.apis.openverse.pedir") as p:
            p.return_value = {"results": [_item("1", "pdm")]}
            r = openverse_audio("mar")
        assert len(r) == 1
        assert r[0]["licencia"] == "pdm"


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
        """Se consulta dos veces (cc0 y pdm) y un mismo elemento
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


class TestExportsDelPaquete:
    """Openverse SUMA, no sustituye.

    El PR reemplazo `from .wikidata import wikidata` por el import de
    Openverse, asi que `from tools.apis import wikidata` dejaba de ser la
    funcion y pasaba a resolverse al MODULO del mismo nombre: llamarla daba
    `TypeError: 'module' object is not callable`. Es la forma mas traicionera
    del fallo, porque el import sigue funcionando y solo revienta al invocar.
    """

    def test_wikidata_sigue_siendo_invocable(self):
        from tools.apis import wikidata
        assert callable(wikidata), "wikidata debe seguir siendo la funcion, no el modulo"

    def test_openverse_tambien_esta_exportado(self):
        from tools.apis import openverse_audio
        assert callable(openverse_audio)

    def test_ambos_declarados_en_all(self):
        import tools.apis as apis
        assert "wikidata" in apis.__all__
        assert "openverse_audio" in apis.__all__
