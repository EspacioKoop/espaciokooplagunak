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
herramientas de cobertura, `node_modules/` y locks npm anidados. El lock raiz es
un entregable deliberado desde que el pipeline de mallas usa el decoder Draco:
fija la dependencia que instala `npm ci` sin versionar sus binarios descargados.

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

# Ficheros exactos que son resto a cualquier profundidad, sin excepcion posible
# -- al reves que `package-lock.json`, que en la raiz SI es un entregable
# legitimo y por eso su comprobacion vive aparte, en el bucle de abajo.
FICHEROS = ("lcov.info",)

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

# Excepciones declaradas: paquetes npm que SI son el entregable, no un resto
# de paso -- el gemelo de esta lista es la excepcion homonima en `.gitignore`.
# Una ruta aqui es exacta (no un prefijo) y solo cubre el lockfile de un
# paquete con su propio `package.json` intencional, nunca una via generica
# para colar restos futuros.
EXCEPCIONES = (
    "tools/e2e-visual/package-lock.json",
    # `tools/package.json` declara draco3d, que `tools/normalizar-glb.mjs`
    # importa. Hasta #1084 lo instalaban a mano tres jobs distintos con
    # `npm install --no-save`; el centinela de `main` nunca recibio el recado
    # y tinio `main` de rojo con un ERR_MODULE_NOT_FOUND que parecia un fallo
    # de los tests del museo. Una dependencia declarada una vez es lo que
    # impide que la proxima puerta nazca sin ella.
    "tools/package-lock.json",
)


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
    if nombre in FICHEROS:
        return True
    if ruta in EXCEPCIONES:
        return False
    partes = ruta.split("/")
    for i, _ in enumerate(partes):
        cola = "/".join(partes[i:])
        if cola == "package-lock.json":
            return i > 0
        if cola.startswith(RESTOS):
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
