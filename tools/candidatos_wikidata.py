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

# Import the lagunak_apis module as required
import importlib.util as i
spec = i.spec_from_file_location('apis', '/home/eloy/.hermes/bin/lagunak_apis.py')
if spec is None:
    print('Error: Could not load lagunak_apis module', file=sys.stderr)
    sys.exit(1)
apis = i.module_from_spec(spec)
spec.loader.exec_module(apis)

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

def fetch_wikidata_json():
    """Fetch the SPARQL query results from Wikidata using lagunak_apis and return as JSON."""
    # Wikidata SPARQL endpoint
    url = 'https://query.wikidata.org/sparql'
    
    # For Wikidata SPARQL, we can use GET with query parameter
    # Format: https://query.wikidata.org/sparql?query=URL_ENCODED_QUERY&format=json
    encoded_query = urllib.parse.quote(SPARQL_QUERY)
    full_url = f'{url}?query={encoded_query}&format=json'
    
    # Use lagunak_apis.pedir which handles caching, rate limiting, etc.
    try:
        result = apis.pedir(full_url)
        if result is None:
            # Check why it failed
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

def load_candidates_from_json(data):
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
            'inception': inception,
            'colección': collection,
            'colección_label': collection_label
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
                data = fetch_wikidata_json()
                # Save to cache
                try:
                    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2)
                except IOError as e:
                    print(f'Warning: Could not write cache file {CACHE_FILE}: {e}', file=sys.stderr)
        else:
            data = fetch_wikidata_json()
            # Save to cache
            try:
                with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2)
            except IOError as e:
                print(f'Warning: Could not write cache file {CACHE_FILE}: {e}', file=sys.stderr)

    candidates = load_candidates_from_json(data)
    # Output as JSON to stdout
    json.dump(candidates, sys.stdout, indent=2, ensure_ascii=False)
    print()  # Newline for clean output

if __name__ == '__main__':
    main()