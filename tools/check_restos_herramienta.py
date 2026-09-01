#!/usr/bin/env python3
"""Falla si un resto de herramienta esta TRACKEADO en git.

POR QUE NO BASTA EL `.gitignore`. Ignorar una ruta impide que entre por
descuido, pero NO saca lo que ya entro: un fichero que alguien commiteo antes
—o en una rama donde el ignore aun no estaba— sigue trackeado para siempre y
`.gitignore` no dice ni pio. Son dos problemas distintos y hacen falta las dos
mitades.

Y no es hipotetico. El 2026-08-22, con `.nyc_output/` ya ignorado por #673, la
rama de una tarea de cobertura llevaba **cinco ficheros de `.nyc_output/`
commiteados**. El ignore no los vio porque para git ya no eran ficheros nuevos.

QUE MIRA. Solo lo que nunca es un entregable en este arbol: la salida de las
herramientas de cobertura y las dependencias de npm. El modulo se prueba con
`node --test` a secas, sin dependencias, asi que `node_modules/` aqui no es una
decision de empaquetado discutible: es basura de paso.

Se ejecuta sin argumentos desde cualquier sitio del arbol. Salida 0 si limpio.
"""
from __future__ import annotations

import fnmatch
import pathlib
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent

# Prefijos de directorio que nunca deben estar trackeados, en cualquier nivel
# del arbol (coinciden con el propio directorio o con lo que cuelgue de el).
RESTOS = ("node_modules/", ".nyc_output/", "coverage/", "tmp/")
# Nombres de DIRECTORIO (no de fichero) que tampoco deben aparecer en ningun
# nivel: a diferencia de RESTOS, admiten glob porque "coverage-out",
# "coverage-tmp"... son variantes del mismo volcado y no un prefijo fijo.
DIRECTORIOS_RESTO = ("coverage-*",)
FICHEROS = ("package-lock.json",)
# Patrones glob sobre el NOMBRE de fichero (no la ruta): cubren volcados y
# copias de seguridad sueltas que no viven bajo un directorio fijo.
PATRONES_NOMBRE = (
    "*.bak", "*.orig", "*.rej",
    "coverage.json", "coverage.lcov", "coverage_*.txt", "lcov.info",
)


def trackeados():
    salida = subprocess.run(["git", "ls-files"], cwd=RAIZ, check=True,
                            capture_output=True, text=True)
    return salida.stdout.splitlines()


def es_resto(ruta: str) -> bool:
    nombre = ruta.rsplit("/", 1)[-1]
    if any(fnmatch.fnmatch(nombre, patron) for patron in PATRONES_NOMBRE):
        return True
    partes = ruta.split("/")
    for i, segmento in enumerate(partes):
        cola = "/".join(partes[i:])
        if cola.startswith(RESTOS) or cola in FICHEROS:
            return True
        # Un DIRECTORIOS_RESTO solo cuenta si `segmento` es de verdad un
        # directorio (le sigue algo mas de ruta): si no, es el nombre final
        # de un fichero cualquiera y el glob no debe dispararse por el.
        if i < len(partes) - 1 and any(
                fnmatch.fnmatch(segmento, patron)
                for patron in DIRECTORIOS_RESTO):
            return True
    return False


def main() -> int:
    malos = [r for r in trackeados() if es_resto(r)]
    if not malos:
        print("ok: ningun resto de herramienta esta trackeado")
        return 0
    print(f"✗ {len(malos)} fichero(s) que nunca deberian estar en git:")
    for r in malos[:20]:
        print(f"    {r}")
    if len(malos) > 20:
        print(f"    ... y {len(malos) - 20} mas")
    print()
    print("El `.gitignore` no los saca: solo impide que entren NUEVOS. Se quitan")
    print("del indice conservandolos en disco:")
    print("    git rm -r --cached <ruta>")
    return 1


if __name__ == "__main__":
    sys.exit(main())
