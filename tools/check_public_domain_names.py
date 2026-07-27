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


# A catalogue row authorises forms only when its Uso column says ✅. The other
# markers are the opposite of an authorisation: 📝 ships the idea but *not* the
# exact name, and ⛔ is an explicit discard.
AUTORIZA = "\u2705"  # ✅
PROHIBE = ("\U0001F4DD", "\u26D4")  # 📝 ⛔
# Authorised forms are written in bold inside the row. Their column is not
# fixed: the source tables put them last, the toponym tables put them first.
NEGRITA = re.compile(r"\*\*(.+?)\*\*")


def filas_autorizadas(texto: str) -> list[str]:
    """Table rows whose Uso column authorises the forms they carry."""
    filas = []
    for linea in texto.splitlines():
        recortada = linea.strip()
        if not recortada.startswith("|"):
            continue
        if AUTORIZA not in recortada or any(m in recortada for m in PROHIBE):
            continue
        filas.append(recortada)
    return filas


def nombres_del_catalogo(ruta: Path) -> set[str]:
    """Folded tokens of the forms this catalogue actually authorises.

    Only bold spans of rows marked ✅ count. Tokenising the whole document —as
    an earlier version did— also swallowed names the catalogue lists in order to
    *forbid* them (the discard list, the 📝 rows, the prose warnings), so a name
    the evidence explicitly rejects would sail through the gate: exactly the rot
    this checker exists to prevent.
    """
    texto = sin_tildes(ruta.read_text(encoding="utf-8"))
    tokens: set[str] = set()
    for fila in filas_autorizadas(texto):
        for forma in NEGRITA.findall(fila):
            tokens.update(palabra.casefold() for palabra in re.findall(r"[A-Za-z']+", forma))
    return tokens


def comprobar(pool: Path = POOL, catalogo: Path = CATALOGUE) -> list[str]:
    """Return one message per untraceable name; empty list means all traced."""
    conocidos = nombres_del_catalogo(catalogo)
    fallos = []
    for tema, nombres in sorted(leer_pool(pool).items()):
        for nombre in nombres:
            if sin_tildes(nombre).casefold() not in conocidos:
                fallos.append(
                    f"{tema}: «{nombre}» no está autorizado por {catalogo.name}. "
                    "Debe figurar en negrita en una fila marcada ✅; aparecer en "
                    "un descarte, en una fila 📝/⛔ o en la prosa no basta. "
                    "Añade la fila que lo respalde o retíralo del pool."
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
