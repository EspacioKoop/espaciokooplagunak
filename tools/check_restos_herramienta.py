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

import pathlib
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent

# Prefijos que nunca deben estar trackeados, en cualquier nivel del arbol.
RESTOS = ("node_modules/", ".nyc_output/", "coverage/")
FICHEROS = ("package-lock.json",)

# Excepciones declaradas: paquetes npm que SI son el entregable, no un resto
# de paso -- el gemelo de esta lista es la excepcion homonima en `.gitignore`.
# Una ruta aqui es exacta (no un prefijo) y solo cubre el lockfile de un
# paquete con su propio `package.json` intencional, nunca una via generica
# para colar restos futuros.
EXCEPCIONES = ("tools/e2e-visual/package-lock.json",)


def trackeados():
    salida = subprocess.run(["git", "ls-files"], cwd=RAIZ, check=True,
                            capture_output=True, text=True)
    return salida.stdout.splitlines()


def es_resto(ruta: str) -> bool:
    if ruta in EXCEPCIONES:
        return False
    partes = ruta.split("/")
    for i, _ in enumerate(partes):
        cola = "/".join(partes[i:])
        if cola.startswith(RESTOS) or cola in FICHEROS:
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
