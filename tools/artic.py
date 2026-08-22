#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Obras del Art Institute of Chicago (AIC) en dominio público con imagen.
UNA sola petición por consulta, cache en disco (via tools/apis/core.py),
espaciado por host y presupuesto diario, salida JSON.

NOTA: El endpoint verificado que funciona es:
  curl -G 'https://api.artic.edu/api/v1/artworks/search' \
    --data-urlencode 'q=<texto>' \
    --data-urlencode 'query[bool][filter][0][term][is_public_domain]=true' \
    --data-urlencode 'fields=id,title,image_id,artist_title,date_display' \
    --data-urlencode 'limit=10'

La skill `artic-api` del enjambre declara endpoints
diferentes (p.ej. POST a /artworks/search con JSON body), pero el endpoint GET
con query parameters como arriba es el que devuelve 200 y datos correctos.
"""

import argparse
import json
import sys
import urllib.parse

# Usa el cliente compartido: cache SQLite, ritmo por host, presupuesto diario.
# Sin dependencias fuera del árbol: urllib de la biblioteca estándar basta.
from apis.core import pedir

# El endpoint search del AIC con filtro is_public_domain=true y fields
# NOTA: la skill declara POST con JSON body, pero GET con query params funciona
# y es mas simple. El header AIC-User-Agent es cortesía recomendada en su doc.
SEARCH_URL = 'https://api.artic.edu/api/v1/artworks/search'
# Las condiciones que declara el museo. No se inventa una licencia: se enlaza
# lo que el AIC publica, y `dominio_publico` es lo que ÉL afirma, no lo que
# nosotros deduzcamos.
CONDICIONES = 'https://www.artic.edu/terms'

DEFAULT_FIELDS = 'id,title,image_id,artist_title,date_display,is_public_domain'
DEFAULT_LIMIT = 10


def _construir_url(texto, fields=None, limit=None):
    """Construye la URL de búsqueda con los parámetros codificados."""
    params = []
    if texto:
        params.append(('q', texto))
    params.append(('query[bool][filter][0][term][is_public_domain]', 'true'))
    params.append(('fields', fields or DEFAULT_FIELDS))
    params.append(('limit', str(limit or DEFAULT_LIMIT)))
    # urllib.parse.urlencode maneja los corchetes correctamente
    query_string = urllib.parse.urlencode(params)
    return f'{SEARCH_URL}?{query_string}'


def obras_desde_json(data):
    """Load obras from the AIC JSON response, filtering for is_public_domain and image_id."""
    obras = []
    for item in data.get('data', []):
        # Only include if is_public_domain is true AND has image_id
        if not item.get('is_public_domain'):
            continue
        if not item.get('image_id'):
            continue

        obra = {
            'id': item.get('id'),
            'title': item.get('title', ''),
            'artist_title': item.get('artist_title', ''),
            'date_display': item.get('date_display', ''),
            'image_id': item.get('image_id'),
            # IIIF image URL construction (from skill)
            'iiif_base': f'https://www.artic.edu/iiif/2/{item.get("image_id")}' if item.get('image_id') else None,
            'source': 'artic',
            'source_url': f'https://api.artic.edu/api/v1/artworks/{item.get("id")}',
            # La afirmación de procedencia VIAJA con la obra. El filtro del
            # servidor no basta: quien consuma esto tiene que poder ver, en el
            # propio dato, que el museo declara la obra en dominio público. Un
            # filtro que no deja rastro obliga a fiarse, y aquí no nos fiamos.
            'dominio_publico': bool(item.get('is_public_domain')),
            'url_condiciones': CONDICIONES,
        }
        obras.append(obra)
    return obras


def main():
    parser = argparse.ArgumentParser(description='Obtener obras del Art Institute of Chicago en dominio público con imagen.')
    parser.add_argument('texto', nargs='?', default='', help='Texto de búsqueda (opcional, vacío = todas las de dominio público)')
    parser.add_argument('--fields', help='Campos a solicitar (default: id,title,image_id,artist_title,date_display,is_public_domain)')
    parser.add_argument('--limit', type=int, default=DEFAULT_LIMIT, help=f'Límite de resultados (default: {DEFAULT_LIMIT})')
    parser.add_argument('--desde-fichero', help='Leer la respuesta cruda de un archivo en lugar de hacer la petición a AIC.')
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
        # Use shared API client with cache, rate limiting, and budget
        url = _construir_url(args.texto, args.fields, args.limit)
        data = pedir(url, cabeceras={'AIC-User-Agent': 'lagunak-verificador'})
        if data is None:
            from apis.core import ULTIMO_MOTIVO
            print(f'Error: No se pudo leer el Art Institute of Chicago ({ULTIMO_MOTIVO})', file=sys.stderr)
            sys.exit(1)

    obras = obras_desde_json(data)
    # Output as JSON to stdout
    json.dump(obras, sys.stdout, indent=2, ensure_ascii=False)
    print()  # Newline for clean output


if __name__ == '__main__':
    main()