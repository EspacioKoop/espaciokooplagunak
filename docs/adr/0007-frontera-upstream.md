# ADR-0007 — Frontera upstream: arreglos en código heredado van primero a upstream

- Estado: Aceptada
- Fecha: registrada 2026-07-16
- Fuentes: `docs/UPSTREAM.md`, `docs/BASELINE.md` (regla 4), CLAUDE.md

## Contexto

Cada línea que este fork cambia en `src/` heredado es un coste permanente en
cada sincronización con EmptyEpsilon (merge tax). Las buenas prácticas propias
(seguridad, accesibilidad, calidad) podrían usarse como excusa para divergir.

## Decisión

Ninguna práctica del baseline justifica por sí sola divergir del código
heredado. Si el arreglo correcto está en `src/` heredado, primero se propone
como PR a upstream (`daid/EmptyEpsilon`). La sincronización se hace en rama
dedicada `upstream/AAAA-MM-DD` con `git merge --no-ff upstream/master`, nunca
mezclada con funcionalidades propias, siempre por PR.

## Consecuencias

- Las divergencias permanentes existentes quedan enumeradas y vigiladas
  (hoy: `script_docs/` — ADR-0006 — y las piezas propias del fork).
- La accesibilidad del juego C++ heredado solo se aborda si un jugador real
  choca con la barrera y no puede resolverse en módulo/doc (fase 4).
