#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Obras del Art Institute of Chicago (AIC) en dominio público con imagen.
UNA sola petición por consulta, cache en disco (SQLite via tools.apis), salida JSON.

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
import sys
import urllib.parse

# EL IMPORT TIENE QUE VALER DE LAS DOS FORMAS EN QUE SE EJECUTA ESTO:
#   python3 tools/artic.py ...      → sys.path[0] es `tools/`, no la raíz
#   python3 -m tools.artic ...      → sys.path[0] es la raíz, `tools` es paquete
# `from apis.core import pedir` solo funciona en la primera; `from tools.apis...`
# solo en la segunda. La suite usa la segunda (test_artic.py) y las herramientas
# se invocan a mano con la primera, así que elegir una rompe la otra — que es
# justo lo que pasó: `ModuleNotFoundError: No module named 'apis'` en CI.
# Se resuelve poniendo la RAÍZ en sys.path y usando siempre la ruta completa.
_RAIZ = str(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _RAIZ not in sys.path:
    sys.path.insert(0, _RAIZ)

from tools.apis.core import pedir, ULTIMO_MOTIVO

# Sin dependencias fuera del árbol: urllib de la biblioteca estándar basta.
# La versión anterior cargaba un cliente por ruta, con un valor por defecto que
# apuntaba al directorio personal de alguien, y este repositorio es público.
# AHORA usa tools.apis.core.pedir que gestiona caché SQLite, ritmo y presupuesto.

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
    """Genera una clave de caché única para la consulta.
    
    Mantenida por compatibilidad, pero ya no se usa para ficheros:
    tools.apis.core usa su propia clave interna (URL completa).
    """
    import hashlib
    key_data = f"{texto}|{fields or DEFAULT_FIELDS}|{limit or DEFAULT_LIMIT}"
    return hashlib.sha256(key_data.encode()).hexdigest()[:16]


def _cache_path(texto, fields=None, limit=None):
    """Ruta del fichero de caché de esta consulta.
    
    Mantenida por compatibilidad, pero ya no se usa para ficheros:
    tools.apis.core gestiona su propia caché SQLite en LAGUNAK_CACHE o /tmp.
    Esta función se conserva por si algún código externo la importaba.
    """
    key = _cache_key(texto, fields, limit)
    base_dir = os.environ.get('LAGUNAK_CACHE') or '/tmp'
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
    """UNA sola petición al AIC via tools.apis.core.pedir. Devuelve el JSON crudo de la API."""
    url = _construir_url(texto, fields, limit)

    cabeceras = {
        'Accept': 'application/json',
        'AIC-User-Agent': USER_AGENT,
    }
    data = pedir(url, cabeceras=cabeceras)
    if data is None:
        # `ULTIMO_MOTIVO` explica por qué no se pudo pedir
        motivo = ULTIMO_MOTIVO
        if motivo == 'presupuesto':
            raise RuntimeError('Presupuesto diario agotado para Art Institute of Chicago')
        elif motivo == 'no_encontrado':
            raise RuntimeError('No se obtuvo respuesta de Art Institute of Chicago')
        elif motivo == 'cache_fallo':
            raise RuntimeError('Falló la caché de Art Institute of Chicago')
        else:
            raise RuntimeError(f'Failed to fetch from Art Institute of Chicago (reason: {motivo})')
    return data


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
        # tools.apis.core.pedir ya gestiona caché, ritmo y presupuesto.
        # No hace falta lógica de caché manual aquí.
        data = pedir_a_artic(args.texto, args.fields, args.limit)

    obras = obras_desde_json(data)
    # Output as JSON to stdout
    json.dump(obras, sys.stdout, indent=2, ensure_ascii=False)
    print()  # Newline for clean output


if __name__ == '__main__':
    main()
