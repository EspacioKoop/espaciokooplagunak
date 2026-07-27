"""Tests for the public-domain name traceability checker."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from tools import check_public_domain_names as checker  # noqa: E402


def escribir_pool(tmp_path: Path, cuerpo: str) -> Path:
    ruta = tmp_path / "pool.lua"
    ruta.write_text(cuerpo, encoding="utf-8")
    return ruta


def escribir_catalogo(tmp_path: Path, cuerpo: str) -> Path:
    ruta = tmp_path / "DOMINIO_PUBLICO_SCIFI.md"
    ruta.write_text(cuerpo, encoding="utf-8")
    return ruta


def test_el_repositorio_real_esta_trazado():
    """El gate que motiva la herramienta: el pool que se publica hoy."""
    assert checker.comprobar() == []


def test_un_nombre_ausente_del_catalogo_falla(tmp_path):
    pool = escribir_pool(
        tmp_path,
        'public_domain_names.verne = {\n\t"Nautilus", "Vernia",\n}\n',
    )
    catalogo = escribir_catalogo(tmp_path, "| Verne | Nave **Nautilus** |\n")
    fallos = checker.comprobar(pool, catalogo)
    assert len(fallos) == 1
    assert "Vernia" in fallos[0]


def test_la_normalizacion_ascii_cuenta_como_trazada(tmp_path):
    """`Icaro` en el Lua queda cubierto por `Ícaro` en el catálogo."""
    pool = escribir_pool(
        tmp_path,
        'public_domain_names.myth = {\n\t"Icaro", "Nemesis", "Ragnarok",\n}\n',
    )
    catalogo = escribir_catalogo(tmp_path, "**Ícaro**, **Némesis**, **Ragnarök**\n")
    assert checker.comprobar(pool, catalogo) == []


def test_se_leen_todos_los_temas(tmp_path):
    pool = escribir_pool(
        tmp_path,
        'public_domain_names.verne = {\n\t"Nautilus",\n}\n'
        'public_domain_names.basque = {\n\t"Inventado",\n}\n',
    )
    catalogo = escribir_catalogo(tmp_path, "Nautilus\n")
    fallos = checker.comprobar(pool, catalogo)
    assert len(fallos) == 1
    assert fallos[0].startswith("basque:")


def test_main_devuelve_codigo_de_error(tmp_path, capsys):
    pool = escribir_pool(tmp_path, 'public_domain_names.x = {\n\t"Fantasma",\n}\n')
    catalogo = escribir_catalogo(tmp_path, "nada\n")
    assert checker.comprobar(pool, catalogo) != []


@pytest.mark.parametrize("texto,esperado", [("Ícaro", "Icaro"), ("R'lyeh", "R'lyeh")])
def test_plegado_de_tildes(texto, esperado):
    assert checker.sin_tildes(texto) == esperado
