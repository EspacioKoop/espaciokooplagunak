# ADR-0013 — Frontera de licencias: procedencia obligatoria, mecánica sí / nombres no, y GPL-3.0 fuera de este árbol

- Estado: Aceptada
- Fecha: registrada 2026-08-26
- Issues relacionados: #332, #525, #590, #598, #676
- Fuentes: `foundry-module/scripts/procedencia-catalogo.mjs`,
  `catalogo-piezas.mjs`, `catalogo-cosmografico.mjs`;
  `docs/NPC_GENERADOR.md` §«La línea que no se cruza»;
  `docs/ECOSISTEMA_MODULOS_FOUNDRY.md` §«Regla de admisión» y §«Descartes
  razonados»; `LICENSE` (GPL-2.0).

## Contexto

La misma regla nació tres veces por separado: #590 (mallas con procedencia), #525
(atlas cosmográfico) y #676 (generador de NPC). #598 fue quien las unificó, al
detectar que el atlas y el catálogo de piezas estaban validando licencia cada uno
por su cuenta.

Dos validadores de licencia se desincronizan, y **una licencia desincronizada no
es un fallo de forma**: es material de terceros entrando por la puerta que no
miraba nadie.

Que la puerta tiene que ser código y no prosa tampoco es teórico. La primera
versión de la tabla de sílabas del generador llevaba `"Mar"`, y de ahí salían
*Maranmir* y *Marasai*, que empiezan por el nombre de un demonio de la escuela
SMT. Revisar la lista a ojo no lo habría visto.

## Alternativas consideradas

- **Un validador por catálogo.** Descartada: es el estado del que venimos, y se
  desincronizan.
- **Dejar la regla como párrafo de documentación.** Descartada: «un párrafo así
  dura hasta que alguien amplíe las tablas un martes por la tarde»
  (`docs/NPC_GENERADOR.md`).
- **Revisar las listas de nombres a ojo en la revisión de PR.** Descartada por
  contraejemplo medido: no habría visto *Maranmir*.
- **Adaptar código de `theripper93/enhancedcombathud` (Argon HUD).** Descartada,
  y no por estética: es GPL-3.0 y este árbol GPL-2.0. Son incompatibles.
- **TokenMagic FX** para los shaders. Descartada: no declara licencia, o sea
  todos los derechos reservados.

## Decisión

1. **Una sola regla de licencia para todo el módulo**:
   `foundry-module/scripts/procedencia-catalogo.mjs`, con errores tipados por
   `code` + `path`. La consumen el atlas (`catalogo-cosmografico.mjs`) y el
   catálogo de piezas (`catalogo-piezas.mjs`), y cualquier catálogo futuro la
   hereda en vez de escribir la suya.
2. **`naturaleza` es obligatoria** en una ficha de pieza —escaneo,
   escaneo-de-vaciado, fotogrametría, reconstrucción, obra propia— y **no es
   metadato**: es lo que impide que una cartela diga «así era» de una
   reconstrucción hecha después de que destruyeran el original, o que llame
   mármol a un vaciado en yeso. El crédito de la cartela se **deriva** de la
   procedencia, nunca se escribe al lado.
3. **De Shin Megami Tensei, Persona y Pokémon entra la MECÁNICA y ni un nombre**;
   de Argon HUD, solo la FORMA del dato; del **SRD 5.1 (CC-BY-4.0)** entra el
   texto, con atribución. Las mecánicas no se registran; los nombres y el arte
   sí.
4. **GPL-3.0 queda fuera de este árbol.** Con Argon HUD se **interopera por el
   formato del dato** —emitir la ficha en la forma que ese HUD consume— y no se
   copia, adapta ni traduce código suyo.
5. **La frontera vale también dentro de una dependencia aceptada**: de FXMaster
   (BSD-3) entran los filtros, que son shaders sin un solo asset, y **nunca** sus
   partículas, que traen sprites CC-BY-NC-SA y EULA de Rexard — un *non
   commercial* en un proyecto que quiere poder distribuirse es vía muerta.

### Regla de admisión de módulos ajenos

Va aquí y no en un ADR aparte, porque comparte fuente y comparte guarda:

> Una dependencia es admisible **solo si su ausencia degrada la presentación y
> nunca la autoridad.**

El módulo no declara hoy ninguna dependencia dura, y `module.json` no declara
siquiera como `recommends` la relación con plutonium/5etools (#332): declararla
convertiría en recomendación del proyecto una vía de importación de material con
copyright.

## Consecuencias

### Positivas

- Cualquier catálogo nuevo hereda validador; nadie escribe el suyo.
- Una cartela no puede afirmar más de lo que la pieza es.
- La copia de procedencia no se pudre en silencio: se compara con su origen.
- El proyecto conserva la opción de distribuirse.

### Negativas

- La puerta de nombres prohibidos es una lista, y una lista no puede ser
  exhaustiva: cubre lo que de verdad se cuela, no todo lo imaginable. Ampliarla
  suma, nunca sustituye.
- Hay una contraguarda que mantener: la puerta no puede acabar prohibiendo lo
  único que sí se puede usar (los tipos de daño del SRD).
- Interoperar con Argon por el dato es más trabajo que copiar su reparto.

## Implementación y evidencia

Guardas en CI (`.github/workflows/foundry-module.yml`):

- `foundry-module/tests/procedencia-catalogo.test.mjs` — forma de los errores
  (`code`/`path`), `PATRON_ID`, claves exactas.
- `foundry-module/tests/npc-tablas.test.mjs` — «ninguna cadena emitida contiene
  un término de las obras de referencia», que recorre tablas **y trescientas
  fichas generadas** contra la lista `PROHIBIDOS`; y la contraguarda «los tipos
  de daño del SRD sí pueden aparecer: es la capa importable».
- `foundry-module/tests/museo-escena.test.mjs` — «LA GUARDA DE PROCEDENCIA: lo
  que declara el museo no se separa de la ficha del conversor», contra las
  `FICHAS` de `tools/convertir-estatua.mjs`; y «la cartela del León dice que es
  una reconstrucción, no cómo era (#598)».
- `foundry-module/tests/manifiesto.test.mjs` — «el manifiesto NO declara
  dependencia de plutonium ni de 5etools (#332)».

## Criterios de revisión

Se revisa si el árbol cambia de licencia (haría admisible GPL-3.0 y cambiaría el
punto 4), o si aparece un catálogo cuyo material no encaje en las cinco
`naturaleza` declaradas — que es una ampliación del vocabulario, no una
excepción a la obligatoriedad.

---

## Referencias

- `docs/NPC_GENERADOR.md`, `docs/ECOSISTEMA_MODULOS_FOUNDRY.md`,
  `docs/CONTENIDO_EXTERNO.md`.
- SRD 5.1, CC-BY-4.0 — https://dnd.wizards.com/resources/systems-reference-document
- `theripper93/enhancedcombathud` (Argon HUD), GPL-3.0.
- FXMaster, BSD 3-Clause; sus partículas, licencias mixtas (JB2A CC-BY-NC-SA).
- Issues #332, #525, #590, #598, #676, #340.
