# Handover — consumidor real de rig-esqueleto (fase 4 de #603)

**Issue:** #603 · **Fase:** 4 (consumidores) · **Fecha:** 2026-08-28
**Rama:** `lagunak/rig-fase4-consumidor` → `main`

Formato de entrega: ver `AGENTS.md` → "Entrega requerida". Añade
explícitamente qué NO se hizo y por qué (ver `docs/TRABAJO_PARALELO_AGENTES.md`).

---

## Objetivo e issue

La fase 1 de #603 (`rig-esqueleto.mjs`, PR #609) dio el formato de rig y la
deformación de malla, pero estaba declarada huérfana (`cimiento:false`) en
`docs/orphan-declarations.json` porque "su consumidor depende de una decisión
de arte todavía abierta". Esa decisión ya está tomada —Eloy, 2026-08-20, en
#603: **todo escaneado**—, así que el cableado es lícito. Este entregable es el
primer consumidor real de la fase 4: el museo dobla una pieza según su rig
antes de `componerEscena`, y con eso `rig-esqueleto.mjs` deja de estar huérfana.

## Archivos cambiados

- `foundry-module/scripts/estatua-rig.mjs` (nuevo)
  - Consumidor real: `deformarPieza(malla, {rig, pesos, pose})` compone
    `crearRig` + `normalizarPesos` + `deformarMalla` de `rig-esqueleto.mjs`.
    Sin dependencias nuevas; reusa el módulo puro de fase 1.
- `foundry-module/scripts/museo-escena.mjs`
  - `colocarPieza` importa `deformarPieza` y la aplica solo si `pieza.rig`
    existe. Sin `rig`, la malla entra igual que siempre: el aspecto actual del
    museo NO cambia, solo se habilita la pose donde se declare.
- `foundry-module/tests/estatua-rig.test.mjs` (nuevo, 3 tests)
  - Reposo = identidad exacta (no cambia el aspecto).
  - Pose dobla el antebrazo con gradiente (criterio de fase 4: la mano va a -x
    y se mueve más que el hombro; sin NaNs; topología intacta).
  - Rig roto falla (no silencia el error de `normalizarPesos`).
- `docs/orphan-declarations.json`
  - `rig-esqueleto.mjs`: `declared-orphan` → `connected` (se quita `foundation`).
  - `estatua-rig.mjs`: nueva entrada `connected`.

## Decisiones relevantes

- El consumidor vive en `foundry-module/scripts/` (el inventario de huérfanos
  solo cubre ese directorio), no en `tools/`. Por eso la fase 2
  (`pesar-despiezar.mjs`, en `tools/`) no sirve de por sí para des-huerfanar:
  aquí se compone con pesos declarados por la pieza, no auto-weights.
- Cablear en `museo-escena.mjs` (no en `retro3d.mjs`) porque el museo es quien
  posee las piezas y ya es `connected` (lo importa `nave-catalogo-andar.mjs`);
  así `rig-esqueleto` queda alcanzable desde el manifiesto sin tocar el
  rasterizador.
- `pieza.rig` es opcional y no se añade a ninguna de las tres piezas curadas del
  catálogo: darles una pose es una decisión de contenido (y de cartela) que
  corresponde al curador, no un cambio mecánico.

## Comandos de prueba (ejecutados, resultado real)

```bash
# Inventario de huérfanos: rig-esqueleto debe salir "connected"
python3 scripts/check_orphan_modules.py --root foundry-module --check   # exit 0
python3 scripts/check_orphan_modules.py --root foundry-module --format json \
  | python3 -c "import sys,json; d=json.load(sys.stdin); \
  print([ (x['module'],x['status']) for x in d if x['module'] in ('rig-esqueleto.mjs','estatua-rig.mjs') ])"
# -> [('estatua-rig.mjs', 'connected'), ('rig-esqueleto.mjs', 'connected')]

node --test foundry-module/tests/estatua-rig.test.mjs   # 3/3
node --test foundry-module/tests/*.test.mjs             # 2310/2310 (era 2307 + 3)
node --check foundry-module/scripts/estatua-rig.mjs && node --check foundry-module/scripts/museo-escena.mjs
```

Huérfanos del repo: bajan de 9 a 8.

## Comprobaciones pendientes y bloqueo

- **Review/merge humano** (VaroTv7). El autor no auto-mergea (protección de
  rama + mala práctica).
- **No hay bloqueo mecánico:** todas las puertas locales en verde.

## Riesgos / compatibilidad upstream

- Solo toca `foundry-module/scripts/` (un módulo nuevo + `museo-escena.mjs`) y
  `docs/orphan-declarations.json`. No toca C++, Lua, `retro3d.mjs` ni el
  rasterizador.
- `componerEscena` sigue recibiendo `{vertices, caras}`; la deformación ocurre
  antes, como dicta el contrato de fase 1.
- Una pieza SIN `rig` se comporta idéntico a antes (passthrough), así que el
  museo actual no cambia de aspecto.

## Siguiente paso recomendado

1. Review/merge de este PR (fase 4, primer consumidor).
2. Contenido (siguiente paso, decisión de curador): declarar `rig` en una o
   varias piezas del catálogo `museo-piezas.mjs` para que se vean poseadas; o
   usarlo para "bustos como props" extrayendo una región con la fase 2
   (`pesar-despiezar.mjs`) y luego `deformarPieza`.
3. Frentes abiertos de #603 tras esto: fase 3 (retargeting de poses) y el resto
   de consumidores (PC/NPC, criaturas del bestiario) — decididos por la regla
   "ninguna silueta mezcla escaneado y caja" de #603.

## Cómo arranca el siguiente

```bash
cd <raíz del repo>
git fetch origin
git switch lagunak/rig-fase4-consumidor
python3 scripts/check_orphan_modules.py --root foundry-module --check   # exit 0
node --test foundry-module/tests/estatua-rig.test.mjs                   # 3/3
node --test foundry-module/tests/*.test.mjs                             # 2310/2310
# usar en una pieza del museo:
#   pieza.rig = { rig: [{id, cabeza}, ...], pesos: [[{hueso,peso}], ...], pose?: {...} }
# museo-escena.mjs la dobla antes de colocarla.
```
