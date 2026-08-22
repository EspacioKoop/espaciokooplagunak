#!/usr/bin/env python3
"""Falla si algún `uses:` de los workflows no está fijado a un SHA completo.

POR QUÉ EXISTE. Las siete acciones de terceros del repositorio ya están fijadas
por SHA de 40 caracteres, pero eso se mantiene **a mano**: nada impide que el
siguiente PR escriba `uses: foo/bar@v3` y nadie se entere. Una etiqueta es
mutable —quien controla el repositorio de la acción puede moverla— así que un
`@v3` es aceptar que un tercero ejecute lo que quiera dentro de nuestro CI, con
nuestros permisos, en cualquier momento futuro.

Esto importa más aquí que en un repositorio normal: hay agentes escribiendo
workflows, y una prohibición escrita en su encargo no ata a nadie. Solo ata un
comando que falle.

QUÉ ACEPTA:
  - referencias locales: `./.github/actions/puerta` (es código de este árbol)
  - `owner/repo@<40 hex>` y `owner/repo/subdir@<40 hex>`
  - `docker://` con digest `@sha256:<64 hex>`

QUÉ RECHAZA: cualquier etiqueta o rama (`@v4`, `@main`, `@latest`).

Se ejecuta sin argumentos desde la raíz del repositorio. Salida 0 si todo está
fijado; 1 y la lista si no.
"""
from __future__ import annotations

import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SHA = re.compile(r"^[0-9a-f]{40}$")
DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
# `uses:` con o sin guion delante, con comillas opcionales.
USES = re.compile(r"^\s*-?\s*uses:\s*['\"]?([^'\"\s#]+)")


def ficheros():
    yield from sorted((RAIZ / ".github" / "workflows").glob("*.yml"))
    yield from sorted((RAIZ / ".github" / "workflows").glob("*.yaml"))
    yield from sorted((RAIZ / ".github" / "actions").rglob("action.yml"))
    yield from sorted((RAIZ / ".github" / "actions").rglob("action.yaml"))


def fijada(ref: str) -> bool:
    if ref.startswith("./") or ref.startswith("../"):
        return True                      # código de este árbol
    if ref.startswith("docker://"):
        _, _, resto = ref.partition("@")
        return bool(DIGEST.match(resto))
    _, _, version = ref.partition("@")
    return bool(SHA.match(version))


def main() -> int:
    sueltas = []
    total = 0
    for f in ficheros():
        for n, linea in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            m = USES.match(linea)
            if not m:
                continue
            total += 1
            ref = m.group(1)
            if not fijada(ref):
                sueltas.append((f.relative_to(RAIZ), n, ref))

    if not sueltas:
        print(f"ok: {total} referencia(s) `uses:`, todas fijadas por SHA o locales")
        return 0

    print(f"✗ {len(sueltas)} de {total} referencia(s) `uses:` SIN fijar:")
    for ruta, n, ref in sueltas:
        print(f"    {ruta}:{n}  {ref}")
    print()
    print("Una etiqueta es mutable: `@v4` hoy y otra cosa mañana, decidido por")
    print("alguien de fuera. Fíjala al SHA completo del commit:")
    print("    gh api repos/<owner>/<repo>/git/refs/tags --jq '.[-1].object.sha'")
    print("y deja la versión en un comentario al lado, para saber qué es ese SHA.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
