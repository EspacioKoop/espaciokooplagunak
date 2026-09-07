# Registro de decisiones de arquitectura (ADR)

Formato [MADR](https://adr.github.io/madr/) simplificado. Los issues actúan como
RFC y contrato de alcance; el PR conserva el registro de implementación y
verificación. Un ADR en estado **Propuesta** puede registrar una candidata aún
abierta, pero solo **Aceptada** identifica una decisión explícita y verificada
en `main`.

## Proceso y convenciones

1. Abrir un issue con el contexto, las alternativas y la evidencia esperada.
2. Reservar el entero siguiente al mayor del índice —sin reutilizar huecos— y
   copiar `0000-template.md` como `NNNN-titulo-corto-en-kebab-case.md`. El
   número `0000` queda reservado para la plantilla.
3. Completar el ADR como **Propuesta**, enlazar issue y PR, y someterlo a
   revisión. Fusionar el documento no lo convierte por sí solo en
   **Aceptada**: hace falta una decisión humana explícita y evidencia
   verificable en el mismo PR o en uno anterior.
4. Una vez **Aceptada**, no reescribir su contexto, decisión ni consecuencias.
   Si cambia, crear otro ADR y actualizar únicamente el estado y el enlace de
   sustitución del original.

Estados: **Propuesta** · **Aceptada** · **Sustituida por ADR-NNNN** ·
**Deprecada**.

## Índice

El inventario legible por máquina está en [`index.json`](index.json) y se valida
con [`index.schema.json`](index.schema.json).

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
| [0010](0010-hackeo-solo-nativo.md) | El hackeo se queda solo-nativo: no se expone a Lua ni al puente | Aceptada |
| [0011](0011-riesgos-de-seguridad-y-defensa-en-profundidad.md) | Riesgos de seguridad del fork y defensa en profundidad | Propuesta |
| [0012](0012-que-puede-hacer-una-escena-de-foundry.md) | Qué puede hacer una escena de Foundry: enseñar, transportar y ambientar; nunca conceder, contar ni recordar | Aceptada |
| [0013](0013-frontera-de-licencias-y-procedencia.md) | Frontera de licencias: procedencia obligatoria, mecánica sí / nombres no, y GPL-3.0 fuera de este árbol | Aceptada |
| [0014](0014-doctrina-de-arte-procedural.md) | Doctrina de arte: procedural en cliente, cero binarios, un solo sitio para el color | Aceptada |
| [0015](0015-dato-derivado-se-copia-y-se-compara.md) | El dato derivado se copia de su fuente autoritativa, y una prueba lo compara con ella | Aceptada |
