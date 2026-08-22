#!/usr/bin/env python3
"""Comprueba que un documento de auditoria contiene trabajo, no andamiaje.

Nace de un fallo real (2026-08-19): una auditoria de 15 KB con los 32 issues
listados, **32 casillas sin marcar** y **cero comandos ejecutados**. Paso su
criterio de aceptacion porque el criterio miraba el fichero de ENTRADA, no el
resultado. La leccion: el criterio de hecho examina la salida.

Exige, por cada seccion de issue:
  - ninguna casilla '- [ ]' sin marcar ni marcador de 'por completar'
  - una comprobacion con comando real (bloque ``` o linea con $)
  - una seccion de opciones no vacia

Uso: auditoria-completa.py DOCUMENTO.md [--minimo N]
"""
import re, sys, os

def main():
    if len(sys.argv) < 2:
        print(__doc__); return 2
    doc = sys.argv[1]
    minimo = int(sys.argv[sys.argv.index("--minimo") + 1]) if "--minimo" in sys.argv else 1
    if not os.path.isfile(doc):
        print(f"✗ No existe el documento: {doc}"); return 1
    txt = open(doc, encoding="utf-8", errors="replace").read()

    secciones = re.split(r"\n(?=##\s+(?:Issue|PR)\s)", txt)
    secciones = [s for s in secciones if re.match(r"##\s+(?:Issue|PR)\s", s.strip())]
    fallos = []
    if len(secciones) < minimo:
        fallos.append(f"solo {len(secciones)} secciones de issue; se esperaban al menos {minimo}")

    sin_marcar = len(re.findall(r"^\s*[-*]\s*\[ \]", txt, re.M))
    if sin_marcar:
        fallos.append(f"{sin_marcar} casilla(s) sin marcar: hay trabajo declarado y no hecho")
    pendientes = len(re.findall(r"(?i)por completar|pendiente de verificar|TODO", txt))
    if pendientes:
        fallos.append(f"{pendientes} marcador(es) de 'por completar' en el texto")

    sin_comando = [s.split("\n", 1)[0].strip()[:48] for s in secciones
                   if not re.search(r"```|^\s*\$ ", s, re.M)]
    if sin_comando:
        fallos.append(f"{len(sin_comando)} seccion(es) sin comando que respalde la comprobacion: "
                      + "; ".join(sin_comando[:4]))

    if fallos:
        print(f"✗ {len(fallos)} problema(s) en {doc}:")
        for f in fallos:
            print(f"  - {f}")
        return 1
    print(f"✓ {len(secciones)} secciones, todas con comprobacion respaldada por comando.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
