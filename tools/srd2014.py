#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Cliente para el SRD 5.1 de D&D 5e (2014) desde dnd5eapi.co.
Salida JSON con atribución CC-BY-4.0.

Nota: La skill fivee-bits-api (https://5e-bits.github.io/api/classes.json) devuelve 404.
      Usamos el endpoint verificado: https://www.dnd5eapi.co/api/2014/
"""

import argparse
import json
import os
import sys
import tempfile
import urllib.request

# Sin dependencias fuera del árbol: urllib de la biblioteca estándar basta.
#
# La versión anterior cargaba un cliente de APIs por ruta, con un valor por
# defecto que apuntaba al directorio personal de alguien. Este repositorio es
# público: una ruta así publica el nombre de una persona y además se rompe para
# quien clone. Es el mismo fallo que ya se corrigió en tools/nasa3d.py.

CACHE_FILE = os.path.join(
    os.environ.get('LAGUNAK_CACHE') or tempfile.gettempdir(),
    'lagunak-srd2014-cache.json')
USER_AGENT = 'EspaciokoopLagunak/1.0 (https://github.com/EspacioKoop/espaciokooplagunak)'
API_BASE = 'https://www.dnd5eapi.co'

def pedir_a_srd(ruta):
    """
    Hace una petición a dnd5eapi.co para la ruta dada (debe comenzar con /api/2014/).
    Devuelve el JSON crudo de la API.
    Usa caché en disco para evitar peticiones repetidas.
    """
    if not ruta.startswith('/api/2014/'):
        raise ValueError(f'La ruta debe comenzar con /api/2014/, se recibió: {ruta}')

    # Check cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            # If cache is corrupted or unreadable, we'll fetch again
            pass

    # Fetch from API
    url = API_BASE + ruta
    try:
        peticion = urllib.request.Request(url, headers={
            'Accept': 'application/json',
            'User-Agent': USER_AGENT,
        })
        with urllib.request.urlopen(peticion, timeout=30) as r:
            result = json.loads(r.read().decode('utf-8'))
        # Save to cache
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2)
        except IOError as e:
            print(f'Warning: Could not write cache file {CACHE_FILE}: {e}', file=sys.stderr)
        return result
    except Exception as e:
        raise RuntimeError(f'Failed to fetch from dnd5eapi.co: {e}')

def add_attribution(data):
    """
    Añade un campo de atribución al dato (dict o list) y lo devuelve.
    Si data es un dict, agrega la clave '_attribution'.
    Si data es una lista, agrega la clave '_attribution' a cada elemento si es dict,
    o envuelve la lista en un dict con '_attribution' y 'results'.
    Para simplificar, siempre enviamos un dict con '_attribution' y 'data'.
    """
    attribution = {
        'source': 'dnd5eapi.co',
        'license': 'CC-BY-4.0',
        'url': API_BASE
    }
    if isinstance(data, dict):
        result = data.copy()
        result['_attribution'] = attribution
        return result
    elif isinstance(data, list):
        # Envuelve la lista en un dict con atribución y resultados
        return {
            '_attribution': attribution,
            'results': data
        }
    else:
        # Para otros tipos (string, number, etc.) enviamos un dict con atribución y valor
        return {
            '_attribution': attribution,
            'value': data
        }

def get_attribution():
    """Devuelve la cadena de atribución para imprimir en pantalla."""
    return "Source: dnd5eapi.co (CC-BY-4.0)"

def main():
    parser = argparse.ArgumentParser(description='Obtener datos del SRD 5.1 desde dnd5eapi.co.')
    parser.add_argument('--ruta', help='Ruta de la API (ej. /api/2014/monsters/goblin). Debe comenzar con /api/2014/.')
    parser.add_argument('--desde-fichero', help='Leer la respuesta cruda de un archivo en lugar de hacer la petición a dnd5eapi.co.')
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
        if not args.ruta:
            parser.error('Se requiere --ruta o --desde-fichero')
        # Try to load from cache if exists
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                print(f'Warning: Could not read cache file {CACHE_FILE}: {e}', file=sys.stderr)
                data = pedir_a_srd(args.ruta)
                # Save to cache
                try:
                    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2)
                except IOError as e:
                    print(f'Warning: Could not write cache file {CACHE_FILE}: {e}', file=sys.stderr)
        else:
            data = pedir_a_srd(args.ruta)
            # Save to cache
            try:
                with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2)
            except IOError as e:
                print(f'Warning: Could not write cache file {CACHE_FILE}: {e}', file=sys.stderr)

    # Add attribution
    data_with_attribution = add_attribution(data)
    # Output as JSON to stdout
    json.dump(data_with_attribution, sys.stdout, indent=2, ensure_ascii=False)
    print()  # Newline for clean output

if __name__ == '__main__':
    main()

def atribucion():
    """La atribución que CC-BY-4.0 obliga a mostrar, para pintarla en pantalla.

    CC-BY no es dominio público: usar el SRD sin atribuir incumple la licencia.
    Por eso esto es una función pública y no un detalle interno.
    """
    return {
        'fuente': 'dnd5eapi.co',
        'obra': 'System Reference Document 5.1 (SRD 5.1)',
        'licencia': 'CC-BY-4.0',
        'url': API_BASE,
        'url_licencia': 'https://creativecommons.org/licenses/by/4.0/',
        'texto': 'Datos del SRD 5.1 vía dnd5eapi.co, bajo licencia CC-BY-4.0.',
    }
