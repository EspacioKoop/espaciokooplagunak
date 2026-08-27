# Handover — rig #603 Fase 2: pesos automáticos y despiece por región

**Epic:** #603 (etiqueta `decision`). **Fase 1 MERGED** en #609 (rig-esqueleto.mjs).
**Esta entrega:** Fase 2.1 — herramienta en `tools/` que asigna pesos por
distancia y recorta una región como pieza suelta.
**Rama:** `lagunak/rig-fase2-pesos-auto` · **PR:** contra `main` (#603).
**Fecha:** 2026-08-28

Formato de entrega: ver `AGENTS.md` → "Entrega requerida". Añade
explícitamente qué NO se hizo y por qué (ver `docs/TRABAJO_PARALELO_AGENTES.md`).

---

## Objetivo e issue

#603 quiere despiezar estatuas escaneadas en PC/NPC/criaturas. La fase 1 (rig
puro) lo dejaba TODO manual: los pesos se pasaban a mano en los tests. La fase
2 es la **herramienta de pesos y despiece** que el propio issue pide: dada una
malla y un rig, asignar pesos automáticos (por distancia al hueso) y permitir
extraer una región como pieza suelta — la cabeza de un busto ya es contenido
completo, no hace falta re-estilizarla.

Relacionado: #590 (convertidor de estatuas), #351 (frontera de arte: solo
geometría), #609 (Fase 1, MERGED).

## Archivos cambiados

- `tools/pesar-despiezar.mjs` (NUEVO)
  - `pesosAutomaticos(malla, rig)`: para cada vértice mide la distancia a cada
    hueso (su segmento cabeza→padre) y se queda con las `MAX_INFLUENCIAS` (4) más
    cercanas; peso ∝ 1/distancia, normalizado a suma 1 vía `normalizarPesos` de
    `rig-esqueleto.mjs`. Reusa el rig de fase 1 (sin duplicar álgebra).
  - `extraerRegion(malla, pesos, rig, {hueso, threshold=0.5})`: devuelve la sub-
    malla de vértices con peso ≥ `threshold` para `hueso`; una cara entra si
    TODOS sus vértices entran (pieza sin aristas colgando). `threshold` inclusivo.
  - Sin dependencias: solo `rig-esqueleto.mjs` (puro, corre en Node y navegador).
- `tools/tests/test_pesar-despiezar.mjs` (NUEVO) — 6 tests:
  1. `pesosAutomaticos` no deja vértice sin hueso y respeta el tope de 4.
  2. La mano del brazo de prueba queda del antebrazo sin pesos a mano.
  3. **CRITERIO DE SALIDA fase 2:** con pesos automáticos el antebrazo se dobla
     por el codo (dx de la mano a −x, hombro casi quieto) — prueba que los pesos
     automáticos son anatómicamente sensatos, no un amasijo.
  4. `extraerRegion` aísla el antebrazo (mano dentro, hombro fuera) a umbral 0.6.
  5. `extraerRegion` falla con hueso inexistente.
  6. Malla real (Venus, 448 v) se pesa y despieza sin NaNs; los pesos son un
     BLEND (hay pesos intermedios), no un tajo duro.

## Decisiones relevantes

- **Distancia al segmento del hueso**, no a su cabeza: un vértice sobre el tramo
  del hueso le pertenece, no al punto de la articulación. Estándar de industria.
- **Sin nuevo dependency**: `rig-esqueleto.mjs` ya es puro y exporta
  `normalizarPesos`; `tools/` ya importa de `../foundry-module/scripts/` (ej.
  `prerender-piel.mjs`), así que la frontera está permitida y no acopla.
- **`threshold` inclusivo** en `extraerRegion`: en una articulación los dos
  huesos pesan ~0.5, así que el vértice de la coyuntura entra en ambas piezas.
  Para una separación limpia (cabeza vs cuello) hay que subir el umbral (0.6 en
  el test del brazo); con solo 2 huesos el torso siempre pesa ≥0.5 y la región a
  0.5 es toda la malla — la partición fina necesita un esqueleto completo
  (fase 3/4).

## Comandos de prueba (ejecutados, resultado real)

```bash
node --test tools/tests/test_pesar-despiezar.mjs   # 6/6 pass
node --test tools/tests/*.test.mjs                  # 24/24 (con convertir-estatua)
node --test foundry-module/tests/*.test.mjs          # 2241/2241 (Fase 1 intacta)
```

NOTA CI: `tools.yml` solo corre `pytest` (Python) sobre `tools/tests/`; los
tests node de `tools/` (`test_convertir_estatua.mjs`, este) NO los corre CI —
es la convención existente desde #837. Se verifican en local. `foundry-module.yml`
sí corre el glob `foundry-module/tests/*.test.mjs` (cubre la Fase 1).

## Qué NO se hizo y por qué

- **No se cableó el rig a un consumidor** (fase 4): `rig-esqueleto.mjs` sigue
  huérfano `cimiento:false` en `modulos-alcanzables.test.mjs` (#603). La fase 4
  depende de la decisión de arte "todo escaneado" ya tomada; aquí solo se da la
  herramienta de pesos/despiece.
- **No se integró en `convertir-estatua.mjs`**: emitir rig+pesos al convertir un
  avatar escaneado es el punto de enganche de la fase 4, no de la 2.1. La
  herramienta queda como primitiva reutilizable.
- **No hay retargeting** (fase 3): una pose sobre un esqueleto a otro. Fuera de
  esta entrega, como dice el issue.
- **No se soportan pesos semánticos (landmarks)**: el issue admite una vía
  semántica futura (`extraerRegion(mesh, {name, landmarks})`); aquí solo la
  geométrica por distancia, que es lo que exigía la fase 2.1.

## Comprobaciones pendientes / bloqueo

- **Review de este PR** (rama `lagunak/rig-fase2-pesos-auto`). Tests en verde,
  pero node tools no corre en CI: el reviewer debe ejecutar el comando local.
- **#837 (OBJ/GLB + Draco)** sigue abierto y UNSTABLE en CI ( jobs de matriz
  pendientes); al mergear, la Fase 2 queda como trabajo independiente sobre main.
- **Fase 2.2 / 2.3**: más huesos (esqueleto completo) para que `extraerRegion`
  dé piezas nítidas (cabeza, brazos) y no toda-la-malla con 2 huesos.

## Riesgos / compatibilidad upstream

- Solo toca `tools/`: no afecta C++ (EmptyEpsilon), Lua ni el módulo Foundry en
  caliente. Consume `rig-esqueleto.mjs` (API estable de fase 1, no modificada).
- `normalizarPesos` es la misma función de fase 1: los pesos salen ya validados
  (todo vértice con ≥1 influencia, ≤4, suma 1).

## Siguiente paso recomendado

1. Review/merge de este PR (pesos auto + despiece).
2. Esqueleto completo de prueba (cadera/torso/cabeza/brazos) para que
   `extraerRegion` recorte la cabeza de un busto como pieza real (#603.2).
3. Fase 3 retargeting (#603.3) sobre el rig ya cableado.

## Cómo arranca el siguiente

```bash
cd <raíz del repo>
git fetch origin
git switch lagunak/rig-fase2-pesos-auto
node --test tools/tests/test_pesar-despiezar.mjs   # esperado 6/6
# usar:
node -e "import('./tools/pesar-despiezar.mjs').then(m=>console.log(Object.keys(m)))"
#   pesosAutomaticos, extraerRegion
```
