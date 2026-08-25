"""Cliente para Openverse audio."""
from .core import pedir
import urllib.parse


def openverse_audio(query):
    """Busca audio en Openverse y devuelve solo resultados CC0 o dominio publico.

    Args:
        query (str): Término de búsqueda.

    Returns:
        list[dict]: Lista de resultados con las claves:
            - licencia (str): 'cc0' o 'publicdomain'
            - licencia_version (str): versión de la licencia
            - url (str): URL directa al archivo de audio
            - foreign_landing_url (str): URL de la página donde se aloja el audio
            - creator (str): Creador del audio
    """
    results = []
    seen_ids = set()
    for license_val in ('cc0', 'publicdomain'):
        params = urllib.parse.urlencode({
            'q': query,
            'license': license_val
        })
        url = f"https://api.openverse.org/v1/audio/?{params}"
        data = pedir(url)
        if not data:
            continue
        for item in data.get('results', []):
            item_id = item.get('id')
            if item_id and item_id in seen_ids:
                continue
            if item_id:
                seen_ids.add(item_id)
            licencia = item.get('license', '').lower()
            # Normalizar: Openverse devuelve 'cc0', 'publicdomain', etc.
            if licencia in ('cc0', 'publicdomain'):
                results.append({
                    'licencia': licencia,
                    'licencia_version': item.get('license_version', ''),
                    'url': item.get('url', ''),
                    'foreign_landing_url': item.get('foreign_landing_url', ''),
                    'creator': item.get('creator', '')
                })
    return results
