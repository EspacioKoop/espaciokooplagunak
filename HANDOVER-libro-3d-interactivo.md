# Handover — Libro 3D interactuable (#853)

Fecha: 2026-08-29. Rama: `feature/libro-3d-interactivo` (con upstream `origin/feature/libro-3d-interactivo`).
Autor del trabajo: agente (oc/hy3-free).

## Estado

- **Hecho y verificado (geometría, vertical previo)**: `foundry-module/scripts/libro-geometria.mjs`
  — geometría PURA del libro (dos tapas + lomo + hoja que gira) por ángulo de apertura
  (`apertura`, rad) y hoja en vuelo (`hojaVuelo`, rad). Devuelve `{vertices, caras}` (caras =
  cuadriláteros) sin importar el motor. Sigue el patrón de `rig-esqueleto.mjs` (#603). 32 vértices /
  24 caras. 6 tests verdes (`libro-geometria.test.mjs`).
- **Hecho y verificado (vertical 1, esta sesión)**: `foundry-module/scripts/libro-pagina.mjs` —
  dibujo de la página con `chapasDeRejilla` a CELDA_PAGINA=0.01 (1 cm, más fina que la del cuadro
  2,5 cm #836/#838 porque la hoja se mira más de cerca), tope validado al importar
  (TOPE_PAGINA=60), mancha tipográfica + composición SIN texto legible (#526/#838). Paleta `PAGINA`
  en `paleta.mjs` (frontera #351, sin color propio). 8 tests verdes; presupuesto real 17 caras /
  68 vértices. Huérfano + área `escenas y 3D` registrados.
- **PR #856 ABIÉRTO** contra `main`, **CI VERDE** (rc=0, todos los checks pass). Detalle:
  el primer run falló en "Puerta de tools" / "tools/tests (Linux)" por un ENLACE ROTO en este
  handover: citaba "tools/campo-de-pruebas/" en backticks y el gate refs-rotas lo marcaba roto
  (ese directorio no existe). Corregido a prosa en commit `73be94ca`; re-run verde. Rama con
  upstream configurado. **No mergeado**: pendiente de review humano (REVIEW_REQUIRED).
  URL: https://github.com/VaroTv7/espaciokooplagunak/pull/856
- Commits en la rama: `b966fdf6` (geometría, previo), `93104b50` (página), `73be94ca` (fix enlace roto).

## Lo que QUEDA por hacer

El issue #853 pide 3 módulos + enganche en escena.
- **Vertical 1 (página)**: HECHO y en PR #856.
- Solo faltan los verticales 2 y 3:

1. (HECHO) `libro-pagina.mjs` — ver arriba.
2. `libro-catalogo.mjs` — obra + autor + procedencia, validado POR `validarCatalogoPiezas`
   (de `procedencia-catalogo.mjs` #598). `naturaleza` debe ser un valor ya existente en
   `NATURALEZAS` de main.
   **DECIDIDO (opción A)**: esperar al merge de PR #851 (rama docs/museo-cuadros-836, OPEN y
   MERGEABLE), que ESTRENA `interpretacion` en `NATURALEZAS` (commit `2c39c12f`, #836). El issue
   #853 sugería `interpretacion` y es el valor correcto para un clásico redibujado (composición de
   otro identificada, no `obra-propia`). NO usar `obra-propia` ni `reconstruccion` (mentirían sobre
   la procedencia según la propia justificación de #836). Mientras #851 no entre, el catálogo no
   puede validarse en CI contra main.
3. Estado efímero (página actual / ángulo / animación) en la VENTANA, no en la escena
   (`docs/FOUNDRY.md`: la escena no recuerda). `prefers-reduced-motion` en el primer vertical.
4. Enganche en `nave-estancias.mjs` con el patrón de interacción de cartela/consola
   (`accion`, flank entrada/salida, #509/#598). Campo de pruebas al mismo nivel que el de los
   cuadros (#838): directorio de herramientas de pruebas con una escena mínima.

## Restricciones heredadas (no negociables, de #853 y comentarios)

- Nada que se lea como instrumento (#526/#838): el libro es contenido expositivo, no jugable.
- Cero binarios: página dibujada con primitivas (#548/#550); texto = mancha tipográfica.
- Procedencia obligatoria `naturaleza: "interpretacion"` + ficha en `docs/PROCEDENCIA_ASSETS.md`
  + cartela con obra y autor en es/en.
  **VERIFICADO 2026-08-29**: `interpretacion` NO existe en `NATURALEZAS` de `origin/main`
  (solo `[escaneo, escaneo-de-vaciado, fotogrametria, reconstruccion, obra-propia]`), pero SÍ se
  estrenó en PR #851 (commit `2c39c12f`, #836). Por tanto el vertical 2 se desbloquea al mergear
  #851; no se inventa la naturaleza.
- Presupuesto es la condición: medir antes de empujar; la medida va en la cabecera del módulo
  (ver `nave-mural-pixel.mjs`). Ya medido para geometría: 32 v / 24 caras. Para página
  (vertical 1): 68 v / 17 caras, a 1 cm de celda.
- Orden de caras (#510): dos páginas pegadas al lomo (hojaVuelo∈{0,apertura}) quedan coplanares
  con su tapa → parpadeo posible. Documentar, NO reintentar una 4ª vía fallida.

## Cómo verifiqué (para no repetir)

- Tests Node: `node --test "foundry-module/tests/*.test.mjs"` (OJO: el glob es OBLIGATORIO;
  sin glob `foundry-module/tests/` falla siempre — patrón de fallo del repo). Resultado: 2321 pass / 0 fail.
- Guarda de huérfanos: `python3 scripts/check_orphan_modules.py --check` (rc 0).
- Área-map: `(cd tools && python3 -m pytest tests/test_mapa_areas.py -q)` (4 passed).
- Gate de enlaces rotos: `python3 tools/refs-rotas.py` (rc 0; rompe CI "Puerta de tools" si un
  documento cita una ruta inexistente en backticks — escribir rutas en PROSA).
- CI del PR: `gh pr checks 856` (rc 0 = verde, rc 8 = pending, otro = fail). No afirmar "pasa"
  hasta ver rc=0.

## Aprendido proactivamente esta sesión (vale para otros issues)

- La mayoría de enhancements Foundry YA TIENEN PR abierto: #836→#851/#838, #810→#831,
  #832→#835, #818→#819, #840→#850. Antes de construir, cruzar issue↔PR para no duplicar.
- #852 es el handover curado de "PRs fáciles de merge"; útil como cola de trabajo, pero
  estándose caducando (algunos CHANGES_REQUESTED ya evolucionaron).
- Regla del repo: nuevo módulo en `foundry-module/scripts/` → OBLIGA a tocar 3 sitios o CI roja:
  `docs/orphan-declarations.json` + `docs/TRABAJO_PARALELO_AGENTES.md` (área) + su test.
  `modulos-alcanzables.test.mjs` exige declaración; `test_mapa_areas.py` exige área.
- Nunca entregar "archivo sin commit": AGENTS.md exige rama + commit; el diff es el entregable.
- `execute_code` con `command=` (en vez de `code=`) da error en bucle; usar `terminal` para shell.
- **`interpretacion` NO está en main pero SÍ en PR #851** (#836, commit `2c39c12f`). Para reusarlo
  hay que esperar/mergear #851; no duplicar la naturaleza en otro PR (conflicto de merge).
- El módulo del cuadro (#836/#838) es `nave-cuadro.mjs`, pero NO está en `main`: vive en el PR
  #851 (worktree `v-851`). Para copiar su patrón leer de ese worktree o de `git show 906d3f7b`.
- **Gate refs-rotas rompe CI** si un doc cita una ruta inexistente en backticks (le pasó a este
  mismo handover con "tools/campo-de-pruebas/"). Escribir rutas en prosa. Verificar con
  `python3 tools/refs-rotas.py` antes de empujar.
- `gh pr checks <n>` con exit-code es el veredicto fiable de CI (0 verde / 8 pending / otro fail);
  los bucles caseros de `statusCheckRollup` pueden fallar por buffering.
