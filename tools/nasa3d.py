#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Catálogo de NASA 3D Resources, con la procedencia que se pueda demostrar.

Cataloga; no descarga. La salida lleva los campos que `arte-verificar.py`
necesita para juzgar si una pieza puede entrar en el árbol.

QUÉ NO DECLARA, Y POR QUÉ. El repositorio `nasa/NASA-3D-Resources` **no trae
fichero de licencia** —la API de GitHub devuelve `license: null`— y su README
remite a las condiciones de uso de medios de NASA. Así que este módulo publica
`licencia_declarada: null` y el enlace a esas condiciones, y **no afirma dominio
público**. Que un material sea de una agencia pública no es una licencia, y
rellenar ese campo a ojo es exactamente lo que la verificación de procedencia
existe para impedir.

UNA SOLA PETICIÓN. El árbol recursivo completo son 1.583 entradas sin truncar,
así que una llamada trae el catálogo entero y se guarda en caché. Nada de una
petición por modelo.

ANÓNIMO. Ni credenciales, ni correo, ni rutas de nadie: este repositorio es
público. La caché va donde diga el entorno, y si no, al directorio temporal
del sistema.
"""

import argparse
import json
import os
import sys
import tempfile
import time
import urllib.request
from urllib.parse import quote

REPO = "nasa/NASA-3D-Resources"
ARBOL = f"https://api.github.com/repos/{REPO}/git/trees/HEAD?recursive=1"
FICHA = f"https://github.com/{REPO}/tree/master/"
CONDICIONES = "https://www.nasa.gov/nasa-brand-center/images-and-media"
CRUDO = f"https://raw.githubusercontent.com/{REPO}/master/"

# Lo que sirve como malla, y lo que sirve como textura que la acompaña.
MALLAS = (".glb", ".stl", ".obj", ".blend", ".3ds", ".fbx")
TEXTURAS = (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp")

CADUCA = 24 * 3600  # segundos


def ruta_cache():
    base = os.environ.get("LAGUNAK_CACHE") or os.path.join(tempfile.gettempdir(), "lagunak-apis")
    os.makedirs(base, exist_ok=True)
    return os.path.join(base, "nasa3d-arbol.json")


def traer_arbol(sin_cache=False, timeout=30):
    """El árbol completo, de la caché si vale, y si no de una sola petición."""
    cache = ruta_cache()
    if not sin_cache and os.path.exists(cache):
        if time.time() - os.path.getmtime(cache) < CADUCA:
            with open(cache, encoding="utf-8") as f:
                return json.load(f)
    pet = urllib.request.Request(ARBOL, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "lagunak-catalogo/1.0 (+https://github.com/EspacioKoop/espaciokooplagunak)",
    })
    with urllib.request.urlopen(pet, timeout=timeout) as r:
        datos = json.loads(r.read().decode("utf-8"))
    with open(cache, "w", encoding="utf-8") as f:
        json.dump(datos, f)
    return datos


def _escapa(ruta):
    return quote(ruta)


def piezas(arbol):
    """Una entrada por MODELO: su carpeta, sus mallas y sus texturas.

    El catálogo de NASA no es un índice: es la propia jerarquía de carpetas.
    `3D Models/<nombre>/<ficheros>` y `3D Printing/<nombre>/<ficheros>`.
    """
    porcarpeta = {}
    for nodo in arbol.get("tree", []):
        if nodo.get("type") != "blob":
            continue
        ruta = nodo["path"]
        trozos = ruta.split("/")
        if len(trozos) < 3:
            continue
        seccion, nombre = trozos[0], trozos[1]
        if seccion not in ("3D Models", "3D Printing", "Images and Textures"):
            continue
        ext = os.path.splitext(ruta)[1].lower()
        if ext not in MALLAS + TEXTURAS:
            continue
        clave = (seccion, nombre)
        e = porcarpeta.setdefault(clave, {
            "identificador": f"{seccion}/{nombre}",
            "titulo": nombre,
            "seccion": seccion,
            "url_ficha": FICHA + _escapa(f"{seccion}/{nombre}"),
            # Lo que de verdad se sabe de las condiciones. Ver la cabecera:
            # ausencia de licencia declarada NO es dominio público.
            "licencia_declarada": None,
            "url_condiciones": CONDICIONES,
            "fuente": REPO,
            "mallas": [],
            "texturas": [],
        })
        destino = "mallas" if ext in MALLAS else "texturas"
        e[destino].append({
            "ruta": ruta,
            "url_fichero": CRUDO + _escapa(ruta),
            "formato": ext.lstrip("."),
            "bytes": nodo.get("size"),
            "sha": nodo.get("sha"),
        })
    return [e for e in porcarpeta.values() if e["mallas"]]


def filtrar(items, texto=None, formato=None):
    fuera = []
    for e in items:
        if texto and texto.lower() not in e["titulo"].lower():
            continue
        if formato:
            ms = [m for m in e["mallas"] if m["formato"] == formato.lower()]
            if not ms:
                continue
            e = dict(e, mallas=ms)
        fuera.append(e)
    return sorted(fuera, key=lambda x: x["identificador"])


def main(argv=None):
    p = argparse.ArgumentParser(description="Cataloga NASA 3D Resources. No descarga nada.")
    p.add_argument("--buscar", help="filtra por texto en el título")
    p.add_argument("--formato", help="solo modelos con malla en este formato (glb, stl…)")
    p.add_argument("--limite", type=int, default=0, help="corta la salida a N modelos")
    p.add_argument("--sin-cache", action="store_true", help="fuerza la petición")
    a = p.parse_args(argv)

    try:
        arbol = traer_arbol(sin_cache=a.sin_cache)
    except Exception as e:
        print(json.dumps({"error": f"no se pudo leer el catálogo: {e}"}, ensure_ascii=False))
        return 1

    items = filtrar(piezas(arbol), a.buscar, a.formato)
    if a.limite:
        items = items[:a.limite]
    print(json.dumps({"fuente": REPO, "total": len(items), "piezas": items},
                     ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
