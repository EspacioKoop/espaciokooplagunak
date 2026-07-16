# ADR-0005 — Cobertura de línea/rama cortada deliberadamente en fase 3

- Estado: Aceptada
- Fecha: registrada 2026-07-16 (issue #88 / BASELINE)
- Fuentes: `docs/BASELINE.md`

## Contexto

El árbol es ~95 % código heredado de EmptyEpsilon que este fork no gobierna.
Medir cobertura global daría un número que no podemos ni debemos mover, e
invitaría a "mejorarlo" divergiendo de upstream.

## Decisión

No se mide cobertura de línea/rama en fase 3. Si algún día se mide, será solo
sobre el código propio: `bridge/` y `foundry-module/`.

## Consecuencias

- La calidad se vigila con las tres suites propias (CTest, pytest, node --test)
  más `luac -p`, todas como gates de CI — no con un porcentaje.
- Cualquier auditoría externa (p. ej. scorecard OpenSSF) debe leerse con esta
  decisión delante: el rojo sobre código upstream es esperado y aceptado.
