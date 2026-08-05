# Registro de decisiones de arquitectura (ADR)

Formato [MADR](https://adr.github.io/madr/) simplificado. Cada ADR registra una
decisión ya tomada y verificada en `main` — este directorio no es un buzón de
propuestas (para eso están los issues, que actúan como RFC del fork: el issue
es el contrato de alcance, el PR el registro de implementación).

Estados: **Aceptada** · **Sustituida por ADR-XXXX** · **Deprecada**.

| ADR | Título | Estado |
|---|---|---|
| [0001](0001-exec-lua-nunca-expuesto.md) | `/exec.lua` nunca expuesto; el puente es el único cliente | Aceptada |
| [0002](0002-autoridad-de-datos-foundry-vs-simulacion.md) | Autoridad de datos: Foundry = narrativa, simulación = nave | Sustituida por ADR-0008 |
| [0003](0003-transporte-polling-http.md) | Transporte del contrato v0: polling HTTP, WebSocket aplazado | Aceptada |
| [0004](0004-seriousproton-hermano-fijado-por-sha.md) | SeriousProton como repo hermano fijado por SHA (no submódulo) | Aceptada |
| [0005](0005-cobertura-cortada-en-fase-3.md) | Cobertura de línea/rama cortada deliberadamente en fase 3 | Aceptada |
| [0006](0006-vendorizar-highlight-js.md) | Vendorizar highlight.js en `script_docs/` (CodeQL 8/9) | Aceptada |
| [0007](0007-frontera-upstream.md) | Frontera upstream: arreglos en código heredado van primero a upstream | Aceptada |
| [0008](0008-standalone-first-autoridad-del-nucleo.md) | Standalone-first: la autoridad de campaña vive en el núcleo | Aceptada |
| [0009](0009-modelo-permisos-por-puesto-v1.md) | Modelo de permisos por puesto v1: formaliza sin migrar, no unifica con el motor nativo | Aceptada |
