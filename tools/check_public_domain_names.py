#!/usr/bin/env python3
"""Check that every published public-domain name is traced to the catalogue.

The legal ground for shipping a name lives in ``docs/DOMINIO_PUBLICO_SCIFI.md``.
The Lua pool in ``scripts/public_domain_names_scenario_utility.lua`` ships
*strings*, and a string that no catalogue row mentions is a name published
without any traceable evidence behind it.

The catalogue's own rule is literal: a form that reaches a player —including its
ASCII normalisation— must appear verbatim in a row. This checker enforces that
rule so the traceability cannot rot silently as either file grows.
"""

from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
POOL = REPO / "scripts" / "public_domain_names_scenario_utility.lua"
CATALOGUE = REPO / "docs" / "DOMINIO_PUBLICO_SCIFI.md"

# Table blocks of the Lua file: `public_domain_names.<theme> = { "A", "B", }`.
POOL_BLOCK = re.compile(
    r"public_domain_names\.(?P<theme>\w+)\s*=\s*\{(?P<body>.*?)\}",
    re.DOTALL,
)
STRING = re.compile(r'"([^"]+)"')


def sin_tildes(texto: str) -> str:
    """ASCII fold, so `Ícaro` in the catalogue covers `Icaro` in the pool."""
    descompuesto = unicodedata.normalize("NFD", texto)
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")


def leer_pool(ruta: Path) -> dict[str, list[str]]:
    texto = ruta.read_text(encoding="utf-8")
    pools: dict[str, list[str]] = {}
    for bloque in POOL_BLOCK.finditer(texto):
        pools[bloque.group("theme")] = STRING.findall(bloque.group("body"))
    return pools


def nombres_del_catalogo(ruta: Path) -> set[str]:
    """Every word-ish token of the catalogue, folded, for literal lookup.

    Deliberately generous on the catalogue side and strict on the pool side: the
    point is to catch a name that appears *nowhere* in the evidence document,
    not to parse Markdown tables exactly.
    """
    texto = sin_tildes(ruta.read_text(encoding="utf-8"))
    return {palabra.casefold() for palabra in re.findall(r"[A-Za-z']+", texto)}


def comprobar(pool: Path = POOL, catalogo: Path = CATALOGUE) -> list[str]:
    """Return one message per untraceable name; empty list means all traced."""
    conocidos = nombres_del_catalogo(catalogo)
    fallos = []
    for tema, nombres in sorted(leer_pool(pool).items()):
        for nombre in nombres:
            if sin_tildes(nombre).casefold() not in conocidos:
                fallos.append(
                    f"{tema}: «{nombre}» no aparece en {catalogo.name}. "
                    "Añádelo a la fila que lo respalda o retíralo del pool."
                )
    return fallos


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pool", type=Path, default=POOL)
    parser.add_argument("--catalogo", type=Path, default=CATALOGUE)
    args = parser.parse_args()

    fallos = comprobar(args.pool, args.catalogo)
    for fallo in fallos:
        print(f"ERROR {fallo}", file=sys.stderr)
    if fallos:
        print(f"\n{len(fallos)} nombre(s) sin trazar.", file=sys.stderr)
        return 1
    print("Todos los nombres del pool están trazados al catálogo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
