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


def test_acepta_el_lock_raiz_reproducible():
    assert not mod.es_resto("package-lock.json")


def test_rechaza_un_lock_anidado():
    assert mod.es_resto("tools/package-lock.json")


def test_acepta_un_fichero_normal():
    assert not mod.es_resto("foundry-module/scripts/npc-generador.mjs")


def test_acepta_la_excepcion_declarada_de_e2e_visual():
    """`tools/e2e-visual/` es un paquete npm real, el gemelo del `.gitignore`."""
    assert not mod.es_resto("tools/e2e-visual/package-lock.json")


def test_no_generaliza_la_excepcion_a_otras_rutas():
    """La excepcion es exacta: otro lockfile en otro sitio sigue siendo resto."""
    assert mod.es_resto("tools/otra-carpeta/package-lock.json")


def test_no_confunde_un_nombre_que_solo_se_parece():
    """`coverage-algo.md` no es `coverage/`: la barra es la que manda."""
    assert not mod.es_resto("docs/coverage-notas.md")
    assert not mod.es_resto("tools/node_modules_helper.py")


def test_el_arbol_actual_esta_limpio():
    """Si esto falla, alguien commiteo basura: es el aviso, no el test."""
    assert mod.main() == 0
