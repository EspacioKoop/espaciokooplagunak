# Proposal: Integrate Universal Animation Library from Quaternius

## Asset Pack Overview
The [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) by Quaternius is a collection of 120+ animations for a universal humanoid rig, compatible with Unreal Engine, Godot, and Unity. Animations cover locomotion (8 directions), combat, emotes, and more. The pack is released under the Creative Commons Zero v1.0 Universal (CC0) license, free for personal, educational, and commercial use.

Additionally, [Universal Animation Library 2](https://quaternius.com/packs/universalanimationlibrary2.html) provides 130+ animations focusing on melee and armed combos, parkour movement, farming, fishing, zombie locomotion, and more. It also uses the same universal humanoid rig and is compatible with the same engines, released under CC0.

## Potential Use in Espaciokoop Lagunak
- Provide idle, movement, and combat animations for 3D character models in the game.
- Enhance visual fidelity of avatars or NPCs in 3D scenes (if applicable).
- Animations are ready for retargeting to custom rigs.
- The second library adds specialized animations for varied gameplay mechanics.

## Integration Plan
1. **Directory Structure**: Place the GLB/GLTF animation files under `resources/animations/universal-animation-library/` and `resources/animations/universal-animation-library-2/`. Keep the two libraries in separate directories for verification.
2. **File Formats**: Use the provided GLB files (with root motion disabled) for broader compatibility.
3. **Source Files**: Optionally include the source `.blend` files for modification (requires payment for the Source version).
4. **Documentation**: Update any relevant documentation to note the animation sources and license.
5. **Attribution**: Although CC0 does not require attribution, we may credit Quaternius in the game's credits or documentation.



## Manual Download Instructions
Since the automated download requires a session-specific key from itch.io, please follow these steps to manually obtain the asset:

1. Visit the asset page for Universal Animation Library: https://quaternius.itch.io/universal-animation-library
2. Visit the asset page for Universal Animation Library 2: https://quaternius.com/packs/universalanimationlibrary2.html
3. Click "Download Now" on each page and enter a fair price (can be $0 for the free versions).
4. After the download starts, save the ZIP files to your local machine.
5. Extract the ZIP files.
6. Copy the extracted contents (should be GLB/OBJ/FBX animation files and possibly .blend source files) into:
   `<repo_root>/resources/animations/universal-animation-library/`
   `<repo_root>/resources/animations/universal-animation-library-2/`
   Keep both directories; do not combine the libraries into a single directory.
7. Within each library, organize the files as you see fit (e.g., by animation type).

## Verification
From the repository root, run:
```bash
python3 scripts/check_animation_assets.py
python3 -m unittest discover -s scripts/tests -p 'test_check_animation_assets.py' -v
```
The asset check exits with 0 only when **both** library directories exist and
**each** contains at least one `.glb`, `.gltf`, `.fbx`, or `.blend` file
(case-insensitive, searched recursively). Missing or empty libraries fail with
exit code 1. This is a presence/extension check only: it does not validate binary
contents, animation counts, rig compatibility, licensing, or runtime integration.
The regression tests use temporary placeholder files, not actual assets.
These tests can be run locally; the current tools workflow does not collect
`scripts/tests/`. This proposal does not add assets or a game consumer; the
separate pack delivery is tracked in #1052.

## License
- Creative Commons Zero v1.0 Universal (CC0)
- Free for personal, educational, and commercial projects.
- No attribution required (but appreciated).

## Next Steps
- Download the asset packs (Standard versions are free; Name your own price).
- Extract and organize the animation files.
- Test integration with existing 3D models or rigs in the game.
- Update any animation systems or scripts to utilize the new animations.

## References
- Asset Page 1: https://quaternius.itch.io/universal-animation-library
- Asset Page 2: https://quaternius.com/packs/universalanimationlibrary2.html
- License: https://creativecommons.org/publicdomain/zero/1.0/
