# ADR-0002 — Autoridad de datos: Foundry = narrativa, simulación = nave

- Estado: Sustituida por [ADR-0008](0008-standalone-first-autoridad-del-nucleo.md)
- Fecha: registrada 2026-07-16 (diseño de fase 3)
- Fuentes: `docs/FOUNDRY.md`, `docs/ARQUITECTURA.md`

## Contexto

> Sustituida: la autoridad de campaña ya no es de Foundry sino del núcleo
> (standalone-first, ADR-0008). El reparto de autoridad sobre el estado de la
> nave y el contrato entre sistemas siguen vigentes.

Dos sistemas con estado propio deben convivir en una misma campaña: Foundry VTT
(personajes, diarios, escenas) y el simulador (posición, sistemas, daños). Sin
una autoridad clara por dominio aparecen conflictos de sincronización y dobles
fuentes de verdad.

## Decisión

Foundry es autoritativo para la narrativa de campaña; el simulador es
autoritativo para el estado operativo de la nave. El puente traduce entre ambos
con una API limitada y versionada (contrato v0). Ningún dominio escribe
directamente en el estado del otro: el módulo Foundry lee estado/eventos y
envía órdenes cerradas; las consecuencias persistentes vuelven a Foundry como
anotaciones (Journal) con `eventId` idempotente.

## Consecuencias

- Se rechaza explícitamente embeber Foundry en el juego o replicar la nave en
  Foundry: cada superficie sirve a su público (tripulación vs. mesa/GM).
- Cada dato nuevo debe declarar dominio y autoridad antes de implementarse.
