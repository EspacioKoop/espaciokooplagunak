#!/usr/bin/env python3
"""Falla si algún fichero de texto NUESTRO no termina en salto de línea.

POR QUÉ IMPORTA Y POR QUÉ NO ES MANÍA. Un fichero sin salto final hace que la
última línea se muestre como modificada en el siguiente diff que la toque,
aunque nadie la haya cambiado: ensucia la revisión de un PR con ruido que hay
que descartar a mano. POSIX además define una línea como texto terminado en
`\\n`, así que `wc -l`, `read` y media docena de herramientas cuentan de menos.

QUÉ MIRA Y QUÉ NO. **Solo lo que es del fork**: `foundry-module/`, `docs/`,
`tools/`, `bridge/` y `.github/`. Deliberadamente NO toca `scripts/`,
`resources/`, `netboot/` ni `script_docs/vendor/`, que vienen de EmptyEpsilon
aguas arriba: arreglarles el salto final ahí crearía divergencia permanente con
upstream por un carácter, y `docs/UPSTREAM.md` es explícito en que eso se evita.
El 2026-08-22 había 40 ficheros sin salto final y exactamente la mitad eran de
upstream — la mitad que no se toca.

Se ejecuta sin argumentos desde la raíz. Salida 0 si todo termina bien.
"""
from __future__ import annotations

import pathlib
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent

AREAS = ("foundry-module/", "docs/", "tools/", "bridge/", ".github/")
EXT = (".mjs", ".js", ".py", ".md", ".json", ".yml", ".yaml",
       ".txt", ".sh", ".css", ".html", ".hbs")


def nuestros():
    # `cwd=RAIZ` y `check=True` no son adorno: sin lo primero la guarda mira el
    # árbol equivocado según desde dónde se la invoque, y sin lo segundo un git
    # que falla devuelve stdout vacío — o sea, la guarda pasaría en VERDE sin
    # haber mirado un solo fichero. Una puerta que se abre sola cuando se rompe
    # es peor que no tenerla, porque además tranquiliza.
    salida = subprocess.run(["git", "ls-files"], cwd=RAIZ, check=True,
                            capture_output=True, text=True)
    for ruta in salida.stdout.splitlines():
        if ruta.startswith(AREAS) and ruta.endswith(EXT):
            yield ruta


def sin_salto(ruta: str) -> bool:
    # Las rutas vienen de `git ls-files`, o sea relativas a la RAIZ, no al
    # directorio desde el que se invoque esto.
    try:
        with open(RAIZ / ruta if not pathlib.Path(ruta).is_absolute() else ruta,
                  "rb") as f:
            f.seek(0, 2)
            if f.tell() == 0:
                return False          # vacío: no hay última línea que cerrar
            f.seek(-1, 2)
            return f.read(1) != b"\n"
    except OSError:
        return False


def main() -> int:
    malos = [r for r in nuestros() if sin_salto(r)]
    if not malos:
        print("ok: todos los ficheros de texto propios terminan en salto de línea")
        return 0
    print(f"✗ {len(malos)} fichero(s) sin salto de línea final:")
    for r in malos:
        print(f"    {r}")
    print("\nSe arregla con:  printf '\\n' >> <fichero>")
    return 1


if __name__ == "__main__":
    sys.exit(main())
