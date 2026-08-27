#!/usr/bin/env python3
"""Agrupa los PRs en rojo por la CAUSA real de su fallo, no por el check que falla.

POR QUÉ EXISTE. Medido el 2026-08-27 en Lagunak: 34 PRs abiertos, 10 en rojo, y
los diez fallaban exactamente en los mismos dos checks — `tools/tests (Linux)` y
`Puerta de tools`. Eso invita a suponer una causa común y a arreglarla una vez.
Es falso: #803 no declaraba su módulo nuevo en el mapa de áreas y #826 tenía un
fichero sin salto de línea final. Dos causas sin relación bajo el mismo nombre
de check.

El nombre del check dice DÓNDE se cayó; la línea de aserción dice POR QUÉ. Y la
segunda solo se ve abriendo el log de cada run, que a mano son varias llamadas
por PR y una lectura de cientos de líneas de ruido de `actions/checkout`.

QUÉ HACE Y QUÉ NO. Extrae la firma del fallo de cada log y agrupa por ella. No
arregla nada, no opina sobre qué PR merece la pena y no toca la red por su
cuenta: como `issues_similares.py`, recibe lo que `gh` ya ha bajado. Devuelve
una lista agrupada que lee una persona.

USO:

    # 1) recoger (esto sí toca la red)
    python3 tools/triaje-prs-rojos.py --recoger > /tmp/rojos.json

    # 2) agrupar (puro; es lo que se prueba)
    python3 tools/triaje-prs-rojos.py /tmp/rojos.json
    python3 tools/triaje-prs-rojos.py /tmp/rojos.json --json

Sale con 0 siempre: es un informe, no una puerta. Un PR rojo no es un fallo del
repositorio y no debe teñir de rojo nada más.
"""
import json
import re
import subprocess
import sys
from collections import OrderedDict

# Las líneas de `gh run view --log-failed` vienen como
#   <job>\t<paso>\t<marca ISO> <contenido>
# y el contenido es lo único que interesa.
MARCA = re.compile(r"^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?")

# Rutas absolutas del runner: cambian entre ejecuciones del MISMO fallo, así que
# firmarían distinto dos apariciones de una única causa.
RUNNER = re.compile(r"/home/runner/work/[^/]+/[^/]+/")
TEMP = re.compile(r"/(?:home/runner/work/_temp|github/runner_temp)/[A-Za-z0-9._-]+")

# Firmas por PRIORIDAD, no por orden de aparición. Un log trae a la vez el
# `FAILED` de pytest, la queja de la puerta y un `exit code 1`; quedarse con la
# primera línea que casa da la más genérica de las tres, que es exactamente el
# error que esta herramienta existe para no cometer.
FIRMAS = (
    # 0 — causas de verdad: dicen qué aserción se rompió.
    (0, "pytest", re.compile(r"^FAILED\s+(\S+?)(?:\s+-\s+(.*))?$")),
    (0, "node", re.compile(r"^not ok \d+ - (.+)$")),
    (0, "luac", re.compile(r"^luac.*?:\s*(\S+:\d+):\s*(.*)$")),
    # 1 — error que un workflow emite a propósito. Suele ser la causa, salvo
    #     cuando lo emite una puerta, que es el caso de abajo.
    (1, "workflow", re.compile(r"^##\[error\](?!Process completed)(?!La puerta)(.+)$")),
    # 2 — una PUERTA agregadora. `La puerta no pasa: jobs en rojo: tests` no es
    #     una causa: es el nombre del job donde está la causa, en OTRO workflow
    #     cuyo log no viene en este run. Agrupar por esto junta PRs que no
    #     tienen nada que ver, así que se marca como lo que es para que quien
    #     lee sepa que aún falta un salto.
    (2, "puerta", re.compile(r"^##\[error\](La puerta .+)$")),
    # 3 — el paso murió sin decir nada reconocible.
    (3, "salida", re.compile(r"^##\[error\]Process completed with exit code (\d+)")),
)


def limpiar(linea):
    """Deja el contenido de una línea de log, sin job, paso, marca ni rutas del runner."""
    trozo = linea.rstrip("\n").split("\t")[-1]
    trozo = MARCA.sub("", trozo)
    # Secuencias ANSI: los pasos `run:` de los workflows las emiten.
    trozo = re.sub(r"\x1b\[[0-9;]*m", "", trozo)
    trozo = RUNNER.sub("", trozo)
    trozo = TEMP.sub("<temp>", trozo)
    return trozo.strip()


def firma_de_log(texto):
    """Devuelve (clase, detalle) de la PRIMERA causa reconocible del log.

    `None` si el log no dice por qué falló: eso es un resultado legítimo y hay
    que poder distinguirlo de «no he mirado». Inventar una causa para no dejar
    el hueco es peor que el hueco.
    """
    mejor = None
    for linea in texto.splitlines():
        limpia = limpiar(linea)
        if not limpia:
            continue
        for prioridad, clase, patron in FIRMAS:
            m = patron.match(limpia)
            if not m:
                continue
            if mejor is not None and mejor[0] <= prioridad:
                break  # ya tenemos algo igual de bueno o mejor
            partes = [p for p in m.groups() if p]
            detalle = " - ".join(partes).strip()
            if clase == "salida":
                detalle = "el paso terminó con código %s sin causa reconocible" % detalle
            mejor = (prioridad, clase, detalle)
            break
        if mejor is not None and mejor[0] == 0:
            break  # no hay nada más específico que encontrar
    return (mejor[1], mejor[2]) if mejor else None


def agrupar(entradas):
    """Agrupa [{numero, titulo, check, log}] por firma. Orden estable: el grupo
    más numeroso primero, y a igualdad por el PR más bajo, para que dos
    ejecuciones seguidas den el mismo informe."""
    grupos = {}
    for e in entradas:
        f = firma_de_log(e.get("log") or "")
        clave = "%s: %s" % f if f else "sin causa reconocible en el log"
        g = grupos.setdefault(clave, {"causa": clave, "prs": OrderedDict()})
        # Un PR con dos checks rojos por la MISMA causa es un PR, no dos: el
        # informe cuenta trabajo por hacer, y duplicarlo abulta el grupo y
        # desordena el ranking.
        p = g["prs"].setdefault(e["numero"], {
            "numero": e["numero"],
            "titulo": e.get("titulo", ""),
            "checks": [],
        })
        chk = e.get("check", "")
        if chk and chk not in p["checks"]:
            p["checks"].append(chk)
    for g in grupos.values():
        g["prs"] = sorted(g["prs"].values(), key=lambda p: p["numero"])
    return sorted(grupos.values(), key=lambda g: (-len(g["prs"]), g["prs"][0]["numero"]))


def _gh(args):
    return subprocess.run(["gh"] + args, capture_output=True, text=True, check=False).stdout


def recoger():
    """Baja de GitHub los PRs abiertos con checks en rojo y el log de cada fallo."""
    crudo = _gh(["pr", "list", "--state", "open", "--limit", "100",
                 "--json", "number,title,statusCheckRollup"])
    entradas = []
    for pr in json.loads(crudo or "[]"):
        for chk in pr.get("statusCheckRollup") or []:
            estado = chk.get("conclusion") or chk.get("status")
            if estado not in ("FAILURE", "CANCELLED", "TIMED_OUT"):
                continue
            url = chk.get("detailsUrl") or ""
            m = re.search(r"/runs/(\d+)", url)
            if not m:
                continue
            log = _gh(["run", "view", m.group(1), "--log-failed"])
            entradas.append({
                "numero": pr["number"],
                "titulo": pr.get("title", ""),
                "check": chk.get("name") or chk.get("context") or "",
                "log": log,
            })
    return entradas


def main():
    if "--recoger" in sys.argv:
        json.dump(recoger(), sys.stdout, ensure_ascii=False, indent=1)
        return 0
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__.strip().splitlines()[0], file=sys.stderr)
        print("Falta el fichero JSON. Genéralo con --recoger.", file=sys.stderr)
        return 2
    entradas = json.load(open(args[0], encoding="utf-8"))
    grupos = agrupar(entradas)
    if "--json" in sys.argv:
        json.dump(grupos, sys.stdout, ensure_ascii=False, indent=1)
        return 0
    checks = len(entradas)
    prs = len({e["numero"] for e in entradas})
    print("%d checks en rojo, %d PRs, %d causas distintas\n" % (checks, prs, len(grupos)))
    for g in grupos:
        print("── %s" % g["causa"])
        for p in g["prs"]:
            print("   #%-5s %s" % (p["numero"], p["titulo"][:60]))
        if g["causa"].startswith("puerta:"):
            print("   ↳ esto es la queja de una PUERTA, no la causa: el fallo está en")
            print("     el job que nombra, en otro workflow. Abre ese run.")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
