# ADR-0006 — Vendorizar highlight.js en `script_docs/`

- Estado: Aceptada
- Fecha: registrada 2026-07-16 (issue #87, PR #89)
- Fuentes: `script_docs/vendor/`, alertas CodeQL 8/9

## Contexto

El generador heredado de `script_reference.html` cargaba highlight.js desde un
CDN sin atributo `integrity` (alertas CodeQL 8 y 9: inclusión de script de
tercero no verificable).

## Decisión

highlight.js se vendoriza en `script_docs/vendor/` y `main.py` lo incrusta
inline mediante la etiqueta `{{inline ...}}`. La salida sigue siendo un único
HTML autocontenido que funciona offline.

## Consecuencias

- Divergencia permanente y vigilada respecto a upstream: cualquier merge que
  toque `script_docs/` debe preservarla (`docs/UPSTREAM.md`, CLAUDE.md).
- Actualizar highlight.js pasa a ser responsabilidad del fork.
