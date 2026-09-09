# Proposal: Integrate Medieval Village MegaKit from Quaternius

## Asset Pack Overview
The [Medieval Village MegaKit](https://quaternius.itch.io/medieval-village-megakit) by Quaternius is a pack containing more than 300 modular environment pieces, designed to fit perfectly in a grid, with walls that include both an exterior and an interior at the same time, modular roofs, stairs, and much more, allowing the creation of villages with thousands of combinations. The modular system is flexible and easy to use.

Features:
- 300+ Unique models in a wide variety of categories (walls, floors, stairs, roofs, etc)
- Source version comes with all assets already implemented in Unity (URP), Unreal, and Godot with custom shaders enabling customizable wear colors.
- Source version also includes custom optimized collisions for each model.
- Available in .FBX, .OBJ, and .glTF formats, compatible with all engines.
- Free for personal, educational, and commercial projects (CC0 License).

## Potential Use in Espaciokoop Lagunak
- Provide modular building pieces for creating medieval-style villages, towns, or structures in the game's 3D environments.
- Enable quick prototyping and variation of scenes using the grid-based modular system.
- Enhance visual richness of outdoor and indoor settings.
- Compatible with existing 3D rendering pipelines (if the game uses 3D assets).

## Integration Plan
1. **Directory Structure**: Place the GLB/OBJ/FBX model files under `resources/models/medieval-village-megakit/` (or similar).
2. **File Formats**: Use GLB for broad compatibility; optionally include FBJ/OBJ for source workflows.
3. **Source Files**: Optionally include source versions (requires payment) for customization.
4. **Documentation**: Update relevant documentation to note the model sources and license.
5. **Attribution**: Although CC0 does not require attribution, we may credit Quaternius in the game's credits or documentation.



## Manual Download Instructions
Since the automated download requires a session-specific key from itch.io, please follow these steps to manually obtain the asset:

1. Visit the asset page: https://quaternius.itch.io/medieval-village-megakit
2. Click "Download Now" and enter a fair price (can be $0 for the free version).
3. After the download starts, save the ZIP file to your local machine.
4. Extract the ZIP file.
5. Copy the extracted contents (should be GLB/OBJ/FBX model files and possibly folders) into:
   `<repo_root>/resources/models/medieval-village-megakit/`
6. Ensure the directory structure is flat (i.e., the model files are directly in this folder or in clearly labeled subfolders by category if you prefer).

## Verification
After placing the files, you can verify by checking for common file extensions:
```bash
find resources/models/medieval-village-megakit -type f \( -name "*.glb" -o -name "*.gltf" -o -name "*.fbx" -o -name "*.obj" \)
```
## License
- Creative Commons Zero v1.0 Universal (CC0)
- Free for personal, educational, and commercial projects.
- No attribution required (but appreciated).

## Next Steps
- Download the asset pack (Standard version is free; Name your own price).
- Extract and organize the model files.
- Test integration with existing 3D scene systems or rendering pipelines.
- Update any placement or building systems to utilize the modular pieces.

## References
- Asset Page: https://quaternius.itch.io/medieval-village-megakit
- License: https://creativecommons.org/publicdomain/zero/1.0/
