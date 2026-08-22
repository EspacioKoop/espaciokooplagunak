"""Cliente para el Rijksmuseum."""
from .core import pedir
import urllib.parse
import json


def _texto_ld(nodo, idioma="en"):
    """Saca el texto de un nodo Linked Art, prefiriendo un idioma.

    Todo el desenredo del JSON-LD se hace aquí, en local, sobre la respuesta
    ya descargada. Ninguna de estas funciones vuelve a la red.
    """
    for n in nodo.get("notation") or []:
        if n.get("@language") == idioma and n.get("@value"):
            return n["@value"]
    for n in nodo.get("notation") or []:
        if n.get("@value"):
            return n["@value"]
    return nodo.get("content") or ""


def rijks(num, idioma="en"):
    """Ficha del Rijksmuseum por número de objeto (p.ej. SK-C-5).

    Va al museo que posee la obra, que es la fuente autorizada: es la
    comprobación que caza sola la atribución falsa de SK-C-5.

    Usa la plataforma **data.rijksmuseum.nl**, que **no necesita clave** —
    no la API antigua de Rijksstudio (`www.rijksmuseum.nl/api/...?key=`).
    Son dos peticiones y no hay forma de bajarlo a una: la de búsqueda
    devuelve identificadores Linked Art, y hay que resolver el que salga.
    Ambas quedan cacheadas para siempre, así que se pagan una sola vez.
    """
    d = pedir("https://data.rijksmuseum.nl/search/collection"
              f"?objectNumber={urllib.parse.quote(num)}")
    items = (d or {}).get("orderedItems") or []
    if not items:
        return None
    # La ficha resuelta ronda los 100 KB de JSON-LD. Razón de más para que la
    # caché sea permanente: se descarga una vez en la vida del número.
    obj = pedir(items[0]["id"], cabeceras={"Accept": "application/ld+json"})
    if not obj:
        return None

    titulo, numero = "", ""
    for ident in obj.get("identified_by") or []:
        if ident.get("type") == "Name" and not titulo:
            titulo = ident.get("content") or ""
        elif ident.get("type") == "Identifier" and not numero:
            numero = ident.get("content") or ""

    # El autor cuelga de produced_by.part[].carried_out_by[], no del nivel de
    # arriba: una obra puede tener varias producciones (pintor, grabador...).
    autores = []
    prod = obj.get("produced_by") or {}
    for parte in (prod.get("part") or [prod]):
        for quien in parte.get("carried_out_by") or []:
            nombre = _texto_ld(quien, idioma)
            if nombre and nombre not in autores:
                autores.append(nombre)

    return {"fuente": "rijks", "titulo": titulo, "autor": ", ".join(autores),
            "numero": numero, "url": items[0]["id"]}
