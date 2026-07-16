# ADR-0003 — Transporte del contrato v0: polling HTTP, WebSocket aplazado

- Estado: Aceptada
- Fecha: registrada 2026-07-16 (issue #6)
- Fuentes: `docs/FOUNDRY.md`, issue #6

## Contexto

El módulo Foundry necesita estado vivo del simulador. Las opciones eran polling
HTTP (simple, sin estado, compatible con el puente actual) o WebSocket (menor
latencia, más superficie y complejidad de conexión persistente).

## Decisión

El transporte del contrato v0 es polling HTTP (`GET /v1/state`, `GET
/v1/events`). WebSocket queda aplazado hasta que exista una necesidad de
latencia **medida**, no supuesta.

## Consecuencias

- El módulo interpola únicamente muestras confirmadas y nunca extrapola
  (`ventana-nave.mjs`), para que el polling no produzca movimiento inventado.
- La deduplicación de eventos se resuelve con `eventId` persistente en Journal.
- Si algún día se mide latencia insuficiente, este ADR se sustituye — con la
  medición como contexto.
