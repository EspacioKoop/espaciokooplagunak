# ADR-0012 — Atlas cosmográfico: nodo mínimo y referencia débil a `MapDocument`

- Estado: Aceptada
- Fecha: 2026-09-01
- Decisores: @VaroTv7, @eGurucharri
- Issue relacionado: #213
- PR relacionado: (este PR)
- Fuentes: `foundry-module/scripts/catalogo-cosmografico.mjs` (#525/#214),
  `foundry-module/scripts/procedencia-catalogo.mjs` (#598), ADR-0008, `docs/FOUNDRY.md`

## Contexto

El issue #213 pedía investigar un atlas de campaña compatible con Spelljammer:
planos, sistemas, mundos y sus relaciones. El vertical #214 ya entregó el
cimiento — un catálogo declarativo `plane → star_system → planet` con IDs
portables, continuidad (`original`/`homebrew`/`spelljammer-5e`/
`spelljammer-legacy`) y procedencia obligatoria por entrada, validado y probado
en `catalogo-cosmografico.mjs`. Ese módulo sigue deliberadamente sin
consumidor: cablearlo antes de tiempo habría promovido a hecho una decisión de
arquitectura que Varo y Eloy no habían cerrado.

Quedaba pendiente una pregunta concreta señalada en el propio hilo del issue:
qué significa que un nodo cosmográfico "referencie" un `MapDocument` táctico
(#54), y si esa referencia puede convertirse en una dependencia que rompa
cualquiera de los dos lados si el otro cambia o desaparece.

## Alternativas consideradas

- **Incrustar el `MapDocument` dentro del nodo cosmográfico.** Descartada: duplica
  datos tácticos dentro de un documento de campaña y obliga a mantenerlos
  sincronizados a mano; un mapa que cambia de forma invalidaría el atlas.
- **Que el atlas dependa de que el `MapDocument` exista para ser válido.**
  Descartada: un plano o sistema debe poder documentarse antes de que exista
  mapa jugable, y borrar un mapa viejo no debe invalidar retroactivamente la
  cosmografía que lo mencionaba.
- **Enlace débil por ID portable, opcional, sin validar contra el `MapDocument`
  real.** Elegida: mantiene ambos lados independientes y deja la resolución
  (¿existe ese mapa?, ¿qué hago si no?) al consumidor futuro, que es quien
  conoce el contexto de Foundry o del núcleo standalone.

## Decisión

1. La jerarquía del atlas se mantiene en `plane → star_system → planet` (v1);
   ampliarla (`moon`, `enclave`, `anomaly`, `portal`, `route`...) espera a que
   exista un consumidor real, no se añade especulativamente.
2. Un nodo cosmográfico puede declarar `map_ref`: un campo opcional de texto
   con el mismo patrón de ID portable que el resto del catálogo. Es un enlace
   **débil**: solo un identificador, nunca el documento incrustado ni una
   copia de sus datos.
3. El validador no comprueba que ese `MapDocument` exista — no tiene acceso a
   Foundry ni a la simulación, y no debería tenerlo. La resolución de
   `map_ref` contra un mapa real es responsabilidad de quien consuma el
   catálogo (proyección Foundry o adaptador del núcleo), fuera de este módulo.
4. Autoridad de campaña (atlas, progreso, consecuencias) sigue siendo del
   núcleo, sin cambios respecto a ADR-0008. Foundry, si consume este catálogo,
   lo hace como proyección opcional — nunca como fuente.
5. No se introduce contenido oficial de Spelljammer con esta decisión: la
   matriz de procedencia/licencias sigue siendo condición previa e
   independiente, y el ejemplo distribuido (`data/cosmografia.example.json`)
   sigue siendo enteramente original.

## Consecuencias

### Positivas

- Un nodo cosmográfico puede existir sin mapa jugable, y un `MapDocument`
  puede seguir existiendo o borrarse sin invalidar la cosmografía que lo
  mencionaba.
- Ninguna de las dos piezas necesita conocer la forma interna de la otra: el
  atlas no importa nada de `MapDocument` ni al revés.
- El campo es opcional y de forma cerrada (mismo patrón de ID que el resto del
  catálogo), así que no abre una vía nueva de payload ejecutable ni de datos
  sin tipar.

### Negativas

- `map_ref` puede apuntar a un mapa que nunca llegue a existir, o dejar de
  apuntar a nada si el mapa se borra; el catálogo no lo detecta por diseño.
  Cualquier UI que lo use debe tratar una referencia rota como dato normal
  ("todavía sin mapa"), no como error de validación.
- Sigue sin haber consumidor de `catalogo-cosmografico.mjs`: esta decisión fija
  el contrato, no lo cablea. `HUERFANOS_DECLARADOS` se mantiene sin tocar.

## Implementación y evidencia

- `foundry-module/scripts/catalogo-cosmografico.mjs`: campo `map_ref` opcional,
  validado como ID portable, documentado en la cabecera del módulo.
- `foundry-module/tests/catalogo-cosmografico.test.mjs`: prueba de aceptación
  con y sin `map_ref`, y de rechazo con un ID mal formado.
- No se ha tocado `MapDocument`, el puente, `main.mjs` ni el editor C++.

## Criterios de revisión

Esta decisión debería revisarse si:

- Aparece un consumidor real (Foundry o núcleo) que necesite resolver
  `map_ref` contra mapas concretos — en ese momento se decide dónde vive esa
  resolución, no en este módulo puro.
- Se añade persistencia de campaña (#766) y hace falta decidir si el atlas
  estático y el estado de campaña conviven en el mismo documento o en dos.

---

## Referencias

- Issue #213 y su hilo de discusión (arquitectura de autoridad, procedencia).
- #214 / #525 — cimiento del catálogo cosmográfico.
- #598 — regla única de procedencia (`procedencia-catalogo.mjs`).
- #54 — `MapDocument` táctico.
- ADR-0008 — standalone-first, autoridad del núcleo.
