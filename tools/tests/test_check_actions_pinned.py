"""La puerta de fijado tiene que fallar cuando toca, no solo pasar cuando todo va bien.

Un comprobador que solo se prueba con el árbol en verde no demuestra nada: lo
que hay que demostrar es que RECHAZA una etiqueta mutable.
"""
import importlib.util
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent.parent
_spec = importlib.util.spec_from_file_location(
    "check_actions_pinned", RAIZ / "tools" / "check_actions_pinned.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)


def test_acepta_sha_completo():
    assert mod.fijada("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1")


def test_acepta_subdirectorio_con_sha():
    assert mod.fijada(
        "github/codeql-action/analyze@ff2f1c621b7f889edc0d3c761ac2e6a3f8cdb0dd")


def test_acepta_accion_local():
    assert mod.fijada("./.github/actions/puerta")


def test_acepta_docker_con_digest():
    assert mod.fijada("docker://alpine@sha256:" + "a" * 64)


def test_rechaza_etiqueta():
    assert not mod.fijada("actions/checkout@v4")


def test_rechaza_rama():
    assert not mod.fijada("actions/checkout@main")


def test_rechaza_sha_corto():
    assert not mod.fijada("actions/checkout@3d3c42e")


def test_rechaza_sin_version():
    assert not mod.fijada("actions/checkout")


def test_el_arbol_actual_esta_limpio():
    """Si esto falla, alguien metió una acción sin fijar: es el aviso, no el test."""
    assert mod.main() == 0
