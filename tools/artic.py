#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Obras del Art Institute of Chicago (AIC) en dominio público con imagen.
UNA sola petición por consulta, cache en disco, salida JSON.

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
import os
import tempfile
import urllib.request
import sys
import urllib.parse

# Sin dependencias fuera del árbol: urllib de la biblioteca estándar basta.
# La versión anterior cargaba un cliente por ruta, con un valor por defecto que
# apuntaba al directorio personal de alguien, y este repositorio es público.

CACHE_FILE = os.path.join(
    os.environ.get('LAGUNAK_CACHE') or tempfile.gettempdir(),
    'lagunak-artic-cache.json')
USER_AGENT = 'EspaciokoopLagunak/1.0 (https://github.com/VaroTv7/espaciokooplagunak)'

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


def _cache_key(texto, fields=None, limit=None):
    """Genera una clave de caché única para la consulta."""
    import hashlib
    key_data = f"{texto}|{fields or DEFAULT_FIELDS}|{limit or DEFAULT_LIMIT}"
    return hashlib.sha256(key_data.encode()).hexdigest()[:16]


def _cache_path(texto, fields=None, limit=None):
    """Ruta del fichero de caché de esta consulta.

    NO va junto al módulo. La versión anterior usaba `os.path.dirname(__file__)`
    y dejaba `.artic_search_*.json` sueltos dentro de `tools/`, que es el árbol
    del repositorio: aparecían como ficheros sin seguir en cuanto alguien
    ejecutaba una búsqueda, y acababan colándose en la rama de quien tocara algo
    después. Se detectó al preparar otro PR, no por un test.
    """
    key = _cache_key(texto, fields, limit)
    base_dir = os.environ.get('LAGUNAK_CACHE') or tempfile.gettempdir()
    os.makedirs(base_dir, exist_ok=True)
    return os.path.join(base_dir, f'lagunak-artic-{key}.json')


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


def pedir_a_artic(texto, fields=None, limit=None):
    """UNA sola petición al AIC. Devuelve el JSON crudo de la API."""
    url = _construir_url(texto, fields, limit)

    peticion = urllib.request.Request(url, headers={
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
    })
    try:
        with urllib.request.urlopen(peticion, timeout=30) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception as e:
        raise RuntimeError(f'No se pudo leer el Art Institute of Chicago: {e}')


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
        # Try to load from cache if exists (cache is per-query)
        cache_path = _cache_path(args.texto, args.fields, args.limit)
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                print(f'Warning: Could not read cache file {cache_path}: {e}', file=sys.stderr)
                data = pedir_a_artic(args.texto, args.fields, args.limit)
                # Save to cache
                try:
                    with open(cache_path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2)
                except IOError as e:
                    print(f'Warning: Could not write cache file {cache_path}: {e}', file=sys.stderr)
        else:
            data = pedir_a_artic(args.texto, args.fields, args.limit)
            # Save to cache
            try:
                with open(cache_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2)
            except IOError as e:
                print(f'Warning: Could not write cache file {cache_path}: {e}', file=sys.stderr)

    obras = obras_desde_json(data)
    # Output as JSON to stdout
    json.dump(obras, sys.stdout, indent=2, ensure_ascii=False)
    print()  # Newline for clean output


if __name__ == '__main__':
    main()
