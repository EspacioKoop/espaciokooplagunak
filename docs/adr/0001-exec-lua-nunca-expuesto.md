# ADR-0001 — `/exec.lua` nunca expuesto; el puente es el único cliente

- Estado: Aceptada
- Fecha: registrada 2026-07-16 (decisión vigente desde fase 2)
- Fuentes: `SECURITY.md`, `docs/FOUNDRY.md`, job `guardia-exec-lua` en `docker.yml`

## Contexto

El endpoint HTTP heredado `/exec.lua` (`src/httpScriptAccess.cpp`) ejecuta Lua
arbitrario recibido por red: es ejecución remota de código por diseño. La
integración con Foundry necesita leer estado y enviar órdenes al juego.

## Decisión

El puerto 8080 del juego no se publica jamás al host, a una LAN no confiable ni
a Internet. El puente (`bridge/`, FastAPI) es la única pieza autorizada a hablar
con `/exec.lua`, por la red interna de compose, y solo con plantillas Lua
definidas en el propio puente (lista blanca de órdenes, auth Bearer, CORS
estricto, rate limit). La regla es un gate de CI, no una convención: el job
`guardia-exec-lua` falla si `compose.yaml` publica el 8080 o usa
`network_mode: host`, y prueba ambas regresiones.

## Consecuencias

- Toda capacidad nueva expuesta a Foundry exige tocar el puente y sus tests
  (suite pytest, incl. adversariales de auth/rate-limit) — fricción deliberada.
- No hay atajo "temporal" posible: la CI lo bloquea.
- `/get.lua` y `/set.lua` (incompletos en upstream) quedan igualmente fuera.
