# Registro de decisiones de arquitectura (ADR)

Este directorio contiene las decisiones arquitectónicas de Espaciokoop
Lagunak. Las propuestas se discuten primero en issues; cada ADR registra una
decisión tomada y verificada en `main`.

## Proceso y convenciones

1. Abrir un issue con el contexto y las alternativas.
2. Copiar `0000-template.md` como `NNNN-titulo-corto-en-kebab-case.md`.
3. Completarlo y enviarlo como PR.
4. Tras su aceptación, no editar el ADR: crear otro que lo sustituya si cambia
   la decisión.

Estados: **Propuesta** · **Aceptada** · **Sustituida por ADR-NNNN** ·
**Deprecada**.

## Índice

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
| [0009](0009-modelo-permisos-por-puesto-v1.md) | Modelo de permisos por puesto v1 | Aceptada |
| [0010](0010-hackeo-solo-nativo.md) | El hackeo se queda solo-nativo | Aceptada |
| [0011](0011-riesgos-de-seguridad-y-defensa-en-profundidad.md) | Riesgos de seguridad del fork y defensa en profundidad | Propuesta |
