# Handover — cargadores OBJ y GLB (y cierre del e2e real)

**Rama:** `lagunak/cargador-obj-nasa-3d`
**PR:** #837 (abierto, contra `lagunak/nasa-3d-resources-como-fuente-de-mallas`)
**Autores:** eGurucharri (OBJ + GLB) · continuación e2e real por Hermes
**Fecha última actualización:** 2026-08-27

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
materiales), #362 (retro3d — **CERRADO**, no abierto).

## Archivos cambiados (acumulado)

- `tools/convertir-estatua.mjs`
  - `leerObj(texto)`: vértices `v`, caras `f`, abanico para n-gons, índices
    1-based/negativos, ignora `vt`/`vn` (#351).
  - `leerGlb(bytes)`: glTF binario v2 — cabecera 12 B + chunk JSON + chunk BIN;
    accessors `POSITION` e `indices`; buffer embebido o data-URI base64; indexado
    y triangle-soup; ignora normales/UV (#351).
  - `principal()`: ramifica por extensión (`.glb`/`.obj`/`.stl`); procedencia CLI
    obligatoria (`--fuente/--licencia/--obra/--autoria/--modelo`).
  - **REGRESIÓN (continuación):** `leerGlb` ahora lanza error CLARO si un accessor
    POSITION o de índices carece de `bufferView`, en vez de estallar con
    `TypeError: Cannot read properties of undefined (reading 'buffer')`.
- `tools/tests/test_convertir_estatua.mjs`
  - Tests OBJ (10) + GLB (4) + 2 de regresión GLB no-conforme = **16**.
- `tools/e2e-nasa3d-convertir.mjs` (nuevo, continuación)
  - e2e real: `nasa3d.py` → descarga un GLB CONFORME → `convertir-estatua` →
    render en retro3d. No corre en CI (necesita red, sería flaky).
- `docs/HANDOVER-cargadores-mallas-obj-glb.md` (este).

## Decisiones relevantes

- Sin deps externas: parseadores en JS puro (node built-ins).
- Procedencia obligatoria para mallas externas; no se afirma dominio público
  si `nasa3d.py` trae `licencia_declarada: null`.
- `retro3d.mjs` (rasterizador) NO se modificó: solo se consumió `componerEscena`.

## Comandos de prueba (ejecutados, resultado real)

```bash
node --test tools/tests/test_convertir_estatua.mjs   # 16/16 pass
node --test foundry-module/tests/*.test.mjs          # 2241/2241 pass  (comando CANON de CI: foundry-module.yml)
node tools/e2e-nasa3d-convertir.mjs                   # LOOP OK (Base Station, GLB real de NASA)
```

Sustituir `npm test`: el `package.json` que define `npm test` **no está
trackeado** en la rama ni en `main` (loose end; vive en disco desde el commit
4f2afbcc, donde se añadió y nunca se borró por commit). La CI usa el glob
directo. En un checkout limpio usa el glob, no `npm test`.

## Hallazgo del e2e real (importante)

La "opción 2" del handover previo se ejecutó contra modelos **reales** de NASA
3D Resources y sacó un bug que los tests sintéticos no cubrían:

- **VARIOS GLB de NASA son NO CONFORMES a glTF 2.0:** los accessors POSITION (y
  a veces los de índices) NO traen `bufferView`, y la geometría no está en el
  fichero. Medidos no-conformes: `Argo`, `Ares 1 (A/B)`, `CubeSat (1RU/2RU/ICECube)`,
  `Aeronomy of Ice in the Mesosphere`. **Conformes** (sí leen): `Base Station`,
  `1999 RQ36 asteroid`, y seguramente más.
- **Antes:** `convertir-estatua.mjs` estallaba con
  `TypeError: Cannot read properties of undefined (reading 'buffer')` en esos
  modelos — precisamente su fuente primaria.
- **Ahora:** `leerGlb` lanza
  `GLB no conforme a glTF 2.0: el accessor N (POSITION) no tiene bufferView…`
  y propone usar un modelo conforme. Añadidos 2 tests de regresión (GLB
  sintético sin `bufferView` en POSITION y en índices).
- El **loop completo** se verificó contra un GLB conforme real
  (`Base Station`, 21 KB): 184 caras, 552 vértices, procedencia honesta (NASA,
  licencia null), render en retro3d = 62 polígonos finitos.

**¿Se pueden leer los no-conformes?** No con un loader glTF estándar: su accessor
POSITION no referencia ningún byte del buffer (el `min`/`max` declarado no aparece
en el BIN). Es un defecto de export de NASA, no del parser. Quien quiera esos
modelos debe pedir a NASA un export conforme o pasarlos por una herramienta que
los repare (re-empaquetado glTF).

## Qué NO se hizo y por qué

- **No se soportan los GLB no-conformes de NASA** (Argo, Ares 1…): su geometría
  no está en el fichero; no hay nada que leer. Se documenta como LIMITACIÓN, no
  como bug del parser.
- **No se conectó `nasa3d.py` al convertidor en un solo paso automático**: ahora
  hay un script e2e manual (`tools/e2e-nasa3d-convertir.mjs`) que lo hace; no se
  metió en CI por la dependencia de red.
- **No se abordó `rig-esqueleto.mjs` (#603)**: epic con etiqueta `decision`, fuera
  de este issue. (Y #362 de niebla está CERRADO, no abierto como decía el handover
  previo).
- **No se soportan materiales / normales UV del GLB**: frontera de arte #351
  (color por paleta retro3d). PBR/textura sería otro PR.
- **No se hizo squash** de los commits (AGENTS.md: conservar originales).

## Comprobaciones pendientes / bloqueo

- **Review de PR #837** por humano (el usuario eligió "dejar para review").
- **NUEVO issue sugerido:** "NASA 3D Resources exporta GLB no-conformes (POSITION
  sin bufferView)" — para decidir si se reparan en origen o se añade un paso de
  normalización en el pipeline.
- **Rebase** sobre `lagunak/nasa-3d-resources-como-fuente-de-mallas` si esa rama
  avanza antes del merge. El diff es solo `tools/`, así que el rebase es limpio.
- **`package.json` sin trackear**: decidir si se commitea (afecta a `npm test` en
  checkout limpio). No bloquea la CI (usa el glob).

## Riesgos / compatibilidad upstream

- Solo toca `tools/`: no afecta C++ (EmptyEpsilon), Lua ni el módulo Foundry, salvo
  el consumo de `componerEscena` (API estable, no modificada).
- GLB parser asume glTF 2.0. Versiones 1.0 no soportadas (NASA usa 2.0).
- `.stl` existente: comportamiento idéntico, sin cambios.

## Siguiente paso recomendado

1. Review/merge de #837 (incluye el fix de regresión e2e y el script e2e).
2. Abrir issue sobre los GLB no-conformes de NASA (ver arriba).
3. Frentes 3D abiertos tras esto: `rig-esqueleto.mjs` (#603).
4. (Opcional) commit de `package.json` para que `npm test` funcione en checkout
   limpio.

## Cómo arranca el siguiente

```bash
cd <raíz del repo>
git fetch origin
git switch lagunak/cargador-obj-nasa-3d
node --test tools/tests/test_convertir_estatua.mjs   # esperado 16/16
node --test foundry-module/tests/*.test.mjs          # esperado 2241/2241
node tools/e2e-nasa3d-convertir.mjs                   # LOOP OK (red a NASA)
# usar el convertidor:
node tools/convertir-estatua.mjs fichero.glb NOMBRE \
  --fuente "..." --licencia "..." --obra "..." --autoria "..." --modelo "..." \
  --caras N --alto M
```
