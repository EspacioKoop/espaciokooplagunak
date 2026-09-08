#!/usr/bin/env python3
"""
Check for the presence of Medieval Village MegaKit assets.
"""
import os
import sys

def main():
    # Define the expected directory
    base_dir = os.path.join(os.path.dirname(__file__), '..', 'resources', 'models', 'medieval-village-megakit')
    base_dir = os.path.abspath(base_dir)
    
    print(f"Checking for assets in: {base_dir}")
    
    if not os.path.isdir(base_dir):
        print(f"ERROR: Directory does not exist: {base_dir}")
        print("Please create it and add the asset files.")
        return 1
    
    # List all files in the directory
    all_files = []
    for root, dirs, files in os.walk(base_dir):
        for f in files:
            all_files.append(os.path.join(root, f))
    
    if not all_files:
        print("ERROR: No files found in the directory.")
        print("Please download the Medieval Village MegaKit from:")
        print("  https://quaternius.itch.io/medieval-village-megakit")
        print("Extract the ZIP and place the contents in this directory.")
        return 1
    
    # Count relevant file types
    extensions = ['.glb', '.gltf', '.fbx', '.obj', '.blend']
    relevant_files = [f for f in all_files if any(f.lower().endswith(ext) for ext in extensions)]
    
    print(f"Total files found: {len(all_files)}")
    print(f"Relevant asset files ({', '.join(extensions)}): {len(relevant_files)}")
    
    if len(relevant_files) == 0:
        print("WARNING: No relevant asset files found.")
        print("Please ensure you have extracted the correct files from the ZIP.")
        print("The asset package should contain 3D models in formats like GLB, OBJ, or FBX.")
        return 1
    
    # Optionally, list a few files
    print("\nFirst 10 relevant files:")
    for f in relevant_files[:10]:
        print(f"  {os.path.relpath(f, base_dir)}")
    
    if len(relevant_files) > 10:
        print(f"  ... and {len(relevant_files) - 10} more")
    
    print("\nAsset check passed.")
    return 0

if __name__ == '__main__':
    sys.exit(main())
