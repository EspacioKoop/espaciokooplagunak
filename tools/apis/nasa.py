"""Cliente para NASA Image and Video Library (images-api.nasa.gov)."""
from .core import pedir
import urllib.parse


def nasa(consulta, media_type=None, page=1, page_size=10):
    """Busca en la NASA Image and Video Library.

    Args:
        consulta: Término de búsqueda libre (p.ej. "apollo 11", "mars rover").
        media_type: "image" | "video" | "audio" | None para todos.
        page: Número de página (empezando en 1).
        page_size: Resultados por página (máximo 100, por defecto 10).

    Returns:
        Lista de dicts con: fuente, nasa_id, titulo, descripcion, fecha, centro,
                           media_type, keywords, preview_url, manifest_url.
        None si presupuesto agotado o error de red.
    """
    params = {
        "q": consulta,
        "page": page,
        "page_size": min(page_size, 100),
    }
    if media_type:
        params["media_type"] = media_type

    url = "https://images-api.nasa.gov/search?" + urllib.parse.urlencode(params)

    d = pedir(url)
    if not d:
        return None

    collection = d.get("collection") or {}
    items = collection.get("items") or []
    resultados = []

    for it in items:
        data_list = it.get("data") or []
        if not data_list:
            continue
        data = data_list[0]

        # Enlace de preview (thumbnail)
        preview = None
        for link in (it.get("links") or []):
            if link.get("rel") == "preview":
                preview = link.get("href")
                break

        # URL del manifest para obtener tamaños completos
        manifest = None
        href = it.get("href")
        if href:
            manifest = href.replace("/collection.json", "/manifest.json") if "collection.json" in href else None

        resultados.append({
            "fuente": "nasa",
            "nasa_id": data.get("nasa_id"),
            "titulo": data.get("title"),
            "descripcion": data.get("description"),
            "fecha": data.get("date_created"),
            "centro": data.get("center"),
            "media_type": data.get("media_type"),
            "keywords": data.get("keywords") or [],
            "preview_url": preview,
            "manifest_url": manifest,
        })

    return resultados


def nasa_asset(nasa_id):
    """Obtiene el manifest de un asset (URLs de diferentes tamaños).

    Args:
        nasa_id: El ID de NASA del asset (p.ej. "as11-40-5874").

    Returns:
        Dict con: nasa_id, urls (lista de URLs de archivos), metadata_url.
        None si no se encuentra o error de red.
    """
    url = f"https://images-api.nasa.gov/asset/{urllib.parse.quote(nasa_id)}"
    d = pedir(url)
    if not d:
        return None

    collection = d.get("collection") or {}
    items = collection.get("items") or []
    urls = [item.get("href") for item in items if item.get("href")]

    # La metadata está en el item que termina en metadata.json
    metadata_url = None
    for u in urls:
        if u.endswith("metadata.json"):
            metadata_url = u
            break

    return {
        "fuente": "nasa",
        "nasa_id": nasa_id,
        "urls": urls,
        "metadata_url": metadata_url,
    }
