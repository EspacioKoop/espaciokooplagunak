"""Cliente para Wikidata mediante su endpoint SPARQL."""
from .core import pedir
import urllib.parse


def wikidata(query: str):
    """Envía una consulta SPARQL a Wikidata y devuelve el JSON crudo.

    Usa el endpoint https://query.wikidata.org/sparql con parámetros
    `query` y `format=json`. La respuesta se cachea y respeta el ritmo
    y el presupuesto definidos en core.py.

    Args:
        query: Consulta SPARQL a enviar.

    Returns:
        dict con la respuesta JSON de Wikidata, o None si falló.
        Cuando devuelve None, consultar core.ULTIMO_MOTIVO para el motivo.
    """
    params = urllib.parse.urlencode({
        'query': query,
        'format': 'json'
    })
    url = f'https://query.wikidata.org/sparql?{params}'
    # El UA se añade automáticamente desde core.UA
    return pedir(url)