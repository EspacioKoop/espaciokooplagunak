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
    hueso (su segmento cabeza→cola, siendo la cola la cabeza de su hijo) y se
    queda con las `MAX_INFLUENCIAS` (4) más cercanas; peso ∝ 1/distancia², se
    descartan los residuos por debajo del 5 % del hueso más fuerte y se
    normaliza a suma 1 vía `normalizarPesos` de `rig-esqueleto.mjs`. Reusa el
    rig de fase 1 (sin duplicar álgebra).
  - `extraerRegion(malla, pesos, rig, {hueso, threshold=0.5})`: una cara entra
    si TODOS sus vértices pesan ≥ `threshold` para `hueso`, y los vértices de la
    pieza se DERIVAN de las caras retenidas (ni aristas colgando ni vértices
    huérfanos sin cara). `threshold` inclusivo.
  - Sin dependencias: solo `rig-esqueleto.mjs` (puro, corre en Node y navegador).
- `tools/tests/test_pesar-despiezar.mjs` (NUEVO) — 7 tests:
  1. `pesosAutomaticos` no deja vértice sin hueso y respeta el tope de 4.
  2. La mano del brazo de prueba queda del antebrazo sin pesos a mano.
  3. **CRITERIO DE SALIDA fase 2:** con pesos automáticos el antebrazo se dobla
     por el codo: la mano va a −x, y con tolerancia 1e−9 el hombro NO se mueve,
     el codo es el pivote exacto y el antebrazo conserva su longitud — prueba
     que los pesos automáticos son anatómicamente sensatos, no un amasijo.
  4. `extraerRegion` aísla el antebrazo (mano dentro, hombro fuera) a umbral 0.6.
  5. `extraerRegion` no devuelve vértices sin cara (cara a medio umbral → pieza
     vacía, no un vértice suelto).
  6. `extraerRegion` falla con hueso inexistente.
  7. Malla real (Venus, 448 v) se pesa y despieza sin NaNs; los pesos son un
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
node --test tools/tests/test_pesar-despiezar.mjs   # 7/7 pass
node --test 'tools/tests/test_*.mjs'                # 7/7 (glob de CI: prefijo test_*.mjs)
node --test foundry-module/tests/*.test.mjs          # 2307/2307 (Fase 1 intacta; cubre convertir-estatua.test.mjs)
```

NOTA CI: `tools.yml` ya corre también los tests Node de `tools/` (paso
"Ejecutar tests de tools/ (Node)", glob `tools/tests/test_*.mjs`), así que una
rotura de `pesar-despiezar.mjs` enrojece la puerta en vez de pasar verde por
omisión — era el bloqueante del review de #841. `foundry-module.yml` corre
`foundry-module/tests/*.test.mjs`, que cubre `convertir-estatua.test.mjs` y la
Fase 1; `convertir-estatua` NO es un test de `tools/`.

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

- **Review de este PR** (rama `lagunak/rig-fase2-pesos-auto`): cerrado. Los
  tests Node de `tools/` ya corren en CI (paso añadido a `tools.yml`); el
  reviewer ve los 7 casos en el check del job Tools, no una suite vacía.
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
node --test tools/tests/test_pesar-despiezar.mjs   # esperado 7/7
# usar:
node -e "import('./tools/pesar-despiezar.mjs').then(m=>console.log(Object.keys(m)))"
#   pesosAutomaticos, extraerRegion
```
