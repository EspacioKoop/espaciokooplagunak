# Incorporación prevista: 3D + audio desde OpenGameArt CC0

Este documento complementa `opengameart-cc0-research.md` con la ruta de
incorporación concreta para el lote 3D y audio, respetando
`docs/PROCEDENCIA_ASSETS.md`.

## Lote 3D priorizado (6 ítems)

1. Space Ship 3D&2D  
   URL: https://opengameart.org/content/space-ship-3d2d  
   Destino: `resources/mesh/ship/oga-3d2d/`  
   Acción: descargar assets originales, registrar ficha en `PROCEDENCIA_ASSETS.md`, convertir con herramienta existente si procede

2. Low poly space assets  
   URL: https://opengameart.org/content/low-poly-space-assets  
   Destino: foundry-module/data/mallas/low-poly-space/ (ruta a crear)  
   Acción: verificar formato; incluir solo modelos, no texturas derivadas con licencia distinta

3. Harvester spaceship - low poly  
   URL: https://opengameart.org/content/harvester-spaceship-low-poly  
   Destino: `resources/mesh/ship/oga-harvester/`  
   Acción: descargar, fichar, convertir

4. MCU-43 Gryphon Mech  
   URL: https://opengameart.org/content/mcu-43-gryphon-mech  
   Destino: `resources/mesh/various/oga-gryphon/`  
   Acción: descargar, fichar

5. Space Ship Construction Kit  
   URL: https://opengameart.org/content/space-ship-construction-kit  
   Destino: `resources/mesh/ship/oga-construction-kit/`  
   Acción: descargar, fichar, documentar partes reutilizables

6. Space Ship & Mech Construction Kit 2  
   URL: https://opengameart.org/content/space-ship-mech-construction-kit-2  
   Destino: `resources/mesh/various/oga-mech-kit2/`  
   Acción: descargar, fichar

## Lote audio priorizado (6 ítems)

1. Sci-fi SFX  
   URL: https://opengameart.org/content/sci-fi-sfx  
   Destino: `resources/sfx/oga/sci-fi-sfx/`  
   Acción: copiar `.mp3` y `.wav`, registrar ficha con sha256

2. IgnisForge Free SFX Sampler  
   URL: https://opengameart.org/content/ignisforge-free-sfx-sampler-43-synthesized-retro-sound-effects  
   Destino: `resources/sfx/oga/ignisforge/`  
   Acción: descargar lote, fichar

3. Blue Moon Beach  
   URL: https://opengameart.org/content/blue-moon-beach  
   Destino: `resources/audio/scenario/oga/blue-moon-beach/`  
   Acción: descargar OGG, fichar

4. Memoria Fragmentada  
   URL: https://opengameart.org/content/memoria-fragmentada  
   Destino: `resources/audio/scenario/oga/memoria-fragmentada/`  
   Acción: descargar MP3, fichar

5. 80 CC0 creature SFX  
   URL: https://opengameart.org/content/80-cc0-creature-sfx  
   Destino: `resources/sfx/oga/creature-sfx/`  
   Acción: descargar, revisar créditos automáticos de OGA

6. 50 CC0 Sci-Fi SFX  
   URL: https://opengameart.org/content/50-cc0-sci-fi-sfx  
   Destino: `resources/sfx/oga/50-sci-fi-sfx/`  
   Acción: descargar, fichar

## Reglas de incorporación

- Sin ficha en `docs/PROCEDENCIA_ASSETS.md`, no entra en el árbol.
- Si el asset viene como ZIP/lote, registrar cada archivo por separado.
- Mantener fuera del árbol binarios enormes que no necesitan estar en git.
- Actualizar CREDITS.md si corresponde.
