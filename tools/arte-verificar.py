#!/usr/bin/env python3
"""Verifica contra la API del museo las obras citadas en un documento.

Nace de un fallo real (2026-08-19): un documento de referencias artisticas
atribuia el objeto SK-C-5 del Rijksmuseum a "The Letter" de Pieter de Hooch.
SK-C-5 es "La Ronda de Noche", de Rembrandt. Iba firmado como verificado.

Dos fichas correctas y una inventada, las tres con el mismo aspecto de rigor.
Este script comprueba lo que el ojo no distingue.

  - Met Museum:  numeros tipo JP1847 -> API publica, sin clave.
  - Rijksmuseum: numeros tipo SK-A-2344 / SK-C-5 -> Wikidata (P217).

Uso: arte-verificar.py DOCUMENTO.md
Sale con 1 si alguna atribucion no se sostiene.
"""
import json, re, sys, urllib.parse, urllib.request

# Las peticiones van por el modulo comun: cachea en disco para siempre (una
# ficha de museo es inmutable), espacia por host segun el limite QUE CADA API
# DOCUMENTA, y corta con un presupuesto diario. Antes esto pedia a pelo, sin
# cache ni freno, y era el mismo patron que quemo las cuotas de los modelos.
# El cliente vive en el arbol (`tools/apis/`), asi que es un import normal.
# Antes se cargaba por ruta con importlib apuntando a un `lagunak_apis.py`
# hermano que en este repositorio NO existe: el script reventaba al arrancar,
# antes de mirar un solo documento.
import os.path as _op
sys.path.insert(0, _op.dirname(_op.dirname(_op.abspath(__file__))))
from tools.apis import pedir, rijks as _rijks_api


def met(num):
    d = pedir("https://collectionapi.metmuseum.org/public/collection/v1/search"
              f"?q={urllib.parse.quote(num)}")
    for oid in (d or {}).get("objectIDs") or []:
        o = pedir(f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}")
        if o and o.get("accessionNumber", "").upper() == num.upper():
            return {"titulo": o.get("title"), "autor": o.get("artistDisplayName"),
                    "dominio_publico": o.get("isPublicDomain")}
    return None


def rijks(num):
    # Fuente autorizada primero: el propio Rijksmuseum. Wikidata es un espejo
    # y puede ir por detras; el museo es quien tiene la verdad del numero de
    # inventario. Si no hay clave, `oficial` trae {"sin_clave": True} y
    # seguimos por Wikidata sin romper nada.
    oficial = _rijks_api(num)
    if oficial and not oficial.get("sin_clave") and oficial.get("titulo"):
        return {"titulo": oficial["titulo"], "autor": oficial.get("autor") or ""}
    d = pedir("https://www.wikidata.org/w/api.php?action=query&list=search"
              f"&srsearch={urllib.parse.quote('haswbstatement:P217=' + num)}&format=json")
    hits = (d or {}).get("query", {}).get("search") or []
    if not hits:
        d = pedir("https://www.wikidata.org/w/api.php?action=query&list=search"
                  f"&srsearch={urllib.parse.quote('Rijksmuseum ' + num)}&format=json&srlimit=3")
        hits = (d or {}).get("query", {}).get("search") or []
    for h in hits[:3]:
        q = h["title"]
        e = pedir(f"https://www.wikidata.org/wiki/Special:EntityData/{q}.json")
        ent = (e or {}).get("entities", {}).get(q)
        if not ent:
            continue
        invs = [c["mainsnak"]["datavalue"]["value"] for c in ent.get("claims", {}).get("P217", [])
                if c.get("mainsnak", {}).get("datavalue")]
        if any(str(i).upper() == num.upper() for i in invs):
            aut = ""
            for c in ent.get("claims", {}).get("P170", []):
                qa = c["mainsnak"]["datavalue"]["value"]["id"]
                ea = pedir(f"https://www.wikidata.org/wiki/Special:EntityData/{qa}.json")
                aut = (ea or {}).get("entities", {}).get(qa, {}).get(
                    "labels", {}).get("en", {}).get("value", "")
            return {"titulo": ent.get("labels", {}).get("en", {}).get("value"), "autor": aut}
    return None


def main():
    if len(sys.argv) < 2:
        print(__doc__); return 2
    txt = open(sys.argv[1], encoding="utf-8", errors="replace").read()
    bloques = re.split(r"\n(?=##\s)", txt)
    fallos, ok = [], 0
    for b in bloques:
        autor = (re.search(r"\*\*Artista:?\*\*\s*(.+)", b) or [None, ""])[1].strip()
        for num, consulta, museo in ((m, met, "Met") for m in dict.fromkeys(re.findall(r"\b(JP\d{3,5})\b", b))):
            r = consulta(num)
            if not r:
                fallos.append(f"{museo} {num}: no se encuentra en la coleccion")
            elif autor and autor.split()[-1].lower() not in (r["autor"] or "").lower():
                fallos.append(f"{museo} {num} es de «{r['autor']}» ({r['titulo']}), "
                              f"el documento dice «{autor}»")
            else:
                ok += 1
                print(f"✓ {museo} {num}: {r['titulo']} — {r['autor']}")
        for num in dict.fromkeys(re.findall(r"\b(SK-[A-Z]-\d{1,6})\b", b)):
            r = rijks(num)
            if not r:
                fallos.append(f"Rijksmuseum {num}: no se puede confirmar el numero de inventario")
            elif autor and autor.split()[-1].lower() not in (r["autor"] or "").lower():
                fallos.append(f"Rijksmuseum {num} es «{r['titulo']}» de {r['autor']}, "
                              f"el documento lo atribuye a «{autor}»")
            else:
                ok += 1
                print(f"✓ Rijksmuseum {num}: {r['titulo']} — {r['autor']}")
    if fallos:
        print(f"\n✗ {len(fallos)} atribucion(es) que no se sostienen:")
        for f in fallos:
            print(f"  - {f}")
        return 1
    print(f"\n✓ {ok} atribucion(es) verificadas contra la fuente.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
