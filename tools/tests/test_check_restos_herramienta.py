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


def test_el_arbol_actual_esta_limpio():
    """Si esto falla, alguien commiteo basura: es el aviso, no el test."""
    assert mod.main() == 0


# --- #818: lo que la lista de tres prefijos dejaba pasar -------------------
#
# Todos estos casos son REALES: salen de los PRs #796 y #797, sobre los que este
# comprobador decia «ok: ningun resto de herramienta esta trackeado».


def test_rechaza_la_familia_coverage_que_no_es_directorio():
    """`coverage-out/` no es `coverage/`, y `coverage.json` no es un directorio."""
    assert mod.es_resto("coverage-out/coverage-final.json")
    assert mod.es_resto("coverage-out/tmp/coverage-1444263-0.json")
    assert mod.es_resto("coverage.json")
    assert mod.es_resto("coverage.lcov")
    assert mod.es_resto("coverage_current.txt")
    assert mod.es_resto("lcov.info")


def test_rechaza_un_bak_de_un_test():
    """El caso que mas importa de #818.

    Un `.bak` no es solo suciedad: es la SENAL de que se reescribio una suite
    existente en vez de anadirle casos. En el PR #796 vino acompanado de 8,45
    puntos de cobertura perdidos, y se ve en el diff antes que en ninguna
    revision humana.
    """
    assert mod.es_resto("foundry-module/tests/consola-caliente-v1.test.mjs.bak")
    assert mod.es_resto("bridge/app.py.orig")
    assert mod.es_resto("scripts/escena.lua.rej")


def test_rechaza_los_restos_de_paso_del_agente():
    """`tmp/` y los `.temp.` de #797."""
    assert mod.es_resto("tmp/hermes-verify-test.py")
    assert mod.es_resto("scripts/locale/scenario_49_allies.temp.po")


def test_la_frontera_es_la_extension_no_el_nombre():
    """Un DOCUMENTO sobre cobertura es un entregable legitimo.

    Esta es la frontera que la primera version de #818 se salto: un prefijo
    `coverage-` a secas cazaba `docs/coverage-notas.md` y convertia la guarda en
    un estorbo. Lo que delata un artefacto es la extension de salida de maquina.
    """
    assert not mod.es_resto("docs/coverage-notas.md")
    assert not mod.es_resto("docs/coverage.md")
    assert not mod.es_resto("foundry-module/scripts/plantilla.temporal.mjs")
    assert not mod.es_resto("tools/tmp_helper.py")

