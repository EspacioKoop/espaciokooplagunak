#!/usr/bin/env python3
"""Comprueba la coherencia interna de un documento de inventario en Markdown.

Nace de dos fallos reales (2026-08-19): un inventario cuyos grupos sumaban 179
sobre un total declarado de 171, con cinco ficheros listados dos veces y uno
ausente. Los numeros del resumen salian de un comando y eran exactos; la
agrupacion salia del criterio del modelo y no cuadraba.

Comprueba:
  1. Que la suma de los "(N ...)" de los encabezados iguale el total declarado.
  2. Que ningun elemento entre comillas invertidas aparezca dos veces.
  3. Si se le pasa --contra <directorio>, que los ficheros citados existan y
     que no falte ninguno de los reales.

Uso: tools/doc-coherencia.py DOCUMENTO.md [--contra DIRECTORIO] [--patron '*.mjs,*.js']
Sale con 1 si algo no cuadra, para poder usarlo como criterio de aceptacion.
"""
import os, re, sys
from collections import Counter

def main():
    if len(sys.argv) < 2:
        print(__doc__); return 2
    doc = sys.argv[1]
    contra = None
    patrones = [".mjs", ".js"]
    if "--contra" in sys.argv:
        contra = sys.argv[sys.argv.index("--contra") + 1]
    if "--patron" in sys.argv:
        patrones = [p.strip().lstrip("*") for p in
                    sys.argv[sys.argv.index("--patron") + 1].split(",")]
    if not os.path.isfile(doc):
        print(f"✗ No existe el documento: {doc}"); return 1

    txt = open(doc, encoding="utf-8", errors="replace").read()
    fallos = []

    # 1. Aritmetica: total declarado frente a la suma de los encabezados.
    m = re.search(r"\*\*Total[^:]*:\*\*\s*(\d+)", txt, re.I)
    total = int(m.group(1)) if m else None
    partes = [int(n) for n in re.findall(r"^#{2,4}\s.*?\((\d+)\s", txt, re.M)]
    if total is not None and partes:
        suma = sum(partes)
        if suma != total:
            fallos.append(f"la suma de los grupos es {suma} y el total declarado es {total}"
                          f" (diferencia {suma - total:+d})")
        else:
            print(f"✓ aritmetica: {len(partes)} grupos suman {suma} = total declarado")

    # 1b. Sumas escritas a mano: "a + b + c = N" tiene que sumar de verdad.
    #
    # Sale de un fallo real: la seccion «Verificacion» del inventario arrastro
    # los sumandos de ANTES de corregir la agrupacion —sumaban 179— mientras
    # afirmaba «= 171». Los encabezados ya estaban bien, asi que la comprobacion
    # 1 pasaba y la mentira seguia ahi, en la seccion que existe para negarla.
    for expresion, declarado in re.findall(r"((?:\d+\s*\+\s*)+\d+)\s*=\s*(\d+)", txt):
        sumandos = [int(n) for n in re.findall(r"\d+", expresion)]
        if sum(sumandos) != int(declarado):
            fallos.append(
                f"la suma escrita «{expresion} = {declarado}» da {sum(sumandos)}"
            )

    # 2. Elementos repetidos.
    items = re.findall(r"^\s*[-*]\s+`([^`]+)`", txt, re.M)
    rep = [x for x, n in Counter(items).items() if n > 1]
    if rep:
        fallos.append(f"{len(rep)} elemento(s) listados mas de una vez: {', '.join(sorted(rep)[:6])}")
    elif items:
        print(f"✓ sin repetidos: {len(items)} elementos, todos unicos")

    # 3. Contraste contra el disco.
    if contra:
        reales = set()
        for raiz, _, fs in os.walk(contra):
            for f in fs:
                if any(f.endswith(p) for p in patrones):
                    reales.add(f)
        citados = set(items)
        inventados = citados - reales
        ausentes = reales - citados
        if inventados:
            fallos.append(f"{len(inventados)} citados que NO existen: {', '.join(sorted(inventados)[:6])}")
        if ausentes:
            fallos.append(f"{len(ausentes)} reales que NO aparecen: {', '.join(sorted(ausentes)[:6])}")
        if not inventados and not ausentes:
            print(f"✓ contraste con el disco: {len(reales)} ficheros, cobertura completa")

    if fallos:
        print(f"\n✗ {len(fallos)} incoherencia(s):")
        for f in fallos:
            print(f"  - {f}")
        return 1
    print("\n✓ El documento es coherente consigo mismo.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
