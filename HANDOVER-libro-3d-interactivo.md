# Handover — Libro 3D interactuable (#853)

Fecha: 2026-08-29. Rama: `feature/libro-3d-interactivo`. Autor del trabajo: agente (oc/hy3-free).

## Estado

- **Hecho y verificado**: `foundry-module/scripts/libro-geometria.mjs` — geometría PURA del libro
  (dos tapas + lomo + hoja que gira) por ángulo de apertura (`apertura`, rad) y hoja en vuelo
  (`hojaVuelo`, rad). Devuelve `{vertices, caras}` (caras = cuadriláteros) sin importar el motor.
  Sigue el patrón de `rig-esqueleto.mjs` (#603). 32 vértices / 24 caras.
  Modelo de bisagra: lomo en x=0 (eje z = alto); tapas cuelgan de la bisagra y se abren en el
  plano xy con `α = π/2 − apertura/2` (0 = cerrado vertical, π = abierto plano). La hoja gira de
  la tapa izquierda (hojaVuelo=0) a la derecha (hojaVuelo=apertura), siempre levantada `grosor`.
- **Tests**: `foundry-module/tests/libro-geometria.test.mjs` (6, todos verdes). Comando área:
  `node --test foundry-module/tests/*.test.mjs` → 2313 pass / 0 fail.
- **Declarado huérfano** en `docs/orphan-declarations.json` (foundation=true, evidencia #853) y
  **mapeado al área "escenas y 3D"** en `docs/TRABAJO_PARALELO_AGENTES.md`. Sin esto el CI rompe
  (`modulos-alcanzables.test.mjs` y `tools/tests/test_mapa_areas.py`).
- Commit: `b966fdf6`. No push (protección de rama + AGENTS.md: el agente no fusiona).

## Lo que QUEDA por hacer (siguiente sesión)

El issue #853 pide 3 módulos + enganche en escena. Solo el primero (geometría) está hecho.
Faltan, EN ESTE ORDEN (verticales finos, cada uno su PR verde):

1. `libro-pagina.mjs` — representación visual de la página vía `chapasDeRejilla` (de
   `nave-mural-pixel.mjs`), con su propio `CELDA` (mirar #836/#838 para la medida) y un tope
   validado en import (mirar `TOPE_CUADRO`/`TOPE_OBJETO`). Regla dura #526/#838: mancha
   tipográfica + composición, SIN texto legible ni datos de partida (nada de mapas, tablas,
   coordenadas, cartas de navegación).
2. `libro-catalogo.mjs` — obra + autor + procedencia, validado POR `validarCatalogoPiezas`
   (de `procedencia-catalogo.mjs` #598). `naturaleza` debe ser un valor ya existente en
   `NATURALEZAS` de main; el issue sugiere `"interpretacion"` pero HAY QUE confirmarlo contra
   main antes de usarla (comentario eGurucharri en #853). Si no existe, proponerlo en su propio PR.
3. Estado efímero (página actual / ángulo / animación) en la VENTANA, no en la escena
   (`docs/FOUNDRY.md`: la escena no recuerda). `prefers-reduced-motion` en el primer vertical.
4. Enganche en `nave-estancias.mjs` con el patrón de interacción de cartela/consola
   (`accion`, flank entrada/salida, #509/#598). Campo de pruebas en `tools/campo-de-pruebas/`
   como #838.

## Restricciones heredadas (no negociables, de #853 y comentarios)

- Nada que se lea como instrumento (#526/#838): el libro es contenido expositivo, no jugable.
- Cero binarios: página dibujada con primitivas (#548/#550); texto = mancha tipográfica.
- Procedencia obligatoria `naturaleza: "interpretacion"` + ficha en `docs/PROCEDENCIA_ASSETS.md`
  + cartela con obra y autor en es/en.
- Presupuesto es la condición: medir antes de empujar; la medida va en la cabecera del módulo
  (ver `nave-mural-pixel.mjs`). Ya medido para geometría: 32 v / 24 caras.
- Orden de caras (#510): dos páginas pegadas al lomo (hojaVuelo∈{0,apertura}) quedan coplanares
  con su tapa → parpadeo posible. Documentar, NO reintentar una 4ª vía fallida.

## Cómo verifiqué (para no repetir)

- Tests Node: `node --test "foundry-module/tests/*.test.mjs"` (OJO: el glob es OBLIGATORIO;
  sin glob `foundry-module/tests/` falla siempre — patrón de fallo del repo).
- Guarda de huérfanos: `python3 scripts/check_orphan_modules.py --check` (rc 0).
- Área-map: `(cd tools && python3 -m pytest tests/test_mapa_areas.py -q)`.
- Orphan unit: `python3 -m unittest discover -s scripts/tests -p 'test_check_orphan_modules.py'`.

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
