# Handover — rig-esqueleto (#603)

**Epic:** #603 (etiqueta `decision`)
**Estado Fase 1:** MERGED en PR #609 — `feat(retro3d): huesos, pesos y deformación de malla`
**Decisión de arte:** **"todo escaneado"** (Eloy, 2026-08-20) — los avatares se
construyen a partir de mallas escaneadas, no estilizadas. El rig consume esas
mallas escaneadas.
**Fecha:** 2026-08-28

---

## Qué es #603

Sistema de esqueleto (rig) para avatares en retro3d: jerarquía de huesos, pesos
de vértice por hueso, y deformación de malla por *Linear Blend Skinning* (LBS).
Es la base para que un avatar pueda articularse (brazos, cabeza, despiece en
regiones) sin re-estilizar por cada pose.

## Estado: Fase 1 HECHA (PR #609, MERGED)

`foundry-module/scripts/rig-esqueleto.mjs` (Node/JS puro, corre en Node y en el
navegador — no toca `retro3d.mjs`, solo entra/sale como `{ vertices, caras }`):

- `MAX_INFLUENCIAS = 4` — tope de huesos por vértice.
- `crearRig(huesos)` — construye la jerarquía y valida:
  `rig_vacio`, `id_duplicado`, `padre_inexistente`, `ciclo`, `cabeza_invalida`.
  El orden de la lista da igual: la jerarquía se resuelve por `padre`.
- `normalizarPesos(rig, pesos, totalVertices)` — recorta a ≤4 influencias,
  normaliza a suma 1; errores: `vertice_sin_hueso`, `pesos_incompletos`,
  `hueso_inexistente`, `peso_invalido`, `demasiadas_influencias`.
- `deformarMalla(malla, rig, pesos, pose = {})` — aplica LBS. **Pose parcial
  válida**: lo no nombrado en `pose` se queda en reposo. No muta la malla de
  origen (entra congelada de `data/mallas`); la topología (caras) no cambia.
- `posicionesDeHuesos(rig, pose = {})` — consulta las cabezas de hueso posadas
  (para colgar cosas de ellas: armas, accesorios).
- `matricesDePose(rig, pose = {})` — calcula las matrices de hueso por pose.

**Decisión de diseño:** la pose en reposo es **solo traslación** (no hace falta
inversa de matriz). `retro3d.mjs` NO se modificó: el rig compone la malla ya
deformada y se la pasa a `componerEscena`.

**Tests:** `foundry-module/tests/rig-esqueleto.test.mjs` — **11 tests**. Incluye
el **CRITERIO DE SALIDA de Fase 1**: *"el brazo se dobla POR EL CODO"* (un brazo
de 2 huesos con pesos reparte se deforma correctamente al rotar el codo), y
*"una malla importada de verdad se deforma sin degenerar"* (LBS sobre una malla
real escaneada sin producir NaNs/colapso).

## Estado: Fase 2 PENDIENTE (siguiente frente)

El issue #603 desglosa la Fase 2 en sub-fases (603.1 / 603.2 / 603.3). A grandes
rasgos falta:

- **Auto-weights:** asignar pesos de vértice automáticamente a la malla escaneada
  (ahora los pesos se pasan a mano en los tests). Esto es lo que conecta el rig
  con `convertir-estatua.mjs`: al convertir un avatar escaneado, hay que emitir
  también su rig + pesos.
- **Despiece / extracción de regiones:** partir la malla en regiones articulables
  (cabeza, torso, brazos…) para el "todo escaneado" y poder reusarlas.

**Punto de enganche:** `tools/convertir-estatua.mjs` podría, para avatares
escaneados, emitir además un rig (jerarquía + pesos) junto a la malla `.mjs`. Hoy
nada consume `rig-esqueleto.mjs` en el pipeline: es un módulo **huérfano** (esta
probado y mergeado, sin integrador).

## Cómo arranca el siguiente

```bash
cd <raíz del repo>
node --test foundry-module/tests/rig-esqueleto.test.mjs   # 11 tests, Fase 1
# leer la API y los casos de uso:
less foundry-module/scripts/rig-esqueleto.mjs
less foundry-module/tests/rig-esqueleto.test.mjs
gh issue view 603        # sub-fases 603.1/603.2/603.3 de Fase 2
gh pr view 609           # qué entregó la Fase 1 (MERGED)
```

## Qué NO se hizo y por qué

- **No se integró el rig en `convertir-estatua.mjs`**: Fase 1 entregó la
  librería de deformación; la integración (auto-weights + emitir rig desde el
  escaneado) es Fase 2 y depende de la decisión de arte "todo escaneado" ya
  tomada. No se anticipó para no acoplar prematuramente.
- **No se modificó `retro3d.mjs`**: el rig vive fuera del rasterizador; solo
  compone la malla ya deformada.
- **No se hicieron animaciones/clips**: solo pose estática + LBS. Clips de
  animación serían otro frente sobre `deformarMalla`.

## Riesgos / notas

- `MAX_INFLUENCIAS = 4` es un tope de diseño; subirlo obliga a tocar
  `normalizarPesos` y el consumidor (retro3d espera ≤4).
- La pose en reposo es solo traslación por diseño: si Fase 2 necesita rotación en
  reposo, habrá que añadir inversa de matriz en `matricesDePose`.
- `docs/orphan-declarations.json` es la fuente de módulos huérfanos: confirmar
  que `rig-esqueleto` esté declarado como huérfano `cimiento:false` (sin
  consumidor) para que las suites Node no lo den por alcanzable.
