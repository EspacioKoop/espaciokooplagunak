#!/usr/bin/env python3
"""Cada `tr()` del C++ tiene entrada en los catálogos en-US y es-ES.

Por qué existe: `validate_es_locale.py` compara `main.en.po` contra `main.es.po`,
así que solo ve desajustes ENTRE catálogos. Una cadena nueva en C++ que no llegó a
NINGUNO de los dos es invisible para él —los dos coinciden en no tenerla— y para
todo lo demás en CI. Eso fue exactamente #55: 22 `msgid` nuevos del contexto
`content_editor` y cero entradas de catálogo, con la CI en verde y el editor
saliendo medio en inglés en una partida en español.

`update_main_locale.py` regenera `main.en.po` con xgettext, pero regenerar es un
paso manual que se olvida; esto es la red que avisa cuando se olvidó.

Límite declarado y deliberado: solo se auditan las llamadas con la cadena
literal en la propia llamada. Un `tr()` sobre una variable o una macro no es
extraíble sin compilar, y tampoco lo es por xgettext, así que aquí no se inventa
—se ignora—. Es una red contra el descuido común, no un verificador de tipos.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import polib

# `tr("ctx", "texto")` y `tr("texto")`, más las variantes marcadoras. El segundo
# grupo opcional distingue las dos formas: con dos literales el primero es el
# contexto; con uno solo, no hay contexto (msgctxt None en el PO).
LLAMADA_RE = re.compile(
    r'\b(?:tr|trMark)\s*\(\s*"((?:[^"\\]|\\.)*)"\s*(?:,\s*"((?:[^"\\]|\\.)*)"\s*)?[,)]'
)

CATALOGOS = ("resources/locale/main.en.po", "resources/locale/main.es.po")

# Comentario de bloque, comentario de línea o literal de cadena, en ese orden de
# alternativa: poniendo el literal en la misma pasada, un `//` DENTRO de una
# cadena ("http://…") no se come el resto de la línea.
COMENTARIO_O_CADENA_RE = re.compile(
    r'/\*.*?\*/|//[^\n]*|"(?:[^"\\\n]|\\.)*"', re.DOTALL
)


def sin_comentarios(texto: str) -> str:
    """Quita comentarios y conserva las cadenas, como haría xgettext.

    Hace falta de verdad: el árbol tiene `tr()` y `trMark()` comentados —líneas
    de upstream desactivadas— y contarlos como cadenas vivas obligaría a traducir
    texto que nadie llega a ver.
    """

    def sustituir(m: re.Match[str]) -> str:
        trozo = m.group(0)
        if trozo.startswith('"'):
            return trozo
        # Se conservan los saltos de línea para no descolocar nada aguas abajo.
        return "\n" * trozo.count("\n")

    return COMENTARIO_O_CADENA_RE.sub(sustituir, texto)


def desescapar(texto: str) -> str:
    """De la forma del fuente C++ a la que guarda el PO."""
    return (
        texto.replace("\\n", "\n")
        .replace("\\t", "\t")
        .replace('\\"', '"')
        .replace("\\\\", "\\")
    )


def cadenas_del_fuente(root: Path) -> dict[tuple[str | None, str], list[str]]:
    """Mapa (contexto, msgid) → archivos donde aparece."""
    encontradas: dict[tuple[str | None, str], list[str]] = {}
    for fuente in sorted(root.joinpath("src").rglob("*")):
        if fuente.suffix not in {".cpp", ".h"}:
            continue
        texto = sin_comentarios(fuente.read_text(encoding="utf-8", errors="replace"))
        for primero, segundo in LLAMADA_RE.findall(texto):
            if segundo:
                clave = (desescapar(primero), desescapar(segundo))
            else:
                clave = (None, desescapar(primero))
            if not clave[1]:
                # `tr("")` no es una cadena que traducir.
                continue
            encontradas.setdefault(clave, []).append(
                str(fuente.relative_to(root))
            )
    return encontradas


def claves_del_catalogo(path: Path) -> set[tuple[str | None, str]]:
    po = polib.pofile(str(path), encoding="utf-8")
    return {(e.msgctxt, e.msgid) for e in po if not e.obsolete}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", type=Path, default=Path("."))
    args = parser.parse_args()
    root = args.root.resolve()

    fuente = cadenas_del_fuente(root)
    if not fuente:
        print("no se encontró ninguna llamada tr() en src/", file=sys.stderr)
        return 2

    errores: list[str] = []
    for rel in CATALOGOS:
        path = root / rel
        if not path.exists():
            errores.append(f"falta el catálogo {rel}")
            continue
        catalogo = claves_del_catalogo(path)
        faltan = sorted(k for k in fuente if k not in catalogo)
        for ctx, msgid in faltan:
            archivos = ", ".join(sorted(set(fuente[(ctx, msgid)])))
            errores.append(
                f"{rel}: falta msgctxt={ctx!r} msgid={msgid!r} (usado en {archivos})"
            )

    if errores:
        print(f"cadenas de C++ sin entrada de catálogo: {len(errores)}", file=sys.stderr)
        for e in errores:
            print(f"  {e}", file=sys.stderr)
        print(
            "\nRegenera el catálogo en-US con `python3 tools/update_main_locale.py`\n"
            "y añade la traducción es-ES en resources/locale/main.es.po.",
            file=sys.stderr,
        )
        return 1

    print(f"ok: {len(fuente)} cadenas de C++ presentes en {len(CATALOGOS)} catálogos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
