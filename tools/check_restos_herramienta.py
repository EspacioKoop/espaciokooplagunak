#!/usr/bin/env python3
"""Falla si un resto de herramienta esta TRACKEADO en git.

POR QUE NO BASTA EL `.gitignore`. Ignorar una ruta impide que entre por
descuido, pero NO saca lo que ya entro: un fichero que alguien commiteo antes
—o en una rama donde el ignore aun no estaba— sigue trackeado para siempre y
`.gitignore` no dice ni pio. Son dos problemas distintos y hacen falta las dos
mitades.

Y no es hipotetico. El 2026-08-22, con `.nyc_output/` ya ignorado por #673, la
rama de una tarea de cobertura llevaba **cinco ficheros de `.nyc_output/`**
commiteados. El ignore no los vio porque para git ya no eran ficheros nuevos.

QUE MIRA. Solo lo que nunca es un entregable en este arbol: la salida de las
herramientas de cobertura y las dependencias de npm. El modulo se prueba con
`node --test` a secas, sin dependencias, asi que `node_modules/` aqui no es una
decision de empaquetado discutible: es basura de paso.

Se ejecuta sin argumentos desde cualquier sitio del arbol. Salida 0 si limpio.
"""
from __future__ import annotations

import pathlib
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent


def trackeados():
    salida = subprocess.run(["git", "ls-files"], cwd=RAIZ, check=True,
                            capture_output=True, text=True)
    return salida.stdout.splitlines()


def es_resto(ruta: str) -> bool:
    partes = ruta.split("/")
    # Check for directory patterns: any component (except the last) that matches:
    #   - exact: 'node_modules', '.nyc_output'
    #   - prefix: starts with 'coverage'
    for i in range(len(partes)-1):  # exclude last component
        comp = partes[i]
        if comp == 'node_modules' or comp == '.nyc_output' or comp == 'tmp' or comp.startswith('coverage'):
            return True
    # Check the last component for file patterns
    last = partes[-1]
    if last == 'package-lock.json':
        return True
    if last.endswith('.lcov') or last == 'lcov.info':
        return True
    if last.endswith('.bak') or last.endswith('.orig') or last.endswith('.rej'):
        return True
    if last.startswith('coverage_') or last.startswith('coverage-'):
        return True
    if last == 'coverage.json':
        return True
    if '.temp.' in last:
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
