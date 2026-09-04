"""Cliente para Openverse audio.

Solo devuelve lo que Openverse declara como CC0 o Public Domain Mark. No
descarga nada: se queda en los metadatos y en la URL, y quien quiera el fichero
lo pide aparte con su comprobación de licencia hecha.

LA LICENCIA SE LLAMA `pdm`, NO `publicdomain`. Comprobado contra la API real:

    GET /v1/audio/?q=wind&license=publicdomain  ->  400
        {"license": ["License 'publicdomain' does not exist."]}
    GET /v1/audio/?q=wind&license=pdm           ->  200

Pedir `publicdomain` no devolvía «cero resultados de dominio público»: devolvía
un error que el cliente se comía en silencio, así que la mitad de dominio
público de la búsqueda nunca llegaba a hacerse. El síntoma —solo salen CC0— es
indistinguible de «no hay dominio público», que es lo que lo hacía invisible.

Nota medida hoy: el índice de AUDIO de Openverse no tiene, de hecho, ninguna
pieza con `pdm` (`result_count: 0` para music, piano, bell, drum, voice). Eso no
cambia nada de lo anterior: un cliente que pregunta mal está roto aunque la
respuesta correcta esté vacía, y el día que entre audio PDM aparecerá solo.
"""
from .core import pedir
import urllib.parse

# Las dos licencias que este cliente acepta, con el nombre que usa la API.
LICENCIAS_LIBRES = ('cc0', 'pdm')


def openverse_audio(query):
    """Busca audio en Openverse y devuelve solo resultados CC0 o dominio público.

    Args:
        query (str): Término de búsqueda.

    Returns:
        list[dict]: Lista de resultados con las claves:
            - licencia (str): 'cc0' o 'pdm'
            - licencia_version (str): versión de la licencia
            - url (str): URL directa al archivo de audio
            - foreign_landing_url (str): URL de la página donde se aloja el audio
            - creator (str): Creador del audio
    """
    results = []
    seen_ids = set()
    for license_val in LICENCIAS_LIBRES:
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
            # FALLO CERRADO. `item.get('license')` puede venir a None —la API lo
            # hace— y `None.lower()` reventaba el cliente entero con un
            # AttributeError. Pero convertirlo a cadena vacía tampoco basta como
            # excusa: un resultado sin licencia declarada NO es dominio público,
            # es un resultado del que no sabemos nada, y se descarta. Lo mismo
            # vale para cualquier otro tipo que no sea texto.
            licencia_cruda = item.get('license')
            if not isinstance(licencia_cruda, str):
                continue
            licencia = licencia_cruda.lower()
            if licencia in LICENCIAS_LIBRES:
                results.append({
                    'licencia': licencia,
                    'licencia_version': item.get('license_version', ''),
                    'url': item.get('url', ''),
                    'foreign_landing_url': item.get('foreign_landing_url', ''),
                    'creator': item.get('creator', '')
                })
    return results
