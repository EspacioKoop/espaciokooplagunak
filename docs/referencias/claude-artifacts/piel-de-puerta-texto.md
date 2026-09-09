# Piel de Puerta — texto recuperado

Fuente: <https://claude.ai/code/artifact/368f25e2-b8dd-4b08-b98b-737893382455>

Consulta: 2026-09-06. Transcripción del contenido textual devuelto por el extractor,
con formato normalizado. No es el HTML ni el código original. La imagen embebida
no fue conservada por el extractor y no se reconstruye aquí. Autoría individual y
licencia del artefacto no verificadas; se conserva la atribución visible.
No se atribuye este contenido a EmptyEpsilon ni se incorpora como asset del juego.

## Contenido visible recuperado

**Piel de Puerta** — Espaciokoop Lagunak · #458

### Piel de hoja, en textura

Media hoja de puerta corredera, pintada a 2,5 cm por téxel — la misma resolución
que ya usa el mural del muro. En el motor esto es UN cuadrilátero por cara, en vez
de decenas de chapas.

La página mostraba una imagen con el texto alternativo «Textura de la hoja de
puerta, pixelart de casco de nave» y la indicación «×4 · image-rendering: pixelated».
**La imagen no está incluida en esta copia textual.**

### Medidas

| Dato | Valor mostrado |
|---|---|
| Hoja | 1,2 × 2,8 m |
| Téxel | 0,025 m |
| Tesela | 48 × 112 px |
| Paleta | 7 colores |
| Caras | 2 (una por lado) |

### Paleta

- `#161b22` hueco
- `#252c35` junta
- `#333b46` sombra
- `#4a5462` medio
- `#657386` claro
- `#8492a3` brillo
- `#ffb703` ámbar señal

### De abajo arriba

- guías de rodadura
- panel bajo (liso)
- franja de aviso — ámbar
- registro de inspección — con lamas
- refuerzo
- zócalo

Sin semilla: una puerta es una pieza de serie, así que dos hojas del mismo tamaño
salen idénticas. La hoja que cierra al otro lado no repinta nada — se espeja por UV
(`piezasPielHojaTextura` en `piel-textura-puerta.mjs`).

## Límites de esta referencia

Las medidas, nombres de función y «#458» anteriores son lo que afirmaba la página,
no una validación del código actual de `main`. El issue #458 consultado en este
repositorio trata otro asunto: no se enlaza automáticamente como su implementación.
La existencia de código relacionado con puertas/texturas no demuestra que este
artefacto concreto esté integrado ni que la demo funcione. No se ha ejecutado.
