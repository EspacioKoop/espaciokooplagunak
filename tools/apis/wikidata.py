"""Cliente para Wikidata SPARQL."""
from .core import pedir
import urllib.parse


def wikidata(query):
    """Consulta SPARQL a Wikidata. Devuelve el JSON crudo o None."""
    url = 'https://query.wikidata.org/sparql'
    encoded_query = urllib.parse.quote(query)
    full_url = f'{url}?query={encoded_query}&format=json'
    return pedir(full_url)