#!/usr/bin/env python3
"""
Check for the presence of Universal Animation Library assets.
"""
import os
import sys

def main():
    # Define the expected directories
    base_dir1 = os.path.join(os.path.dirname(__file__), '..', 'resources', 'animations', 'universal-animation-library')
    base_dir2 = os.path.join(os.path.dirname(__file__), '..', 'resources', 'animations', 'universal-animation-library-2')
    base_dir1 = os.path.abspath(base_dir1)
    base_dir2 = os.path.abspath(base_dir2)
    
    print(f"Checking for assets in: {base_dir1}")
    print(f"Checking for assets in: {base_dir2}")
    
    dirs_exist = os.path.isdir(base_dir1) or os.path.isdir(base_dir2)
    if not dirs_exist:
        print("ERROR: At least one of the directories does not exist.")
        print("Please create them and add the asset files.")
        return 1
    
    # List all files in the directories
    all_files = []
    for base_dir in [base_dir1, base_dir2]:
        if os.path.isdir(base_dir):
            for root, dirs, files in os.walk(base_dir):
                for f in files:
                    all_files.append(os.path.join(root, f))
    
    if not all_files:
        print("ERROR: No files found in the directories.")
        print("Please download the Universal Animation Library and Universal Animation Library 2 from:")
        print("  https://quaternius.itch.io/universal-animation-library")
        print("  https://quaternius.com/packs/universalanimationlibrary2.html")
        print("Extract the ZIPs and place the contents in the respective directories.")
        return 1
    
    # Count relevant file types (animation files)
    extensions = ['.glb', '.gltf', '.fbx', '.blend']
    relevant_files = [f for f in all_files if any(f.lower().endswith(ext) for ext in extensions)]
    
    print(f"Total files found: {len(all_files)}")
    print(f"Relevant asset files ({', '.join(extensions)}): {len(relevant_files)}")
    
    if len(relevant_files) == 0:
        print("WARNING: No relevant asset files found.")
        print("Please ensure you have extracted the correct files from the ZIPs.")
        print("The animation packages should contain animation files in formats like GLB, FBX, or BLEND.")
        return 1
    
    # Optionally, list a few files
    print("\nFirst 10 relevant files:")
    for f in relevant_files[:10]:
        print(f"  {os.path.relpath(f, base_dir1 if os.path.isdir(base_dir1) else base_dir2)}")
    
    if len(relevant_files) > 10:
        print(f"  ... and {len(relevant_files) - 10} more")
    
    print("\nAsset check passed.")
    return 0

if __name__ == '__main__':
    sys.exit(main())
