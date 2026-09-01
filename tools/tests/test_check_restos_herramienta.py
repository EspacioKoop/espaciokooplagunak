"""La guarda de restos tiene que RECHAZAR, no solo pasar con el arbol limpio."""
import importlib.util
import pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent.parent
_spec = importlib.util.spec_from_file_location(
    "check_restos_herramienta", RAIZ / "tools" / "check_restos_herramienta.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)


def test_rechaza_nyc_en_la_raiz():
    assert mod.es_resto(".nyc_output/abc.json")


def test_rechaza_nyc_anidado():
    """El caso real: la basura no siempre cuelga de la raiz del arbol."""
    assert mod.es_resto("foundry-module/.nyc_output/processinfo/index.json")


def test_rechaza_node_modules_anidado():
    assert mod.es_resto("tools/node_modules/nyc/package.json")


def test_rechaza_coverage():
    assert mod.es_resto("coverage/lcov.info")


def test_rechaza_el_lock_de_npm():
    assert mod.es_resto("package-lock.json")


def test_acepta_un_fichero_normal():
    assert not mod.es_resto("foundry-module/scripts/npc-generador.mjs")


def test_no_confunde_un_nombre_que_solo_se_parece():
    """`coverage-algo.md` no es `coverage/`: la barra es la que manda."""
    assert not mod.es_resto("docs/coverage-notas.md")
    assert not mod.es_resto("tools/node_modules_helper.py")


def test_rechaza_coverage_out_anidado():
    """El caso real de #818: `coverage-out/` no es `coverage/`."""
    assert mod.es_resto("coverage-out/coverage-final.json")
    assert mod.es_resto("coverage-out/tmp/coverage-123.json")


def test_rechaza_volcados_de_cobertura_sueltos():
    assert mod.es_resto("coverage.json")
    assert mod.es_resto("coverage.lcov")
    assert mod.es_resto("lcov.info")
    assert mod.es_resto("coverage_current.txt")
    assert mod.es_resto("coverage_full.txt")


def test_rechaza_backup_de_un_test():
    """La senal de que se reescribio un test en vez de ampliarlo (#818)."""
    assert mod.es_resto(
        "foundry-module/tests/consola-caliente-v1.test.mjs.bak")
    assert mod.es_resto("tools/algo.py.orig")
    assert mod.es_resto("tools/algo.py.rej")


def test_rechaza_tmp_anidado():
    assert mod.es_resto("tmp/hermes-verify-test.py")
    assert mod.es_resto("foundry-module/tmp/scratch.json")


def test_no_confunde_bak_dentro_del_nombre():
    """`.bak` como extension real, no como subcadena de otra cosa."""
    assert not mod.es_resto("docs/backup-notas.md")


def test_el_arbol_actual_esta_limpio():
    """Si esto falla, alguien commiteo basura: es el aviso, no el test."""
    assert mod.main() == 0
