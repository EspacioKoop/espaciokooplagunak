# Handover — cargadores OBJ y GLB + normalización Draco (NASA 3D Resources)

**Rama:** `lagunak/cargador-obj-nasa-3d`
**PR:** #837 (abierto, contra `lagunak/nasa-3d-resources-como-fuente-de-mallas`)
**Autores:** eGurucharri (OBJ + GLB) · continuación e2e real + normalización Draco por Hermes
**Fecha última actualización:** 2026-08-28

Formato de entrega: ver `AGENTS.md` → "Entrega requerida". Añade
explícitamente qué NO se hizo y por qué (ver `docs/TRABAJO_PARALELO_AGENTES.md`).

---

## Objetivo e issue

Cerrar el puente catálogo → escena retro3d. `nasa3d.py` ya devolvía URLs
`.obj`/`.glb` del catálogo NASA 3D Resources, pero `tools/convertir-estatua.mjs`
solo leía STL. Añadir cargadores OBJ y GLB (JS puro) que alimenten
`soldar → simplificar(QEM) → normalizar → moduloDeMalla`, conservando procedencia.

**Ampliación de esta sesión:** los GLB "no-conformes" de NASA resultaron ser
**comprimidos con Draco** (`KHR_draco_mesh_compression`). Se añadió un paso de
normalización (`tools/normalizar-glb.mjs`) que decodifica Draco y reempaqueta a
un GLB canónico que `leerGlb` ya entiende. Ver issue #839 (corregido: no es
geometría ausente, es Draco).

Relacionado: #590 (convertidor), #351 (frontera de arte: solo geometría, sin
materiales), #362 (retro3d — **CERRADO**), #603 (rig-esqueleto — ver handover aparte).

## Archivos cambiados (acumulado)

- `tools/normalizar-glb.mjs` (NUEVO)
  - `normalizarGlb(bytes)` → `{ bytes, draco, estadisticas }`. Si el GLB no usa
    Draco, lo pasa íntegro (`draco:false`). Si usa Draco, decodifica cada
    primitiva (POSITION + NORMAL + índices) y reempaqueta a UN solo buffer con
    accessors canónicos; descarta TEXCOORD/COLOR/JOINTS (#351).
  - **Draco en Node-only**: carga `draco3d` (WASM). El navegador nunca lo ve
    porque el convertidor produce una malla `.mjs` plana.
  - **Cuantización:** Draco guarda POSITION/NORMAL como enteros cuantizados;
    `decoder.GetAttributeFloatForAllPoints` devuelve **0** para ellos. Se leen
    como enteros (`GetAttributeIntForAllPoints`) y se des-cuantizan con el
    `min`/`max` del accessor glTF (que el exportador Draco sí incluye). Fallback
    al float-path si el accessor no trae min/max (p.ej. fixture sintético).
  - **Strips:** `GetTrianglesUInt32Array` devuelve 0 si la malla está en triangle
    strips; se usa `GetFaceFromMesh(mesh, i, cara)` en bucle (expande a triángulos).
- `tools/convertir-estatua.mjs`
  - `leerObj(texto)`, `leerGlb(bytes)` (ver handover previo).
  - **NUEVO:** en la rama `.glb`, `principal()` hace `await normalizarGlb(bytes)`
    antes de `leerGlb`; si venía comprimido avisa por stderr.
  - REGRESIÓN: `leerGlb` lanza error CLARO si un accessor POSITION/índices carece
    de `bufferView` (ocurre en GLB que usa Draco pero NO en la rama_que decidimos,
    porque normalizarGlb ya los descodificó; el check queda como defensa).
- `tools/tests/test_convertir_estatua.mjs`
  - OBJ (10) + GLB (4) + 2 regresión GLB sin bufferView + **2 Draco** = **18**.
  - Fixture `construirGlbDraco(pos, idx)`: codifica un cubo con el encoder de
    `draco3d` (`DT_FLOAT32 = 6`, `DracoInt8Array` de salida) y lo envuelve en un
    GLB con la extensión Draco + accessor POSITION con `min`/`max`. Un test
    comprueba round-trip (8 vértices, 12 caras) y que **no es degenerado** (hay
    vértices fuera del origen — esto cazó el bug de cuantización a ceros).
- `tools/e2e-nasa3d-convertir.mjs`
  - e2e real: `nasa3d.py` → descarga un GLB → `convertir-estatua` → render en
    retro3d. Default **Argo** (Draco comprimido). Render robusto: prueba varios
    yaw y exige ≥1 con polígonos finitos (no depende del encuadre de cámara).
  - No corre en CI (red, flaky).
- `package.json`
  - `draco3d` en `dependencies` (única dependencia inevitable: decodificar Draco
    requiere el decoder de Google; no hay manera pura-JS estándar).
- `docs/HANDOVER-cargadores-mallas-obj-glb.md` (este).

## Decisiones relevantes

- `draco3d` es la ÚNICA dependencia nueva. Se justifica: decodificar
  `KHR_draco_mesh_compression` no es factible sin el decoder de Google (WASM).
  `@gltf-transform` también sirve pero es más pesado; se descartó para el pipeline.
- Sin deps para OBJ/GLB ya planos (JS puro, node built-ins).
- Procedencia obligatoria para mallas externas; no se afirma dominio público si
  `nasa3d.py` trae `licencia_declarada: null`.
- `retro3d.mjs` (rasterizador) NO se modificó: solo se consumió `componerEscena`.

## Comandos de prueba (ejecutados, resultado real)

```bash
node --test tools/tests/test_convertir_estatua.mjs   # 18/18 pass
node --test foundry-module/tests/*.test.mjs          # 2241/2241 pass  (comando CANON de CI: foundry-module.yml)
node tools/e2e-nasa3d-convertir.mjs                   # LOOP OK (Argo, GLB Draco real de NASA)
node tools/e2e-nasa3d-convertir.mjs "CubeSat"        # LOOP OK (otro Draco real)
```

Sustituir `npm test`: el `package.json` que define `npm test` **no está
trackeado**; la CI usa el glob directo. En checkout limpio instalar con
`npm install` para bajar `draco3d` (necesario para `tools/tests/...` y e2e).

## Hallazgo del e2e real (importante)

La "opción 2" del handover previo se ejecutó contra modelos **reales** de NASA
3D Resources y sacó un bug que los tests sintéticos no cubrían:

- **VARIOS GLB de NASA usan Draco** (`KHR_draco_mesh_compression`): la geometría
  NO está como floats en el buffer, sino empaquetada en un blob Draco. Medidos con
  Draco: `Argo`, `Ares 1`, `CubeSat`, `Aeronomy of Ice`. **Sin Draco** (leen
  directo): `Base Station`, `1999 RQ36 asteroid`.
- **Antes:** `convertir-estatua.mjs` estallaba con `TypeError` (accessor POSITION
  sin `bufferView`) en esos modelos — su fuente primaria.
- **Ahora:** `normalizarGlb` decodifica Draco → GLB canónico → `leerGlb` lo lee.
  Verificado en `Argo` (9221→870 caras, 640 vértices) y `CubeSat`
  (23570→900 caras) con render real en retro3d.
- **GOTCHA de cuantización:** `GetAttributeFloatForAllPoints` devuelve 0 para los
  atributos cuantizados de NASA; hay que leer enteros y des-cuantizar con el
  `min`/`max` del accessor glTF. (Cazado porque el mesh decodificado salía
  degenerado: todos los vértices en el origen → 0 polígonos al renderizar.)

**¿Se pueden leer los Draco?** Sí, ahora. No hace falta pedir export conforme a NASA.

## Qué NO se hizo y por qué

- **No se conectó `nasa3d.py` al convertidor en un solo paso automático**: hay un
  script e2e manual (`tools/e2e-nasa3d-convertir.mjs`) que lo hace; no se metió en
  CI por la dependencia de red.
- **No se abordó `rig-esqueleto.mjs` (#603)**: ver `docs/HANDOVER-rig-esqueleto.md`
  (epic con etiqueta `decision`; Fase 1 ya mergeada en PR #609).
- **No se soportan materiales / normales UV del GLB**: frontera de arte #351
  (color por paleta retro3d). PBR/textura sería otro PR. (SÍ se decodifican las
  NORMAL de vértice si el modelo las trae, para mejor sombreado, pero retro3d las
  ignora igualmente.)
- **No se hizo squash** de los commits (AGENTS.md: conservar originales).

## Comprobaciones pendientes / bloqueo

- **Review de PR #837** por humano (el usuario eligió "dejar para review"). El diff
  ahora incluye `tools/normalizar-glb.mjs`, el hook en `convertir-estatua.mjs`, los
  2 tests Draco, `draco3d` en `package.json` y este handover.
- **Issue #839 ya creado y corregido**: "NASA 3D Resources publica GLB comprimidos
  con Draco (no rotos)". La normalización propuesta en el issue ya está implementada
  en esta rama/PR.
- **`package.json` sin trackear** (loose end histórico): ahora sí se commitea
  porque añade `draco3d` (necesario para los tests). Confirmar que no pisa nada.
- **Rebase** sobre `lagunak/nasa-3d-resources-como-fuente-de-mallas` si avanza.

## Riesgos / compatibilidad upstream

- Solo toca `tools/`: no afecta C++ (EmptyEpsilon), Lua ni el módulo Foundry, salvo
  el consumo de `componerEscena` (API estable, no modificada).
- `draco3d` carga un WASM en Node; en CI el glob `foundry-module/tests/*` NO toca
  `tools/`, así que el WASM solo se carga en `tools/tests/...` (e2e/unit de Draco).
- GLB parser asume glTF 2.0. Versiones 1.0 no soportadas (NASA usa 2.0).

## Siguiente paso recomendado

1. Review/merge de #837 (incluye normalización Draco + fix regresión e2e).
2. Ver `docs/HANDOVER-rig-esqueleto.md` para el frente #603.
3. (Opcional) conectar `nasa3d.py`→convertir en un solo comando CLI.

## Cómo arranca el siguiente

```bash
cd <raíz del repo>
git fetch origin
git switch lagunak/cargador-obj-nasa-3d
npm install                              # baja draco3d
node --test tools/tests/test_convertir_estatua.mjs   # esperado 18/18
node --test foundry-module/tests/*.test.mjs          # esperado 2241/2241
node tools/e2e-nasa3d-convertir.mjs                   # LOOP OK (Argo, Draco real)
# usar el convertidor (normaliza Draco solo):
node tools/convertir-estatua.mjs fichero.glb NOMBRE \
  --fuente "nasa/NASA-3D-Resources" --licencia "NASA no declara licencia; ver condiciones de uso de medios (nasa.gov/nasa-brand-center/images-and-media)" \
  --obra "Argo" --autoria "NASA" --modelo "3D Models/Argo" \
  --caras 900 --alto 2.2
```
