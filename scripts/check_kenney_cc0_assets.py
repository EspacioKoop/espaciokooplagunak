#!/usr/bin/env python3
"""
Verification script for Kenney CC0 asset packs.
Confirms presence of expected file types in each pack directory.
"""
import os
import sys

def check_pack(pack_name, extensions):
    base_path = os.path.join('resources', 'models', pack_name)
    if not os.path.isdir(base_path):
        print(f"ERROR: Directory {base_path} does not exist")
        return False
    found = False
    for root, dirs, files in os.walk(base_path):
        for f in files:
            if any(f.lower().endswith(ext) for ext in extensions):
                print(f"Found: {os.path.join(root, f)}")
                found = True
    if not found:
        print(f"WARNING: No files with extensions {extensions} found in {base_path}")
    return found

def main():
    # Define what to check for each pack
    packs = {
        'classic-64-asset-pack': ['.png', '.json', '.xml'],
        'ultimate-retro-tree-pack': ['.png'],
        'retro-nature-pack': ['.png']
    }
    
    all_good = True
    for pack, exts in packs.items():
        print(f"\nChecking {pack}...")
        if not check_pack(pack, exts):
            all_good = False
    
    if all_good:
        print("\nAll packs verified successfully.")
        sys.exit(0)
    else:
        print("\nSome packs had issues.")
        sys.exit(1)

if __name__ == '__main__':
    main()