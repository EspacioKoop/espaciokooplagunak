#!/usr/bin/env python3
"""MNEMÓSINE — vecinos semánticos entre issues: «¿esto ya está abierto?».

Lleva el nombre de la titánide de la MEMORIA porque eso es exactamente lo que
aporta y lo único que aporta: se acuerda del tablero entero. No razona, no
opina y no decide — recuerda y ordena por parecido. (El reparto de nombres
mitológicos está en `docs/TRABAJO_PARALELO_AGENTES.md`.)

POR QUÉ EXISTE. El tablero pasa de las treinta issues abiertas y se solapan de
verdad: #598 salió de mirar lo que #590 dejó en el árbol, #603 sale de #598, y
#584 acabó resuelto por un camino que ni siquiera era el suyo. Encontrar eso a
mano exige acordarse de treinta títulos; buscando por palabras no aparece,
porque dos issues del mismo tema rara vez usan las mismas palabras.

POR QUÉ UN MODELO DE EMBEDDINGS Y NO UNO DE CHAT. Porque este **no genera
texto**: convierte cada issue en un vector y ordena por parecido. No tiene dónde
alucinar, no opina y no decide nada — devuelve una lista ordenada que lee una
persona. Un modelo de chat pequeño puesto a clasificar issues de este repo se
midió en 0 de 3 (falla por vocabulario propio: `retro3d` suena a motor C++ y es
JavaScript). Esa es toda la diferencia entre las dos herramientas.

`all-minilm` son 22 millones de parámetros —unos 45 MB, cien veces menos que el
modelo de chat más pequeño que hay instalado— y va sobrado en CPU.

USO:

    gh issue list --state open --limit 100 --json number,title,body > /tmp/is.json
    python3 tools/issues_similares.py /tmp/is.json            # todos contra todos
    python3 tools/issues_similares.py /tmp/is.json --issue 598 # vecinos de una

Requiere Ollama local con `all-minilm` (`ollama pull all-minilm`). Sin él, el
script lo dice y sale: no hay camino de respaldo silencioso.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import urllib.error
import urllib.request

OLLAMA = "http://127.0.0.1:11434"
MODELO = "all-minilm"
# Cuánto cuerpo se mira. El modelo tiene ventana corta y el título más el primer
# párrafo es donde una issue dice de qué va; más allá empieza el detalle, que es
# lo que hace que dos issues del mismo tema parezcan distintas.
MAX_CUERPO = 600


def texto_de(issue: dict) -> str:
    """Lo que se compara: título y arranque del cuerpo, sin markdown de adorno."""
    cuerpo = (issue.get("body") or "").strip()
    cuerpo = "\n".join(
        linea for linea in cuerpo.splitlines()
        if linea.strip() and not linea.startswith(("|", "```", ">"))
    )
    return f"{issue.get('title', '').strip()}\n{cuerpo[:MAX_CUERPO]}"


def coseno(a: list[float], b: list[float]) -> float:
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return sum(x * y for x, y in zip(a, b)) / (na * nb)


def vecinos(vectores: dict[int, list[float]], numero: int, k: int = 5) -> list[tuple[int, float]]:
    """Los `k` más parecidos a `numero`, de más a menos. Nunca se devuelve a sí mismo."""
    base = vectores[numero]
    puntuados = [
        (otro, coseno(base, vec)) for otro, vec in vectores.items() if otro != numero
    ]
    puntuados.sort(key=lambda par: (-par[1], par[0]))
    return puntuados[:k]


def embeber(textos: list[str]) -> list[list[float]]:
    """Un vector por texto. Falla ruidosamente si Ollama no está: un vector de
    ceros silencioso daría una lista de vecinos plausible y falsa."""
    cuerpo = json.dumps({"model": MODELO, "input": textos}).encode()
    req = urllib.request.Request(
        f"{OLLAMA}/api/embed", data=cuerpo, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return json.load(r)["embeddings"]
    except urllib.error.URLError as e:
        sys.exit(
            f"No hay Ollama en {OLLAMA} ({e}).\n"
            f"Arráncalo y asegúrate del modelo: ollama pull {MODELO}"
        )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("fichero", help="JSON de `gh issue list --json number,title,body`")
    ap.add_argument("--issue", type=int, help="solo los vecinos de esta issue")
    ap.add_argument("--k", type=int, default=5, help="cuántos vecinos (por defecto 5)")
    ap.add_argument(
        "--umbral", type=float, default=0.5,
        help="no enseñar parecidos por debajo de esto (por defecto 0.5)",
    )
    args = ap.parse_args()

    issues = json.load(open(args.fichero, encoding="utf-8"))
    if not issues:
        sys.exit("el fichero no trae ninguna issue")
    titulos = {i["number"]: i.get("title", "") for i in issues}
    vectores = dict(zip(
        (i["number"] for i in issues),
        embeber([texto_de(i) for i in issues]),
    ))

    objetivos = [args.issue] if args.issue else sorted(vectores)
    if args.issue and args.issue not in vectores:
        sys.exit(f"#{args.issue} no está en el fichero")

    for numero in objetivos:
        cercanos = [(o, s) for o, s in vecinos(vectores, numero, args.k) if s >= args.umbral]
        if not cercanos:
            continue
        print(f"\n#{numero} {titulos[numero][:78]}")
        for otro, score in cercanos:
            print(f"   {score:.2f}  #{otro} {titulos[otro][:70]}")


if __name__ == "__main__":
    main()
