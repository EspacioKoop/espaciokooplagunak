#!/usr/bin/env python3
"""
Script para detectar módulos JavaScript huérfanos.
Autor: Teseo (Qwen3.7)
Issue: #701
"""
import os
import re

def find_js_files(root_dir):
    js_files = []
    for dirpath, _, filenames in os.walk(root_dir):
        if 'node_modules' in dirpath or '.git' in dirpath:
            continue
        for f in filenames:
            if f.endswith('.js') or f.endswith('.ts'):
                js_files.append(os.path.join(dirpath, f))
    return js_files

def check_exports(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        # Busca exportaciones comunes
        if re.search(r'(module\.exports|export\s+default|export\s+(const|function|class))', content):
            return True
    return False

def check_imports(root_dir, target_file):
    # Busca si algún archivo importa este archivo específico
    rel_target = os.path.relpath(target_file, root_dir)
    for dirpath, _, filenames in os.walk(root_dir):
        if 'node_modules' in dirpath or '.git' in dirpath:
            continue
        for f in filenames:
            if f.endswith('.js') or f.endswith('.ts'):
                path = os.path.join(dirpath, f)
                if path == target_file:
                    continue
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                        if rel_target in fp.read() or os.path.basename(target_file) in fp.read():
                            return True
                except:
                    pass
    return False

if __name__ == "__main__":
    print("🔍 Escaneando módulos huérfanos...")
    root = "."
    js_files = find_js_files(root)
    orphans = []
    
    for f in js_files:
        if check_exports(f) and not check_imports(root, f):
            orphans.append(f)
    
    if orphans:
        print(f"\n⚠️ Se encontraron {len(orphans)} posibles módulos huérfanos:")
        for o in orphans:
            print(f"  - {o}")
    else:
        print("\n✅ No se detectaron módulos huérfanos obvios.")
