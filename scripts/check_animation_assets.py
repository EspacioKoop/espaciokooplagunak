#!/usr/bin/env python3
"""
Check for the presence of Universal Animation Library assets.

Validates each library independently: the check passes only when BOTH
directories exist and each one contains at least one relevant animation file
(.glb/.gltf/.fbx/.blend). Checking `isdir(dir1) or isdir(dir2)` — the
original defect — lets the check succeed with one of the two libraries
completely absent, which defeats the point of announcing both as required
(#1047).
"""
import os
import sys

EXTENSIONS = ('.glb', '.gltf', '.fbx', '.blend')

LIBRARIES = (
    (
        'universal-animation-library',
        'https://quaternius.itch.io/universal-animation-library',
    ),
    (
        'universal-animation-library-2',
        'https://quaternius.com/packs/universalanimationlibrary2.html',
    ),
)


def _relevant_files(base_dir):
    found = []
    for root, _dirs, files in os.walk(base_dir):
        for f in files:
            if f.lower().endswith(EXTENSIONS):
                found.append(os.path.join(root, f))
    return found


def check_libraries(resources_root):
    """Validates every library in `LIBRARIES` under `resources_root`.

    Returns (ok, report_lines): `ok` is True only if every library exists
    and has at least one relevant file. Pure function so the regression
    test can exercise it against a temp directory instead of the real repo.
    """
    ok = True
    lines = []
    for name, download_url in LIBRARIES:
        base_dir = os.path.join(resources_root, 'animations', name)
        lines.append(f"Checking for assets in: {base_dir}")
        if not os.path.isdir(base_dir):
            lines.append(f"ERROR: {name} directory does not exist.")
            lines.append(f"  Download from: {download_url}")
            ok = False
            continue
        relevant = _relevant_files(base_dir)
        if not relevant:
            lines.append(f"ERROR: no relevant asset files found in {name}.")
            lines.append(f"  Download from: {download_url}")
            ok = False
            continue
        lines.append(f"  {len(relevant)} relevant asset file(s) found.")
    return ok, lines


def main():
    resources_root = os.path.abspath(
        os.path.join(os.path.dirname(__file__), '..', 'resources')
    )
    ok, lines = check_libraries(resources_root)
    print('\n'.join(lines))
    if not ok:
        print("\nAsset check failed: both libraries are required.")
        return 1
    print("\nAsset check passed.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
