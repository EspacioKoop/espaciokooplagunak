#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
NASA 3D Resources catalog search tool.
Provides a single query interface to NASA 3D Resources metadata.
Outputs JSON with fields for provenance verification.
"""

import argparse
import json
import os
import sys
import urllib.parse

# The API client (cache, daily quota per host, identified User-Agent) lives
# outside the tree. The path is read from the environment and NEVER hardcoded:
# this repository is public, and a hardcoded /home/user would leak a username
# and break for anyone else cloning. When `tools/apis/` exists, this should be
# replaced by a normal import.
RUTA_APIS = os.path.expanduser(os.environ.get('LAGUNAK_APIS', '~/.hermes/bin/lagunak_apis.py'))


def _cargar_apis():
    """Load the lagunak_apis module from the given path."""
    import importlib.util as i
    spec = i.spec_from_file_location('apis', RUTA_APIS)
    if spec is None or not os.path.exists(RUTA_APIS):
        raise RuntimeError(
            f'API client not found at {RUTA_APIS}. '
            'Set the LAGUNAK_APIS environment variable to its path.'
        )
    modulo = i.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def _get_meta_json():
    """
    Fetch and cache the NASA 3D Resources meta.json from GitHub.
    Uses lagunak_apis for caching and rate limiting.
    Returns the parsed JSON data.
    """
    CACHE_FILE = os.path.join(os.path.dirname(__file__), '.nasa3d_meta.json')
    GITHUB_META_URL = 'https://raw.githubusercontent.com/nasa/3D-Resources/master/meta.json'

    # Try to load from cache first
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Basic validation: check if it's a dict with 'models' key
                if isinstance(data, dict) and 'models' in data:
                    return data
        except (json.JSONDecodeError, IOError) as e:
            # If cache is corrupted, we'll re-download
            pass

    # Cache miss or invalid: download from GitHub
    try:
        apis = _cargar_apis()
        result = apis.pedir(GITHUB_META_URL)
        if result is None:
            # Check why it failed
            if hasattr(apis, 'ULTIMO_MOTIVO'):
                if apis.ULTIMO_MOTIVO == 'presupuesto':
                    raise RuntimeError('Daily budget exhausted for GitHub')
                elif apis.ULTIMO_MOTIVO == 'no_encontrado':
                    raise RuntimeError('meta.json not found on GitHub')
                elif apis.ULTIMO_MOTIVO == 'cache_fallo':
                    raise RuntimeError('GitHub cache failed')
            else:
                raise RuntimeError('Failed to fetch meta.json from GitHub (unknown reason)')
        # Parse the JSON
        data = json.loads(result)
        # Save to cache
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
        except IOError as e:
            # Non-fatal: warn but continue
            print(f'Warning: Could not write cache file {CACHE_FILE}: {e}', file=sys.stderr)
        return data
    except Exception as e:
        raise RuntimeError(f'Failed to fetch and parse meta.json: {e}')


def _build_download_url(file_path):
    """
    Convert a GitHub file path to a NASA CDN download URL.
    Based on nasa-3d-model-downloader skill.
    """
    base_cdn = "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources"
    
    # Handle empty or invalid paths
    if not file_path:
        return f'{base_cdn}/?emrc=auto'
    
    # Split the path into components
    components = file_path.split('/')
    
    if len(components) == 0:
        return f'{base_cdn}/?emrc=auto'
    
    # Map the first component (special prefix)
    prefix_map = {
        '3D Models': 'model',
        '3D Printing': 'printable', 
        'Images and Textures': 'texture'
    }
    
    first_component = components[0]
    if first_component in prefix_map:
        transformed_first = prefix_map[first_component]
    else:
        # If not a known prefix, keep it as-is but lowercase
        transformed_first = first_component.lower()
    
    # If there's only one component (just a filename), handle it specially
    if len(components) == 1:
        # Just a filename, URL encode spaces
        path = components[0].replace(' ', '%20')
        return f'{base_cdn}/{path}?emrc=auto'
    
    # Transform directory name components (middle parts)
    transformed_dirs = []
    for i in range(1, len(components) - 1):
        original = components[i]
        transformed = _transform_directory_name(original)
        transformed_dirs.append(transformed)
    
    # Transform filename (last component)
    original_filename = components[-1]
    transformed_filename = _transform_filename(original_filename)
    
    # Reassemble the path
    if transformed_dirs:
        # Join directory components with forward slash
        dirs_str = '/'.join(transformed_dirs)
        path = f'{transformed_first}/{dirs_str}/{transformed_filename}'
    else:
        path = f'{transformed_first}/{transformed_filename}'
    
    return f'{base_cdn}/{path}?emrc=auto'


def _transform_directory_name(original):
    """
    Transform a directory name component for the CDN path.
    Converts to lowercase, replaces spaces with hyphens, and triplicates 
    the hyphen after any 2-digit number.
    """
    import re
    
    # Convert to lowercase and replace spaces with hyphens
    result = original.lower().replace(' ', '-')
    
    # Find all occurrences of 2-digit numbers and triplicate the hyphen after them
    # We do this by finding patterns like "-dd-" and replacing with "-dd---"
    def replace_hyphen_after_digits(match):
        # match.group() is the entire match like "-11-"
        # We want to change it to "-11---"
        return match.group(0) + '--'
    
    # Pattern: hyphen, exactly two digits, hyphen
    # We look for this pattern and add two more hyphens
    result = re.sub(r'-(\d{2})-', r'-\1---', result)
    
    return result


def _transform_filename(original):
    """
    Transform a filename for the CDN path.
    URL encodes spaces (replaces spaces with %20).
    """
    # URL encode spaces
    return original.replace(' ', '%20')


def _build_model_page_url(model_name):
    """
    Construct the NASA 3D Resources model page URL from the model name.
    Uses a simple slug format: lower case, spaces to hyphens.
    """
    # Basic sanitization for URL slug
    slug = model_name.lower().replace(' ', '-')
    # Remove any characters that are not alphanumeric, hyphen, or underscore
    import re
    slug = re.sub(r'[^a-z0-9\-_]', '', slug)
    return f'https://science.nasa.gov/3d-resources/{slug}/'


def buscar_modelos(query=''):
    """
    Search NASA 3D Resources models by query string.
    Returns a list of dictionaries with the following keys:
        - titulo: model name
        - identificador: model name (used as unique identifier)
        - url de la ficha: URL to the model's page on NASA site
        - licencia declarada: 'Public Domain' (as all NASA 3D Resources are public domain)
        - url del fichero: direct download URL for the first available file (prefers GLB, then STL, then first)
    """
    try:
        meta_data = _get_meta_json()
    except RuntimeError as e:
        # If we cannot get meta.json, we cannot search
        print(f'Error: {e}', file=sys.stderr)
        return []

    models = meta_data.get('models', [])
    if not isinstance(models, list):
        return []

    query_lower = query.lower()
    results = []

    for model in models:
        if not isinstance(model, dict):
            continue
        name = model.get('name', '')
        description = model.get('description', '').lower()
        # Match if query is empty or appears in name or description
        if query and query_lower not in name.lower() and query_lower not in description:
            continue

        files = model.get('files', [])
        if not isinstance(files, list) or not files:
            # Skip models with no files
            continue

        # Determine the best file to show: prefer GLB, then STL, then first
        selected_file = None
        for f in files:
            if isinstance(f, dict) and 'path' in f:
                path = f['path'].lower()
                if path.endswith('.glb'):
                    selected_file = f
                    break
                if path.endswith('.stl') and selected_file is None:
                    selected_file = f
        if selected_file is None:
            selected_file = files[0]  # fallback to first file

        # Build the result dictionary
        result = {
            'titulo': name,
            'identificador': name,  # using name as identifier; could be improved with a slug
            'url de la ficha': _build_model_page_url(name),
            'licencia declarada': 'Public Domain',
            'url del fichero': _build_download_url(selected_file['path'])
        }
        results.append(result)

    return results


def main():
    parser = argparse.ArgumentParser(description='Search NASA 3D Resources models.')
    parser.add_argument('query', nargs='?', default='', help='Search query (model name or description)')
    parser.add_argument('--desde-fichero', help='Load meta.json from a file instead of fetching from GitHub (for testing)')
    args = parser.parse_args()

    if args.desde_fichero:
        # For testing: load meta.json from a local file
        try:
            with open(args.desde_fichero, 'r', encoding='utf-8') as f:
                meta_data = json.load(f)
            # Temporarily override _get_meta_json to return this data
            global _get_meta_json
            _get_meta_json = lambda: meta_data
        except (IOError, json.JSONDecodeError) as e:
            print(f'Error loading meta.json from {args.desde_fichero}: {e}', file=sys.stderr)
            sys.exit(1)

    try:
        resultados = buscar_modelos(args.query)
        json.dump(resultados, sys.stdout, indent=2, ensure_ascii=False)
        print()  # newline for clean output
    except RuntimeError as e:
        print(f'Error: {e}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()