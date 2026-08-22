"""Cliente para el Metropolitan Museum of Art."""
from .core import pedir, _en_cache_por_acceso
import urllib.parse


def met(num):
    """Ficha del Metropolitan Museum of Art."""
    o = _en_cache_por_acceso(num, "%metmuseum%/objects/%")
    if o:
        return {"fuente": "met", "titulo": o.get("title"),
                "autor": o.get("artistDisplayName"),
                "dominio_publico": o.get("isPublicDomain"),
                "fecha": o.get("objectDate"), "periodo": o.get("period"),
                "dinastia": o.get("dynasty"), "cultura": o.get("culture"),
                "enlace": o.get("objectURL")}
    d = pedir("https://collectionapi.metmuseum.org/public/collection/v1/search"
              f"?q={urllib.parse.quote(num)}")
    # Tope duro: la búsqueda puede devolver cientos de ids y antes se pedían
    # todos. Los relevantes están al principio; más allá es quemar cuota.
    for oid in ((d or {}).get("objectIDs") or [])[:10]:
        o = pedir("https://collectionapi.metmuseum.org/public/collection/v1/objects/"
                  f"{oid}")
        if o and (o.get("accessionNumber") or "").upper() == num.upper():
            return {"fuente": "met", "titulo": o.get("title"),
                    "autor": o.get("artistDisplayName"),
                    "dominio_publico": o.get("isPublicDomain"),
                    "fecha": o.get("objectDate"), "periodo": o.get("period"),
                    "dinastia": o.get("dynasty"), "cultura": o.get("culture"),
                    "enlace": o.get("objectURL")}
    # Si la busqueda SI respondio y aun asi no hay coincidencia, el numero no
    # existe: eso es un "no encontrado" de verdad, no un "no pude preguntar".
    global ULTIMO_MOTIVO
    if d is not None:
        ULTIMO_MOTIVO = "no_encontrado"
    return None
