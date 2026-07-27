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
    """Catálogo de prueba donde cada nombre del cuerpo va AUTORIZADO.

    El gate solo acepta formas en negrita de filas marcadas ✅, así que el doble
    debe producir esa forma: escribir el nombre en prosa suelta no autoriza
    nada, que es justo la regla que este comprobador hace cumplir.
    """
    filas = []
    for linea in cuerpo.splitlines():
        # Se tolera que el caso de prueba escriba ya un fragmento de fila.
        contenido = linea.strip().strip("|").strip()
        if not contenido:
            continue
        if "**" not in contenido:
            contenido = f"**{contenido}**"
        filas.append(f"| Obra | \u2705 | {contenido} |")
    filas = "\n".join(filas)
    ruta = tmp_path / "DOMINIO_PUBLICO_SCIFI.md"
    ruta.write_text(f"| Fuente | Uso | Elementos |\n| --- | --- | --- |\n{filas}\n", encoding="utf-8")
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


def test_un_nombre_solo_presente_en_descartes_no_pasa(tmp_path):
    """Regresión: el catálogo nombra franquicias para PROHIBIRLAS.

    Tokenizar el documento entero las daba por trazadas, así que una ampliación
    futura podía introducir automáticamente un nombre que el catálogo manda
    excluir y CI seguiría verde — justo el deterioro que este gate impide.
    """
    pool = tmp_path / "pool.lua"
    pool.write_text('public_domain_names.hostil = { "Tarzan", }\n', encoding="utf-8")

    fallos = checker.comprobar(pool=pool, catalogo=checker.CATALOGUE)

    assert len(fallos) == 1
    assert "Tarzan" in fallos[0]


def test_solo_cuentan_las_formas_en_negrita_de_filas_autorizadas(tmp_path):
    catalogo = tmp_path / "catalogo.md"
    catalogo.write_text(
        "| Fuente | Uso | Elementos |\n"
        "| --- | --- | --- |\n"
        "| Obra libre | \u2705 | Nave **Permitido**, nota sin negrita Colateral |\n"
        "| Obra con marca viva | \U0001F4DD | **Prohibido** como etiqueta |\n"
        "| Descartada | \u26D4 | **Descartado**, no usar |\n",
        encoding="utf-8",
    )
    conocidos = checker.nombres_del_catalogo(catalogo)

    assert "permitido" in conocidos
    # Fuera: filas 📝/⛔ y texto sin negrita de una fila autorizada.
    assert "prohibido" not in conocidos
    assert "descartado" not in conocidos
    assert "colateral" not in conocidos
