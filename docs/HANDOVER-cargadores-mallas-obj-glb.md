# Handover — cargadores OBJ y GLB para el pipeline de mallas

**Rama:** `lagunak/cargador-obj-nasa-3d`
**PR:** #837 (abierto, contra `lagunak/nasa-3d-resources-como-fuente-de-mallas`)
**Autor:** eGurucharri · **Fecha:** 2026-08-27

Formato de entrega: ver `AGENTS.md` → "Entrega requerida". Añade
explícitamente qué NO se hizo y por qué (ver `docs/TRABAJO_PARALELO_AGENTES.md`).

---

## Objetivo e issue

Cerrar el puente catálogo → escena retro3d. `nasa3d.py` ya devolvía URLs
`.obj`/`.glb` del catálogo NASA 3D Resources, pero `tools/convertir-estatua.mjs`
solo leía STL. Añadir cargadores OBJ y GLB (JS puro, sin dependencias) que
alimenten `soldar → simplificar(QEM) → normalizar → moduloDeMalla`, conservando
procedencia.

Relacionado: #590 (convertidor), #351 (frontera de arte: solo geometría, sin
materiales), #362 (retro3d rebanada 5).

## Archivos cambiados

- `tools/convertir-estatua.mjs`
  - Nuevo `leerObj(texto)`: vértices `v`, caras `f`, abanico para n-gons,
    índices 1-based y negativos, ignora `vt`/`vn` (#351).
  - Nuevo `leerGlb(bytes)`: glTF binario v2 — cabecera 12 B + chunk JSON +
    chunk BIN; accessors `POSITION` e `indices`; buffer embebido o data-URI
    base64; soporta indexado y triangle-soup; ignora normales/UV (#351).
  - `principal()`: ramifica por extensión (`.glb`/`.obj`/`.stl`); OBJ vía
    `TextDecoder` (no `Uint8Array.toString`); procedencia CLI
    (`--fuente/--licencia/--obra/--autoria/--modelo`). Si falta `--fuente` y
    no es ficha conocida → `exit(2)`.
- `tools/tests/test_convertir_estatua.mjs`
  - Tests OBJ (10) + GLB (4). El GLB incluye un `construirGlb()` mínimo (sin
    fichero externo) y un test de render en `componerEscena` (retro3d).

## Decisiones relevantes

- Sin deps externas: parseadores en JS puro (node built-ins).
- Procedencia obligatoria para mallas externas; no se afirma dominio público
  si `nasa3d.py` trae `licencia_declarada: null`.
- `retro3d.mjs` (rasterizador) NO se modificó: solo se consumió
  `componerEscena` para el test de render.

## Comandos de prueba (ejecutados, resultado real)

```bash
node --test tools/tests/test_convertir_estatua.mjs   # 14/14 pass
npm test                                              # 2241/2241 pass
```

Nota: `npm test` mostró 1 fallo en una pasada intermedia; era flaky (el mismo
que ya se vio con OBJ). Re-run inmediato → 0 fallos. No se tocó `foundry-module`.

CLI GLB real verificado:
```bash
node tools/convertir-estatua.mjs /tmp/cubo.glb cubo-prueba \
  --fuente "prueba local" --licencia "CC0 1.0" \
  --obra "Cubo de prueba" --autoria "nadie" --modelo "GLB de prueba" \
  --caras 12 --alto 2
# → 12 caras, 8 vértices, componerEscena renderiza (poligonos > 0)
```

## Qué NO se hizo y por qué

- **No se conectó `nasa3d.py` al convertidor** (el catálogo sigue sin
  descargar). Pendiente opción 2 del usuario: test e2e que baje un modelo real
  de NASA y lo convierta sin mocks.
- **No se abordó `rig-esqueleto.mjs` (#603)** ni niebla volumétrica (#362):
  frentes distintos, fuera de este issue.
- **No se soportan materiales / normales UV del GLB**: frontera de arte #351
  (color por paleta retro3d). PBR/textura sería otro PR.
- **No se hizo squash** de los commits (AGENTS.md: conservar originales).

## Comprobaciones pendientes / bloqueo

- **Review de PR #837** por humano (el usuario eligió "dejar para review").
- **Rebase** sobre `lagunak/nasa-3d-resources-como-fuente-de-mallas` si esa
  rama avanza antes del merge. El diff es solo `tools/`, así que el rebase es
  limpio.
- **Test e2e real** (opcional, sugerido): descargar un `.glb` CC0 de NASA 3D
  Resources vía `nasa3d.py` y convertirlo. Bloqueo: red al repo
  `nasa/NASA-3D-Resources` + elegir un modelo concreto.

## Riesgos / compatibilidad upstream

- Solo toca `tools/`: no afecta C++ (EmptyEpsilon), Lua ni el módulo Foundry,
  salvo el consumo de `componerEscena` (API estable, no modificada).
- GLB parser asume glTF 2.0. Versiones 1.0 no soportadas (NASA usa 2.0).
- `.stl` existente: comportamiento idéntico, sin cambios.

## Siguiente paso recomendado

1. Review/merge de #837 (OBJ + GLB).
2. Si se quiere el loop completo: issue pequeño "test e2e nasa3d.py →
   convertir-estatua" (opción 2 del usuario).
3. Frentes 3D abiertos tras esto: `rig-esqueleto.mjs` (#603) y niebla
   volumétrica (#362).

## Cómo arranca el siguiente

```bash
cd <raíz del repo>
git fetch origin
git switch lagunak/cargador-obj-nasa-3d
node --test tools/tests/test_convertir_estatua.mjs   # esperado 14/14
npm test                                             # esperado 2241/2241
# usar:
node tools/convertir-estatua.mjs fichero.glb NOMBRE \
  --fuente "..." --licencia "..." --obra "..." --autoria "..." --modelo "..." \
  --caras N --alto M
```
