# CC0 Asset Packs Integration Proposal

**Corrección (2026-09-08):** este documento atribuía los tres packs a Kenney.
Es incorrecto — ninguno de los tres es de Kenney.nl. Verificado contra el
`Readme.txt`/`READ ME.txt` que trae cada pack y contra las páginas de origen:

- Classic 64 Asset Pack — **Craig Snedeker** (craigsnedeker.itch.io)
- Ultimate Retro Tree Pack — **Elegant Crow** (elegantcrow.itch.io)
- Retro Nature Pack — **Elegant Crow**

Los tres, además de la corrección de contenido: son modelos 3D (FBX/OBJ/glTF/BLEND),
no tiles 2D — la descripción de "64x64 pixel art tiles" y "PNG tilesets" de
más abajo describe el estilo visual de Kenney, no lo que estos packs contienen
de verdad. Ver la ficha completa en `docs/PROCEDENCIA_ASSETS.md`, sección
"Packs CC0 3D — animación y mobiliario retro (#1052)", donde ya están
integrados.

## Asset Pack Details

### 1. Classic64 Asset Library
- Source: https://craigsnedeker.itch.io/classic64-asset-library
- Author: Craig Snedeker
- License: CC0 1.0 Universal (public domain)
- Contents: 3D props (Blender/FBX/OBJ) de estética N64/PS1-PS2. Con
  sub-atribuciones internas a rubberduck y yughues (OpenGameArt) para las
  texturas de `Nature/` y `Rocks/`.

### 2. Ultimate Retro PSX Tree Pack
- Source: https://elegantcrow.itch.io/ultimate-retro-psx-tree-pack
- Author: Elegant Crow
- License: CC0
- Contents: árboles 3D (FBX) de estética retro PSX. Las imágenes de las texturas
  proceden de Pixabay/Pexels, según declara el propio autor.

### 3. Retro Nature Pack
- Source: elegantcrow.itch.io (mismo autor que el anterior)
- Author: Elegant Crow
- License: CC0
- Contents: vegetación 3D (FBX) de estética retro.

## Integration Plan

Ya integrados en #1052 bajo `resources/models/`, como los binarios originales
del pack (no convertidos a malla de texto — excepción documentada en
`docs/PROCEDENCIA_ASSETS.md`):
- `resources/models/classic-64-asset-pack/`
- `resources/models/ultimate-retro-tree-pack/`
- `resources/models/retro-nature-pack/`

## License Compliance

Los tres packs son CC0. La atribución no es obligatoria por licencia, pero
este documento la registra igualmente porque es lo que permite verificar la
procedencia después — la regla de `docs/PROCEDENCIA_ASSETS.md` (#590).

## Verification

Confirmado por lectura directa de los ficheros `Readme.txt`/`READ ME.txt`
incluidos en cada pack (ya presentes en el árbol desde #1052) y contrastado
contra las páginas de origen citadas arriba.
