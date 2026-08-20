#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Candidatos de escultura desde Wikidata con UNA sola peticion (SPARQL)
"""

import argparse
import json
import os
import sys
import urllib.parse

# El cliente de APIs (cache, tope diario por host, User-Agent identificado) vive
# todavia FUERA del arbol. La ruta se lee del entorno y NUNCA se incrusta: este
# repositorio es publico, y una ruta /home/alguien publica el nombre de una
# persona ademas de romperse para quien clone. Cuando `tools/apis/` exista, esto
# se sustituye por un import normal.
RUTA_APIS = os.path.expanduser(os.environ.get('LAGUNAK_APIS', '~/.hermes/bin/lagunak_apis.py'))


def _cargar_apis():
    import importlib.util as i
    spec = i.spec_from_file_location('apis', RUTA_APIS)
    if spec is None or not os.path.exists(RUTA_APIS):
        raise RuntimeError(
            f'No se encuentra el cliente de APIs en {RUTA_APIS}. '
            'Indica su ruta en la variable de entorno LAGUNAK_APIS.'
        )
    modulo = i.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo

CACHE_FILE = os.path.join(os.path.dirname(__file__), '.wikidata_sculptures.json')
USER_AGENT = 'EspaciokoopLagunak/1.0 (https://github.com/VaroTv7/espaciokooplagunak)'

SPARQL_QUERY = """
SELECT ?item ?itemLabel ?itemDescription ?image ?inception ?collection ?collectionLabel
WHERE
{
  ?item wdt:P31/wdt:P279* wd:Q860861 .
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P195 ?collection . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en" . }
}
"""

def pedir_a_wikidata():
    """UNA sola consulta SPARQL. Devuelve el JSON crudo de Wikidata."""
    # Wikidata SPARQL endpoint
    url = 'https://query.wikidata.org/sparql'

    # For Wikidata SPARQL, we can use GET with query parameter
    # Format: https://query.wikidata.org/sparql?query=URL_ENCODED_QUERY&format=json
    encoded_query = urllib.parse.quote(SPARQL_QUERY)
    full_url = f'{url}?query={encoded_query}&format=json'

    # Use lagunak_apis.pedir which handles caching, rate limiting, etc.
    try:
        apis = _cargar_apis()
        result = apis.pedir(full_url)
        if result is None:
            # Por que fallo
            if hasattr(apis, 'ULTIMO_MOTIVO'):
                if apis.ULTIMO_MOTIVO == 'presupuesto':
                    raise RuntimeError('Presupuesto diario agotado para Wikidata')
                elif apis.ULTIMO_MOTIVO == 'no_encontrado':
                    raise RuntimeError('No se obtuvo respuesta de Wikidata')
                elif apis.ULTIMO_MOTIVO == 'cache_fallo':
                    raise RuntimeError('Falló la caché de Wikidata')
            else:
                raise RuntimeError('Failed to fetch from Wikidata (reason unknown)')
        return result
    except Exception as e:
        raise RuntimeError(f'Failed to fetch from Wikidata: {e}')

def candidatos_desde_json(data):
    """Load candidates from the Wikidata JSON response."""
    candidates = []
    for bind in data.get('results', {}).get('bindings', []):
        item_uri = bind.get('item', {}).get('value', '')
        # Extract the QID from the URI
        wikidata_id = item_uri.split('/')[-1] if item_uri else ''
        label = bind.get('itemLabel', {}).get('value', '')
        description = bind.get('itemDescription', {}).get('value', '')
        image = bind.get('image', {}).get('value', '')
        inception = bind.get('inception', {}).get('value', '')
        collection = bind.get('collection', {}).get('value', '')
        collection_label = bind.get('collectionLabel', {}).get('value', '')

        # Build the candidate dictionary with the required fields from PROCEDENCIA_ASSETS.md
        candidate = {
            'obra': label,  # We use the label as the obra description
            'qué es el fichero': 'DESCONOCIDO',
            'autoría': '',
            'licencia': 'NO COMPROBADO',
            'enlace': '',
            'sha256': '',
            'cómo se convirtió': '',
            # Extra fields for context
            'wikidata_id': wikidata_id,
            'descripción': description,
            'imagen': image,
            'fecha': inception,
            'coleccion_uri': collection,
            'coleccion': collection_label
        }
        candidates.append(candidate)
    return candidates

def main():
    parser = argparse.ArgumentParser(description='Obtener candidatos de escultura desde Wikidata.')
    parser.add_argument('--desde-fichero', help='Leer la respuesta cruda de un archivo en lugar de hacer la petición a Wikidata.')
    args = parser.parse_args()

    if args.desde_fichero:
        try:
            with open(args.desde_fichero, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except FileNotFoundError:
            print(f'Error: File not found: {args.desde_fichero}', file=sys.stderr)
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f'Error: Invalid JSON in {args.desde_fichero}: {e}', file=sys.stderr)
            sys.exit(1)
    else:
        # Try to load from cache if exists
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                print(f'Warning: Could not read cache file {CACHE_FILE}: {e}', file=sys.stderr)
                data = pedir_a_wikidata()
                # Save to cache
                try:
                    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2)
                except IOError as e:
                    print(f'Warning: Could not write cache file {CACHE_FILE}: {e}', file=sys.stderr)
        else:
            data = pedir_a_wikidata()
            # Save to cache
            try:
                with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2)
            except IOError as e:
                print(f'Warning: Could not write cache file {CACHE_FILE}: {e}', file=sys.stderr)

    candidates = candidatos_desde_json(data)
    # Output as JSON to stdout
    json.dump(candidates, sys.stdout, indent=2, ensure_ascii=False)
    print()  # Newline for clean output

if __name__ == '__main__':
    main()