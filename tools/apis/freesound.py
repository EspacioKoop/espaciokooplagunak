"""Cliente para Freesound (freesound.org)."""
from .core import pedir, _clave
import urllib.parse


def freesound(consulta, filtro=None, campos="id,name,username,license,url,preview-hq-mp3,description", filas=10):
    """Busca sonidos en Freesound.

    Args:
        consulta: Término de búsqueda (p.ej. "piano", "explosion").
        filtro: Filtros adicionales (p.ej. "duration:[1 TO 10]").
        campos: Campos a devolver, separados por comas.
        filas: Número máximo de resultados.

    Returns:
        Lista de dicts con: fuente, id, titulo, autor, licencia, url, preview, descripcion.
        None si no hay clave, presupuesto agotado o error de red.
    """
    token = _clave("FREESOUND_API_KEY")
    if token is None:
        return None

    params = {
        "query": consulta,
        "fields": campos,
        "page_size": filas,
        "token": token,
    }
    if filtro:
        params["filter"] = filtro

    url = "https://freesound.org/apiv2/search/text/?" + urllib.parse.urlencode(params)

    d = pedir(url)
    if not d:
        return None

    resultados = []
    for s in (d.get("results") or []):
        resultados.append({
            "fuente": "freesound",
            "id": s.get("id"),
            "titulo": s.get("name"),
            "autor": s.get("username"),
            "licencia": s.get("license"),
            "url": s.get("url"),
            "preview": s.get("previews", {}).get("preview-hq-mp3"),
            "descripcion": s.get("description"),
        })

    return resultados