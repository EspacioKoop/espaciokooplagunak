"""Cliente para Lospec (lospec.com) - paletas de pixel art."""
from .core import pedir
import urllib.parse


def lospec(nombre_paleta):
    """Descarga una paleta de Lospec por su slug/nombre.

    Args:
        nombre_paleta: Slug de la paleta (p.ej. "greyt-bit", "beam", "nokia-6100").
                       Es la parte final de la URL: https://lospec.com/palette-list/greyt-bit

    Returns:
        Dict con: fuente, nombre, autor, colores (lista de hex strings).
        None si no se encuentra, presupuesto agotado o error de red.
    """
    # Lospec usa minúsculas y guiones en los slugs
    slug = nombre_paleta.strip().lower()
    url = f"https://lospec.com/palette-list/{urllib.parse.quote(slug)}.json"

    d = pedir(url)
    if not d:
        return None

    return {
        "fuente": "lospec",
        "nombre": d.get("name"),
        "autor": d.get("author"),
        "colores": d.get("colors") or [],
    }


def lospec_aleatoria():
    """Obtiene una paleta aleatoria de Lospec.

    Returns:
        Mismo formato que lospec(), o None si falla.
    """
    url = "https://lospec.com/palette-list/random.json"
    d = pedir(url)
    if not d:
        return None

    return {
        "fuente": "lospec",
        "nombre": d.get("name"),
        "autor": d.get("author"),
        "colores": d.get("colors") or [],
    }
