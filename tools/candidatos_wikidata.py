#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Candidatos de escultura desde Wikidata con UNA sola peticion (SPARQL)
"""

import argparse
import json
import os
import sys

# El cliente de APIs ya vive en el arbol: import normal, sin rutas del entorno.
# `core` se importa como modulo y no `ULTIMO_MOTIVO` por valor: el motivo del
# ultimo fallo lo reescribe `pedir` en cada llamada, y un `from ... import` lo
# congelaria en el valor que tuviera al arrancar.
from .apis import core
from .apis.wikidata import wikidata

CACHE_FILE = os.path.join(os.path.dirname(__file__), '.wikidata_sculptures.json')
USER_AGENT = 'EspaciokoopLagunak/1.0 (https://github.com/EspacioKoop/espaciokooplagunak)'

SPARQL_QUERY = """SELECT ?item ?itemLabel ?itemDescription ?image ?inception ?collection ?collectionLabel
WHERE
{
  ?item wdt:P31/wdt:P279* wd:Q860861 .
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P195 ?collection . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language \"es,en\" . }
}"""

def pedir_a_wikidata():
    """UNA sola consulta SPARQL. Devuelve el JSON crudo de Wikidata."""
    result = wikidata(SPARQL_QUERY)
    if result is None:
        # Por que fallo
        if core.ULTIMO_MOTIVO == 'presupuesto':
            raise RuntimeError('Presupuesto diario agotado para Wikidata')
        elif core.ULTIMO_MOTIVO == 'no_encontrado':
            raise RuntimeError('No se obtuvo respuesta de Wikidata')
        elif core.ULTIMO_MOTIVO == 'cache_fallo':
            raise RuntimeError('Falló la caché de Wikidata')
        else:
            raise RuntimeError('Failed to fetch from Wikidata (reason unknown)')
    return result

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
