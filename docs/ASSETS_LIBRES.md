# Assets libres y su ingestión

Este documento lista fuentes verificadas de assets (arte, audio, modelos 3D, etc.) que son compatibles con la licencia GPL-2.0 del proyecto y describe el precio de entrada para poder usarlos.

## Fuentes verificadas

| Tipo | Fuente | Licencia | Comentario |
|------|--------|----------|------------|
| Modelos 3D | Scan the World (via MyMiniFactory) | Varía por pieza, buscar CC0 o dominio público | Verificar licencia de cada archivo antes de usar |
| Texturas 2D | OpenGameArt.org | CC0, CC BY, etc. | Filtrar por licencia compatible |
| Audio | Freesound.org | Varía, buscar CC0 o CC BY | Necesita API key para búsqueda; descarga requiere OAuth2 |
| Fuentes tipográficas | Google Fonts | SIL Open Font License (compatible) | Convertir a formato bitmap si es necesario para retro3d |

## Precio de entrada para 3D

Para que un modelo 3D pueda ser usado por `retro3d.mjs` se requiere:
1. Conversión a formato `{vertices, caras}` (ej. usando `Assimp` o `blender --background --python script.py`).
2. Decimado (colapso de aristas o similar) para reducir la cantidad de triángulos a unos pocos cientos.
3. Asignar un color plano por cara desde la paleta del juego (`paleta.mjs`).
4. Exportar como binario versionado en el árbol (ver abajo).
5. Añadir una entrada en `docs/PROCEDENCIA_ASSETS.md` con:
   - Autor
   - Licencia exacta
   - URL de origen
   - SHA256 del archivo binario

## Primer binario en el árbol

Decidir:
- Formato: archivo JSON binario? o simplemente un `.js` que exporte `{vertices: [...], faces: [...]}`.
- Ubicación sugerida: `assets/models/<nombre>/index.mjs` o `assets/models/<nombre>.bin`.
- El archivo debe estar versionado y su procedencia documentada.

## Pasos de validación

Un script de prueba podría:
1. Descazar un modelo CC0 de Scan the World.
2. Ejecutar la cadena de conversión (ej. `obj2json.py`).
3. Verificar que el output pueda ser cargado por `retro3d.mjs` y se vea correctamente.
4. Generar el SHA256 y actualizar la documentación.

Este documento es un punto de partida; se espera que evolucione con la experiencia.
