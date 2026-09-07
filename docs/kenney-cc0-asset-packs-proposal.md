# Kenney CC0 Asset Packs Integration Proposal

This proposal outlines the integration of three CC0-licensed asset packs from Kenney:
- Classic 64 Asset Pack
- Ultimate Retro Tree Pack
- Retro Nature Pack

## Asset Pack Details

### 1. Classic 64 Asset Pack
- Source: https://kenney.nl/assets/classic-64-asset-pack
- License: CC0 1.0 Universal (public domain)
- Contents: 64x64 pixel art tiles, sprites, and UI elements for 2D games.
- File types: PNG (tilesets, spritesheets), JSON (Tiled maps), XML (TexturePacker)

### 2. Ultimate Retro Tree Pack
- Source: https://kenney.nl/assets/ultimate-retro-tree-pack
- License: CC0 1.0 Universal
- Contents: Retro-style tree sprites and tilesets.
- File types: PNG (tilesets, spritesheets)

### 3. Retro Nature Pack
- Source: https://kenney.nl/assets/retro-nature-pack
- License: CC0 1.0 Universal
- Contents: Retro-style nature assets (trees, rocks, water, grass).
- File types: PNG (tilesets, spritesheets)

## Integration Plan

All assets will be placed under `resources/models/` as 2D sprite resources, organized by pack:
- `resources/models/classic-64-asset-pack/`
- `resources/models/ultimate-retro-tree-pack/`
- `resources/models/retro-nature-pack/`

Each directory will contain the extracted PNG files and any accompanying data (JSON/XML) as-is from the Kenney ZIPs.

## License Compliance

All packs are CC0 1.0 Universal (public domain). Attribution is optional but appreciated. We will include attribution in the documentation if required by the asset creator's preference (Kenney appreciates attribution but does not require it).

## Verification

A verification script will be added to confirm the presence of PNG files in each directory after manual placement.

## Dependencies

- Manual download from Kenney.nl (requires free account, but no session‑dependent keys).
- Git and Hermes Agent for PR workflow.

## Next Steps

Upon approval of this proposal, a separate implementation PR will be opened to add the assets.
