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

POR QUE SE AMPLIO (#818). La lista original eran tres prefijos de directorio, y
por eso decia «ok» sobre una rama que llevaba NUEVE artefactos: `coverage-out/`
no es `coverage/`, y `coverage.json`, `coverage.lcov`, `lcov.info` y cuatro
volcados `coverage_*.txt` no son directorios en absoluto.

Y el caso que mas importa no es de cobertura: un `.bak` de un fichero de TEST.
No es solo suciedad, es la SEÑAL de que se reescribio una suite existente en vez
de anadirle casos — el modo de fallo que `CLAUDE.md` ya documenta y que en el PR
#796 costo 8,45 puntos de cobertura. Un `.bak` en un diff se ve antes que ninguna
revision humana; por eso vale la pena que lo mire una guarda.

Se ejecuta sin argumentos desde cualquier sitio del arbol. Salida 0 si limpio.
"""
from __future__ import annotations

import pathlib
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent

# Prefijos que nunca deben estar trackeados, en cualquier nivel del arbol.
RESTOS = ("node_modules/", ".nyc_output/", "coverage/", "coverage-out/", "tmp/")
FICHEROS = ("package-lock.json", "lcov.info")

# Sufijos que nunca son entregable. `.bak`/`.orig`/`.rej` son restos de edicion y
# de merge; `.lcov` es cobertura. Se comparan sobre el nombre del fichero, no
# sobre la ruta, para que valgan a cualquier profundidad.
SUFIJOS = (".bak", ".orig", ".rej", ".lcov")

# Nombres que empiezan por estos prefijos: `coverage.json`, `coverage_final.txt`,
# `coverage-summary.json`... La familia entera, porque el tooling inventa un
# nombre nuevo cada vez.
#
# Pero SOLO con extension de salida de maquina. Un documento que hable de
# cobertura es un entregable legitimo —`docs/coverage-notas.md`— y cazarlo seria
# el falso positivo que convierte una guarda en un estorbo. La frontera es la
# extension, no el nombre.
PREFIJOS_NOMBRE = ("coverage.", "coverage-", "coverage_")
EXT_DE_MAQUINA = (".json", ".lcov", ".info", ".xml", ".txt", ".html", ".lst")

# Infijos: un `.temp.` en medio del nombre delata un fichero de paso que
# conservo su extension real para no romper una herramienta —
# `scenario_49_allies.temp.po` en el PR #797— y por eso no lo cazan ni los
# sufijos ni los prefijos.
INFIJOS = (".temp.",)


def trackeados():
    salida = subprocess.run(["git", "ls-files"], cwd=RAIZ, check=True,
                            capture_output=True, text=True)
    return salida.stdout.splitlines()


def es_resto(ruta: str) -> bool:
    nombre = ruta.rsplit("/", 1)[-1]
    if nombre.endswith(SUFIJOS):
        return True
    if nombre.startswith(PREFIJOS_NOMBRE) and nombre.endswith(EXT_DE_MAQUINA):
        return True
    if any(i in nombre for i in INFIJOS):
        return True
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
