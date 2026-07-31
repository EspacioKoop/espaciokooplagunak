# ADR-0008 — Standalone-first: la autoridad de campaña vive en el núcleo

- Estado: Aceptada
- Fecha: registrada 2026-07-30 (dirección de producto, issue #219)
- Fuentes: `docs/ROADMAP_PRODUCTO.md`, `docs/FOUNDRY.md`, `docs/ARQUITECTURA.md`
- Sustituye a: [ADR-0002](0002-autoridad-de-datos-foundry-vs-simulacion.md)

## Contexto

ADR-0002 repartió la autoridad entre Foundry (narrativa de campaña) y la
simulación (estado de la nave). Ese reparto asumía que toda partida ocurre en una
mesa con Foundry. La dirección de producto acordada en #219 es otra: el juego
debe ser jugable, guardable y reanudable **sin Foundry**, que pasa a ser una
integración opcional para las campañas de rol del grupo.

Con ADR-0002 vigente, la campaña sin Foundry no tendría autoridad para nada:
destino, atlas, progreso y consecuencias serían inaccesibles.

## Decisión

La autoridad de campaña —progreso, personajes, atlas, misiones y consecuencias—
pertenece al núcleo de Espaciokoop Lagunak. La simulación conserva la autoridad
sobre el estado operativo de la nave, sin cambios respecto a ADR-0002.

Foundry deja de ser autoritativo: el puente le **proyecta** un subconjunto
versionado del estado y acepta de vuelta órdenes cerradas y contexto narrativo.
Ninguna funcionalidad nueva puede depender de documentos, packs o APIs de Foundry
para ser jugable. Los formatos de persistencia del núcleo son propios.

Se mantiene sin cambios el resto de ADR-0002: nadie escribe directamente en el
estado ajeno, el contrato es limitado y versionado, y las consecuencias que se
exportan a Journal llevan `eventId` idempotente.

## Consecuencias

- Toda propuesta responde primero a «¿sigue siendo jugable si Foundry
  desaparece?»; si no, la responsabilidad es del núcleo.
- El núcleo necesita su propia persistencia de campaña y su propio atlas; #213 y
  #214 quedan como catálogo e integración opcionales, no como fuente.
- El módulo Foundry puede desactivarse sin perder la campaña. Su superficie es
  proyección y adaptación, no almacenamiento.
- Se sigue rechazando embeber Foundry en el juego o replicar la nave en Foundry.
- Divergir de EmptyEpsilon es aceptable cuando aporte mejora tangible, siguiendo
  `docs/UPSTREAM.md` y con ADR propio.
