# PR de investigación: assets CC0 candidatos desde OpenGameArt

Estado: borrador de investigación. Sin archivos binarios incorporados todavía.
Criterio: solo entradas con licencia declarada **CC0 1.0** o dominio público equivalente en la página del asset.
Referencia del proceso: `docs/PROCEDENCIA_ASSETS.md`.

## Lote A — 2D / pixel art / UI HUD (6 ítems)

1. **Pixel Space Background** — ZaninDevelopers\
   - URL: https://opengameart.org/content/pixel-space-background\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: `resources/gui/background` o mapa de nave en Foundry\
   - Formato: PNG 47.3 KB

2. **200+ CC0 Spaceship Sprites** — colección\
   - URL: https://opengameart.org/content/200-cc0-spaceship-sprites\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: sprites de nave/asteroides en Foundry\
   - Nota: revisar página de créditos del lote antes de usarlo

3. **Sci-fi User Interface**\
   - URL: https://opengameart.org/content/sci-fi-user-interface\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: `resources/gui/icons` y HUD\
   - Formato: sprites PNG

4. **UI Pack - Sci-Fi**\
   - URL: https://opengameart.org/content/ui-pack-sci-fi\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: `resources/gui/widget`

5. **CC0 Light Icons / Sci-fi Icon Pack Pixel Art**\
   - URL: https://opengameart.org/content/sci-fi-icon-pack-pixel-art\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: indicadores de puesto/estado

6. **Sci-fi Interior tiles**\
   - URL: https://opengameart.org/content/sci-fi-interior-tiles\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: `foundry-module` escenas andables/camarotes

## Lote B — 3D / bajo polos / escenas (5 ítems)

1. **Low poly space assets**\
   - URL: https://opengameart.org/content/low-poly-space-assets\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: asteroides y planetas para `foundry-module`

2. **Harvester spaceship - low poly**\
   - URL: https://opengameart.org/content/harvester-spaceship-low-poly\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: nave enemiga en mapa 3D

3. **MCU-43 Gryphon Mech**\
   - URL: https://opengameart.org/content/mcu-43-gryphon-mech\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: criatura/nave híbrida en hangar

4. **Space Ship Construction Kit**\
   - URL: https://opengameart.org/content/space-ship-construction-kit\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: construcción modular de naves en `resources/mesh/ship`

5. **Space Ship & Mech Construction Kit 2**\
   - URL: https://opengameart.org/content/space-ship-mech-construction-kit-2\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: variantes mecánicas para hangar

## Lote C — texturas y audio (6 ítems)

1. **Pixel Space Background** — también sirve como textura de cielo\
   - URL: https://opengameart.org/content/pixel-space-background\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: `resources/skybox/void`

2. **Sci-fi SFX** — Colodical\
   - URL: https://opengameart.org/content/sci-fi-sfx\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: `resources/sfx/` alertas/powerups\
   - Archivos: `.mp3`, `.wav`

3. **IgnisForge Free SFX Sampler**\
   - URL: https://opengameart.org/content/ignisforge-free-sfx-sampler-43-synthesized-retro-sound-effects\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: `resources/sfx/` retro synth\
   - Formato: WAV/OGG

4. **Blue Moon Beach** (audio)\
   - URL: https://opengameart.org/content/blue-moon-beach\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: ambient para escena playa/museo\
   - Formato: OGG

5. **Distressed Paper Texture**\
   - URL: https://opengameart.org/content/distressed-paper-texture\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: textura de cartelas en museo\
   - Formato: JPG/PNG

6. **Memoria Fragmentada** (audio)\
   - URL: https://opengameart.org/content/memoria-fragmentada\
   - Licencia anunciada: CC0 1.0 — pendiente de verificar el archivo concreto\
   - Uso propuesto: `resources/audio/scenario`\
   - Formato: MP3

## Descartados por licencia (revisión de OTACON Astra en #873)

- **Space Ship 3D&2D** — https://opengameart.org/content/space-ship-3d2d — declara **CC-BY 3.0**
  (autor "little killy", fichero `ship-animated.blend`), no CC0. No cumple el criterio de este
  lote; si se quiere en algún momento, entra por una ficha aparte con atribución explícita en
  `CREDITS.md`, no en la sección de agradecimientos por dominio público.

## Próximos pasos

- [ ] Verificar en cada página el enlace de licencia exacto y la atribución del archivo.
- [ ] Descargar solo lo necesario a `resources/` o `foundry-module/data/`, sin duplicados.
- [ ] Registrar cada asset en `docs/PROCEDENCIA_ASSETS.md` con obra/autoría del archivo, licencia exacta, enlace, sha256 y comando de conversión si aplica.
- [ ] Abrir un issue por escena para no mezclar la revisión de assets con la integración en juego.

## Nota de licencia

Este PR es **solo investigación y selección**. No incorpora archivos binarios externos al árbol hasta que `PROCEDENCIA_ASSETS.md` valide cada uno. Reproducimos la regla del repo: **sin ficha, no entra**.

## Créditos / agradecimiento (para cuando se incorpore)

Si algún asset de este lote entra en el árbol, se añadirá una sección en `CREDITS.md` titulada:

```
## Agradecimientos por assets de dominio público

Agradecemos a los autores de OpenGameArt.org por publicar sus trabajos bajo
licencias de dominio público o equivalentes. Sus assets se usan bajo los
términos de dichas licencias y se listan a continuación con su autor y URL:

- <autor> — <asset> — <URL> — <licencia exacta>
```

Ningún asset se incorpora sin mención expresa en esa sección.
