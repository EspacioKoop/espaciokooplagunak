# ADR-0004 — SeriousProton como repo hermano fijado por SHA (no submódulo)

- Estado: Aceptada
- Fecha: registrada 2026-07-16
- Fuentes: `docs/BUILDING.md`, `docker/Dockerfile`, `docker/build.sh`, `docs/BASELINE.md`

## Contexto

El motor SeriousProton vive en un repositorio separado (convención heredada de
upstream: directorio hermano, `-DSERIOUS_PROTON_DIR=../SeriousProton`). La CI
clonaba el HEAD vivo, de modo que podía romperse sin ningún cambio local.

## Decisión

Se mantiene la convención de repo hermano (no submódulo, para no divergir de
upstream), pero tanto la imagen de release (`docker/Dockerfile`) como el gate
de CI (`docker/build.sh`) fijan la **misma** revisión de SeriousProton por SHA.
Ambos pins se actualizan a la vez en cada sincronización upstream
(`docs/UPSTREAM.md`).

## Consecuencias

- Builds reproducibles y CI que solo se rompe por cambios propios.
- Desviación aceptada: los jobs heredados windows-cross/macOS siguen usando el
  `master` vivo — son empaquetado sin tests; se revisará si fallan en falso.
