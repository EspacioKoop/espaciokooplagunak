"""La guarda de restos tiene que RECHAZAR, no solo pasar con el arbol limpio."""
import importlib.util
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent.parent
_spec = importlib.util.spec_from_file_location(
    "check_restos_herramienta", RAIZ / "tools" / "check_restos_herramienta.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)


def test_rechaza_coverage_out_final_json():
    """Artefacto real: coverage-out/coverage-final.json"""
    assert mod.es_resto("coverage-out/coverage-final.json") is True


def test_rechaza_coverage_out_tmp_foo():
    """Artefacto real: fichero bajo coverage-out/tmp/"""
    assert mod.es_resto("coverage-out/tmp/foo") is True


def test_rechaza_coverage_out_tmp_bar():
    """Otro fichero bajo coverage-out/tmp/"""
    assert mod.es_resto("coverage-out/tmp/bar") is True


def test_rechaza_coverage_json():
    """Artefacto real: coverage.json"""
    assert mod.es_resto("coverage.json") is True


def test_rechaza_coverage_lcov():
    """Artefacto real: coverage.lcov"""
    assert mod.es_resto("coverage.lcov") is True


def test_rechaza_lcov_info():
    """Artefacto real: lcov.info"""
    assert mod.es_resto("lcov.info") is True


def test_rechaza_coverage_current_txt():
    """Uno de los cuatro cobertura_*.txt"""
    assert mod.es_resto("coverage_current.txt") is True


def test_rechaza_coverage_another_txt():
    """Otro cobertura_*.txt"""
    assert mod.es_resto("coverage_another.txt") is True


def test_rechaza_bak():
    """Artefacto real: .bak de test"""
    assert mod.es_resto("foundry-module/tests/consola-caliente-v1.test.mjs.bak") is True


def test_rechaza_tmp_dir():
    """Artefacto real de #797: un script del propio agente bajo tmp/"""
    assert mod.es_resto("tmp/hermes-verify-test.py") is True


def test_rechaza_temp_en_nombre():
    """Fichero *.temp.* en cualquier ruta, no solo bajo tmp/"""
    assert mod.es_resto("reports/result.temp.json") is True


def test_no_rechaza_tmp_como_subcadena_de_otro_nombre():
    """'tmp' solo cuenta como componente exacto de ruta, no como subcadena:
    'template/' o 'tmpfiles.mjs' no son restos por casualidad de nombre."""
    assert mod.es_resto("template/archivo.mjs") is False
    assert mod.es_resto("tmpfiles.mjs") is False


def test_no_rechaza_temp_como_subcadena_de_otro_nombre():
    """'.temp.' tiene que aparecer literal en el nombre, no basta con
    contener las letras 'temp' en otro contexto."""
    assert mod.es_resto("template.mjs") is False
    assert mod.es_resto("temperatura.json") is False


def test_el_arbol_actual_esta_limpio():
    """Si esto falla, alguien commiteo basura: es el aviso, no el test."""
    assert mod.main() == 0
