"""Cliente para Europeana (api.europeana.eu)."""
from .core import pedir, _clave
import urllib.parse


def europeana(consulta, reusabilidad="open", media=True, filas=10):
    """Busca en Europeana y devuelve los primeros resultados.

    Args:
        consulta: Término de búsqueda (p.ej. "Vermeer", "Paris").
        reusabilidad: "open" | "restricted" | "permission" (por defecto "open").
        media: Si True, filtra resultados con enlace directo al archivo multimedia.
        filas: Número máximo de resultados a devolver (por defecto 10).

    Returns:
        Lista de dicts con: fuente, titulo, autor, enlace, licencia, imagen, proveedor.
        None si no hay clave, presupuesto agotado o error de red.
    """
    wskey = _clave("EUROPEANA_API_KEY")
    if wskey is None:
        return None

    params = {
        "query": consulta,
        "reusability": reusabilidad,
        "media": "true" if media else "false",
        "rows": filas,
        "wskey": wskey,
        "profile": "rich",
    }
    url = "https://api.europeana.eu/record/v2/search.json?" + urllib.parse.urlencode(params)

    d = pedir(url)
    if not d:
        return None

    items = (d.get("items") or [])
    resultados = []
    for it in items:
        # Europeana usa edm:Preview para miniaturas y edm:isShownBy para el archivo completo
        imagen = None
        for enl in (it.get("edmPreview") or []):
            if enl:
                imagen = enl
                break

        resultados.append({
            "fuente": "europeana",
            "titulo": (it.get("title") or [""])[0] if it.get("title") else "",
            "autor": (it.get("dcCreator") or [""])[0] if it.get("dcCreator") else "",
            "enlace": (it.get("guid") or [""])[0] if it.get("guid") else "",
            "licencia": (it.get("rights") or [""])[0] if it.get("rights") else "",
            "imagen": imagen,
            "proveedor": (it.get("dataProvider") or [""])[0] if it.get("dataProvider") else "",
        })

    return resultados
