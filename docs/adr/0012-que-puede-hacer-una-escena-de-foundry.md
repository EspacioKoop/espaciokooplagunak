# ADR-0012 — Qué puede hacer una escena de Foundry: enseñar, transportar y ambientar; nunca conceder, contar ni recordar

- Estado: Aceptada
- Fecha: registrada 2026-08-26
- Issues relacionados: #587 (playa), #598 (museo), #213 (atlas, pendiente)
- ADR padre: [ADR-0008](0008-standalone-first-autoridad-del-nucleo.md)
- Fuentes: `docs/FOUNDRY.md` §«Qué puede hacer una escena de Foundry, y qué no»
  (el enunciado literal); `foundry-module/scripts/museo-escena.mjs`,
  `museo-piezas.mjs`, `escena-exteriores.mjs`; `docs/NPC_GENERADOR.md`
  (aplica el mismo reparto a «recordar a quién has conocido»).

## Contexto

Los exteriores (#587, y los que vengan por el kit de escenas de #589) plantearon
una duda razonable sobre ADR-0008: si el módulo se inventa una playa entera que
el núcleo no conoce, ¿sigue siendo cierto que la partida es jugable sin Foundry?

La respuesta reformuló la pregunta. Lo que decide **no es dónde vive la escena,
sino si la escena concede algo**. ADR-0008 nunca dijo que Foundry no pueda
pintar: dijo que la autoridad de campaña —progreso, atlas, misiones,
consecuencias— es del núcleo, y que el módulo es proyección y adaptación, no
almacenamiento.

#598 (el museo) fue la primera aplicación con contenido real y no con un banco de
pruebas, que es donde la regla tenía que aguantar: tres piezas con cartela, y la
tentación evidente de marcar cuáles has visto.

## Alternativas consideradas

- **Prohibir escenas propias que el núcleo no respalde.** Descartada: mataría
  playa y museo sin ganar nada, precisamente porque no conceden.
- **Dejar que la escena guarde su progreso «provisional» en flags de Foundry.**
  Descartada: es exactamente el almacenamiento que ADR-0008 le niega al módulo, y
  se queda mintiendo cuando cae el puente — el mismo fallo que #354 evitó al no
  espejar la posición en un token persistente.
- **Diseñar ya dónde se guarda un pez o un avistamiento.** Descartada por
  prematura: es worldbuilding antes de que exista la pesca. Tener escrito que
  **no** se guarda en Foundry no lo es.

## Decisión

> Una escena de Foundry puede **enseñar, transportar y ambientar**. No puede
> **conceder, contar ni recordar**.

Alcance y corolarios, todos ya aplicados:

1. **Transportar es mover la cámara**, y nada más. La salida del museo devuelve
   a la nave y es lo único que transporta en toda la sala.
2. **El museo enseña y ya está.** La cartela se pinta al acercarse y se retira al
   apartarse; no marca piezas como vistas, no lleva cuenta ni deja rastro.
3. **Los planetas del cielo de la playa son cielo, no atlas.** Ningún punto de
   interacción los nombra ni los cruza con el catálogo cosmográfico: en cuanto lo
   hicieran, pasarían a afirmar cosmografía que nadie ha decidido.
4. **El día que un exterior conceda algo, ese estado es del núcleo y la escena
   solo pinta el efecto** — el mismo reparto que ya sigue la asistencia entre
   puestos (#309), que no emite órdenes sino un token que gasta su titular.
5. **Lo que recuerda queda fuera hasta que el núcleo tenga dónde guardarlo.** El
   bestiario de #598 y el «a quién has conocido» de #676 están parados por esto,
   y están parados a propósito.

## Consecuencias

### Positivas

- Toda superficie andable nueva nace con la pregunta hecha, en vez de discutirse
  por PR una vez escrita.
- El museo costó la mitad de lo que parecía: sin estado no hay migración, ni
  reconciliación con el puente, ni qué pasa si dos clientes discrepan.
- La regla es corta y citable. Antes vivía en prosa dentro de un documento de
  diseño de novecientas líneas.

### Negativas

- Hay deuda explícita y nombrada que solo se cierra por el lado del núcleo
  (bestiario, atlas de #213). Se acepta: la alternativa era cerrarla en el sitio
  equivocado.
- Una mesa que quiera que su escena «recuerde» algo hoy no puede, aunque le
  bastara con un flag. Esa comodidad es justo la que se está negando.

## Implementación y evidencia

Guarda en CI (`.github/workflows/foundry-module.yml`, que ejecuta
`node --test foundry-module/tests/*.test.mjs`):

- `foundry-module/tests/museo-escena.test.mjs` — «la salida devuelve a la nave, y
  es lo único que transporta en toda la sala» y «NADA en la sala concede, cuenta
  ni recuerda (docs/FOUNDRY.md)», que cita este mismo documento por su nombre.
- `foundry-module/tests/museo-escena.test.mjs` — «la cartela del León dice que es
  una reconstrucción, no cómo era (#598)»: enseñar tampoco es afirmar de más.

## Criterios de revisión

Deja de valer el día que el núcleo tenga almacén de campaña (#213 o su
sucesor). Entonces esto no se relaja: se **completa** con un ADR nuevo que diga
por dónde entra una concesión desde una escena — que seguirá sin ser un flag de
Foundry.

---

## Referencias

- `docs/FOUNDRY.md` — «Qué puede hacer una escena de Foundry, y qué no».
- [ADR-0008](0008-standalone-first-autoridad-del-nucleo.md) — standalone-first.
- Issues #587, #589, #598, #213, #354, #309.
