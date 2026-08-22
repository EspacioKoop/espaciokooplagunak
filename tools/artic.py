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

La skill /home/eloy/.hermes/skills/research/artic-api/SKILL.md declara endpoints
diferentes (p.ej. POST a /artworks/search con JSON body), pero el endpoint GET
con query parameters como arriba es el que devuelve 200 y datos correctos.
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


CACHE_FILE = os.path.join(os.path.dirname(__file__), '.artic_search.json')
USER_AGENT = 'EspaciokoopLagunak/1.0 (https://github.com/VaroTv7/espaciokooplagunak)'

# El endpoint search del AIC con filtro is_public_domain=true y fields
# NOTA: la skill declara POST con JSON body, pero GET con query params funciona
# y es mas simple. El header AIC-User-Agent es cortesía recomendada en su doc.
SEARCH_URL = 'https://api.artic.edu/api/v1/artworks/search'
DEFAULT_FIELDS = 'id,title,image_id,artist_title,date_display,is_public_domain'
DEFAULT_LIMIT = 10


def _cache_key(texto, fields=None, limit=None):
    """Genera una clave de caché única para la consulta."""
    import hashlib
    key_data = f"{texto}|{fields or DEFAULT_FIELDS}|{limit or DEFAULT_LIMIT}"
    return hashlib.sha256(key_data.encode()).hexdigest()[:16]


def _cache_path(texto, fields=None, limit=None):
    """Ruta del archivo de caché para esta consulta específica."""
    base_dir = os.path.dirname(__file__)
    key = _cache_key(texto, fields, limit)
    return os.path.join(base_dir, f'.artic_search_{key}.json')


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

    # Use lagunak_apis.pedir which handles caching, rate limiting, etc.
    try:
        apis = _cargar_apis()
        result = apis.pedir(url, cabeceras={'AIC-User-Agent': USER_AGENT})
        if result is None:
            # Por qué falló
            if hasattr(apis, 'ULTIMO_MOTIVO'):
                if apis.ULTIMO_MOTIVO == 'presupuesto':
                    raise RuntimeError('Presupuesto diario agotado para Art Institute of Chicago')
                elif apis.ULTIMO_MOTIVO == 'no_encontrado':
                    raise RuntimeError('No se obtuvo respuesta de Art Institute of Chicago')
                elif apis.ULTIMO_MOTIVO == 'cache_fallo':
                    raise RuntimeError('Falló la caché de Art Institute of Chicago')
            else:
                raise RuntimeError('Failed to fetch from Art Institute of Chicago (reason unknown)')
        return result
    except Exception as e:
        raise RuntimeError(f'Failed to fetch from Art Institute of Chicago: {e}')


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