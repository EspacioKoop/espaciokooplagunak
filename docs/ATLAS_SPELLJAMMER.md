# Investigación — Atlas Spelljammer de planos, sistemas y mundos

> Entregable #1 del issue #213: documento de investigación y matriz de
> procedencia/licencia. **No es un ADR**: los ADR de `docs/adr/` registran
> decisiones ya verificadas en `main`; esta es la investigación previa que
> alimenta la decisión que Varo y Eloy acordarán en el issue. La preferencia
> arquitectónica de aquí queda **a validar**, no adoptada.

## Frontera de producto

Este documento investiga una integración/catálogo **opcional** para Foundry. El
futuro juego standalone mantendrá su propio modelo autoritativo de campaña y
atlas; Foundry no será requisito ni única fuente de datos. Cualquier formato
definido aquí debe poder proyectarse desde/hacia el núcleo sin convertirlo en
dependencia. Coherente con [ADR-0008](adr/0008-standalone-first-autoridad-del-nucleo.md)
(standalone-first: la campaña y el atlas son del núcleo; sustituye a ADR-0002) y
[ADR-0007](adr/0007-frontera-upstream.md) (frontera upstream).

## Estado ya integrado: cosmografía v1 en Foundry (#214)

**Antes de proponer nada, este es el punto de partida real.** El PR #214 ya
publicó y validó en `main` el **primer vertical cosmográfico vivo** del módulo
Foundry: el formato `espaciokoop-cosmography` **v1**, con validador y tests
([`foundry-module/scripts/catalogo-cosmografico.mjs`](../foundry-module/scripts/catalogo-cosmografico.mjs),
ejemplo en [`foundry-module/data/cosmografia.example.json`](../foundry-module/data/cosmografia.example.json)).
No es futuro ni pendiente: es contrato integrado. Su forma real:

- Documento plano `{ "format": "espaciokoop-cosmography", "version": 1, "entries": [...] }`.
- Cada entrada tiene `type` ∈ `plane | star_system | planet` y referencia a su
  padre por **`parent_id`** (jerarquía por referencias, no por anidamiento).
  El validador exige `plane` sin padre, `star_system`→`plane`, `planet`→`star_system`.
- Nombres y resúmenes **localizados en línea** con `name.{es,en}` y
  `summary.{es,en}` (texto plano validado, sin controles ni etiquetas) —
  **no** claves i18n externas.
- `continuity` ∈ `original | homebrew | spelljammer-5e | spelljammer-legacy`.
- `provenance` = objeto `{ kind, source, license, source_url? }` con
  `kind` ∈ **`original | cc | user_supplied`**; `cc` obliga a `source_url` HTTPS.
- Límites: IDs `^[a-z0-9][a-z0-9_-]{0,63}$`, ≤2000 entradas, ≤1 MiB serializado,
  IDs únicos y referencias resueltas.

Todo lo que este documento explore como "modelo" es, por tanto, o bien una
**evolución de v1**, o bien un **formato distinto del núcleo standalone** que
debe declarar su correspondencia con v1 — nunca un primer validador aún por
escribir. La sección [«Modelo propuesto»](#modelo-propuesto-para-el-núcleo-standalone-evolución-sobre-v1)
mapea explícitamente ambos.

## Guardia legal y categorías de entrada

Esta es una política conservadora del repositorio, no asesoramiento jurídico:

- **No** descargar, extraer ni automatizar la lectura de PDFs, D&D Beyond o
  libros oficiales para construir el atlas.
- **No** copiar descripciones, estadísticas, tablas, mapas, ilustraciones ni
  otros datos expresivos de fuentes cerradas al repositorio público.
- Una ficha comercial, un índice público o una compra acreditan la edición y el
  localizador; **no** conceden por sí solos permiso de redistribución.
- Solo se versiona material cuyo permiso cubra **esa entrada concreta**. «Está
  en el SRD» exige localizarlo dentro del SRD: que una mecánica sea de D&D o que
  una web sea accesible no basta.
- No se declaran equivalentes entre 5e y legado. Dos entradas de distinta
  continuidad pueden relacionarse solo como referencias separadas y con
  evidencia para cada una.

| Categoría | Condición para entrar en el catálogo público | Destino si no la cumple |
|---|---|---|
| `cc` / SRD | El dato exacto está cubierto por una licencia identificada; se conserva fuente, versión, URL, atribución y cambios | No se importa |
| Oficial sin licencia abierta identificada | Ninguna entrada de atlas se transcribe; solo se versionan esquema, adaptador y referencia bibliográfica | La mesa introduce localmente los datos desde su copia legítima |
| Original del fork | Autoría declarada y licencia compatible con el repositorio | No se publica hasta aclarar autoría/licencia |
| Aportado por una mesa | Privado por defecto; solo pasa a público mediante contribución expresa de su autor con licencia compatible | Mundo Foundry o export privado, `provenance.kind: "user_supplied"` |
| Obra de fans o de terceros | Licencia/autorización individual verificable; la política de fans de WotC no sustituye el permiso del autor | No se importa ni se presenta como canon |

**Separación operativa:** el repositorio distribuye el contrato y únicamente
entradas originales o licenciadas. El contenido oficial cerrado y el contenido
privado de cada mesa no se convierten en fixtures, compendios ni catálogos del
proyecto. D&D Beyond puede ser un localizador consultado por una persona, nunca
una fuente que el importador raspe.

## Opciones de arquitectura evaluadas

Se comparan las tres opciones que pide el issue.

### Opción 1 — Ampliar el `MapDocument` táctico

Extender la estructura de [`src/content/mapDocument.h`](../src/content/mapDocument.h)
(hoy `MapObject` con `kind` asteroide/nebulosa/`Unsupported` y `opaque_json`
preservado pero nunca ejecutado) para que también describa jerarquía de
campaña.

- **A favor:** una sola estructura; reutiliza el adaptador allowlist y el
  staging ya existentes (#204/#208).
- **En contra:** mezcla dos escalas incompatibles —táctica (posiciones dentro de
  un sistema) y de campaña (planos→sistemas→cuerpos)— en un documento pensado
  para el mundo operativo. Rompe la separación que #204 mantiene y contamina el
  `MapDocument` con lore. **Descartada como base.**

### Opción 2 — Documento jerárquico separado (`CampaignAtlasDocument`)

Un documento propio, independiente del `MapDocument`, que modela la jerarquía y
**referencia** mapas tácticos por ID sin absorberlos.

- **A favor:** separa escalas; el atlas referencia `MapDocument`s sin
  interpretarlos; encaja con la lógica pura ya presente en
  [`src/content/campaignGraph.h`](../src/content/campaignGraph.h)
  (grafo de campaña *pure data in / pure data out*, sin GUI ni ECS). Permite
  importación/exportación JSON declarativa y validación con límites.
- **En contra:** otra estructura a mantener y versionar; exige codec y validador
  nuevos.

### Opción 3 — Atlas como Documents/Journal/Scene nativos de Foundry

Mantener el atlas íntegramente en Foundry (Journal/Scene) y enviar a Espaciokoop
solo el sistema/mapa **operativo activo**.

- **A favor:** cero formato nuevo en el repo; ~~Foundry ya es autoritativo del
  lore (ADR-0002)~~ *(argumento caducado: [ADR-0008](adr/0008-standalone-first-autoridad-del-nucleo.md)
  sustituye a ADR-0002 y devuelve el atlas al núcleo)*; nada de lore ni código
  viaja al puente.
- **En contra:** sin esquema propio no hay validación, round-trip ni portabilidad
  hacia el futuro juego standalone; el atlas quedaría atado a Foundry, violando
  la frontera de producto.

### Preferencia inicial (a validar en el issue)

**Híbrido 2 + 3, con la 2 como formato canónico:** un
`CampaignAtlasDocument` jerárquico separado como **formato de intercambio
versionado y validable** (portable al juego standalone), mientras Foundry sigue
siendo la **autoridad de edición y presentación** del lore y solo el
sistema/mapa operativo activo cruza el puente. El decorado cosmético de #203 se
mantiene **fuera**: es decoración de render, no datos de campaña.

Esto conserva las tres invariantes: no rompe `MapDocument` (#204), respeta
ADR-0002 (Foundry autoritativo de narrativa) y no envía lore ni código al puente.

> **Sustituido por [ADR-0008](adr/0008-standalone-first-autoridad-del-nucleo.md).**
> La preferencia de arriba se escribió bajo ADR-0002, cuando Foundry era
> autoritativo del lore. Con el rumbo standalone-first, **el atlas es del
> núcleo**: la campaña tiene que poder consultarse y avanzar sin Foundry, así
> que la opción 3 queda descartada como fuente y el formato propio deja de ser
> «de intercambio» para ser el canónico. Foundry conserva lo que aporta de
> verdad —una superficie de edición y presentación cómoda— pero como proyección.
> El texto anterior se mantiene porque explica de dónde viene la decisión; lo
> que ya no vale es su conclusión sobre la autoridad.

**Nota de estado:** #214 ya materializó un **primer corte** de esta preferencia —
un documento cosmográfico separado, jerárquico, versionado y validable
(`espaciokoop-cosmography` v1)— pero **en el módulo Foundry (JS)**, no como
`CampaignAtlasDocument` en C++. v1 es el **primer vertical ya integrado** (evidencia,
no decisión cerrada): la elección arquitectónica para el standalone sigue abierta a
acuerdo entre Varo y Eloy. Las preguntas vivas son dónde reside el validador canónico
a largo plazo (JS del módulo vs. `content/` C++ para el standalone) y qué capas añade v2+.

## Modelo propuesto para el núcleo standalone (evolución sobre v1)

> **Relación con lo integrado.** Lo de abajo **no** sustituye ni precede a
> `espaciokoop-cosmography` v1 (#214, ya en `main`): es la exploración de un
> formato **más rico** para el futuro núcleo standalone —añade `enclave`, rutas,
> `tacticalMapId` y metadatos opacos— que hoy v1 no cubre. Si se adopta, será una
> **versión posterior** (v2+) del mismo contrato o un formato del núcleo con
> proyección declarada hacia v1, nunca un "primer validador" a estrenar. La tabla
> de correspondencia fija esa continuidad.

### Correspondencia con el v1 integrado

| Concepto del borrador | Equivalente en v1 (#214) | Naturaleza del cambio |
|---|---|---|
| `regions/systems/bodies` anidados | `entries[]` planas con `parent_id` | **v1 ya decide esto**: el borrador debe migrar a referencias planas, no reintroducir anidamiento |
| `region → system → body` | `plane → star_system → planet` | Renombrar a los tipos ya validados de v1 |
| `nameKey` (clave i18n) | `name.{es,en}` en línea | **v1 ya decide esto**: texto localizado en el documento, no claves externas |
| `provenance: original / srd / private` | `provenance.kind: original / cc / user_supplied` | Alinear al enum de v1; `private` se modela fuera del catálogo público (no como valor exportable) |
| `license` (string suelto) | `provenance.license` (+ `source_url` HTTPS si `cc`) | Ya cubierto por v1 |
| `enclave`, `route`, `tacticalMapId`, `meta` | **no existen en v1** | Genuinamente nuevo: son la propuesta de evolución v2+ |
| `atlasVersion` entero | `version: 1` | Mismo mecanismo de versión; el validador rechaza versiones desconocidas |

Solo las últimas dos filas son trabajo nuevo; el resto ya está resuelto por v1 y
el borrador se reescribe para heredarlo.

Jerarquía `plano → sistema → cuerpo → enclave`. Las tres primeras capas ya son
v1; lo que sigue marca **qué hereda de v1** y **qué añade** la evolución:

- *(hereda de v1)* **IDs estables** por entrada, jerarquía por `parent_id` y
  **nombres localizados en línea** con `name.{es,en}` — no claves i18n externas.
- *(hereda de v1)* **Procedencia y continuidad por entrada**
  (`provenance.kind` ∈ `original / cc / user_supplied`, `continuity` ∈
  `original / homebrew / spelljammer-5e / spelljammer-legacy`), sin declarar
  equivalencias entre ediciones sin fuente.
- *(nuevo v2+)* **Cuarta capa `enclave`** bajo `planet`.
- *(nuevo v2+)* **Coordenadas/rutas opcionales**, sin inventar escalas canónicas
  (unidad declarada por la mesa; ausencia ≠ origen).
- *(nuevo v2+)* **Enlace opcional** a un `MapDocument` táctico por `tacticalMapId`.
- *(nuevo v2+)* **Metadatos extensibles** preservados sin ejecución de código
  (equivalente al `opaque_json` de `MapObject`: se conserva, nunca se interpreta).
- *(hereda de v1)* **Import/export JSON declarativo, versionado**, con límites y
  validación; **separación** entre catálogo redistribuible y datos privados de
  campaña (los datos privados quedan fuera del catálogo público, no como valor
  exportable).

### Borrador de esquema de la evolución v2+ (a validar — no comprometido aún)

Escrito ya sobre la base plana de v1 (`entries[]` + `parent_id`, `name.{es,en}`),
añadiendo solo las capas nuevas. **No** es un formato paralelo ni un validador por
estrenar: es v1 (#214) más `enclave`/`route`/`tacticalMapId`/`meta`.

```jsonc
{
  "format": "espaciokoop-cosmography",
  "version": 2,                      // evoluciona el v1 ya integrado; el validador rechaza versiones desconocidas
  "entries": [
    {
      "id": "region-marea-de-brasas",
      "type": "plane",
      "name": { "es": "Marea de Brasas", "en": "Ember Tide" }, // texto localizado en línea (v1)
      "summary": { "es": "Región de rescoldos a la deriva.", "en": "Region of drifting embers." }, // obligatorio (v1)
      "continuity": "original",
      "provenance": { "kind": "original", "source": "Espaciokoop Lagunak", "license": "GPL-2.0-only" }
    },
    {
      "id": "sistema-yunque-roto",
      "type": "star_system",
      "parent_id": "region-marea-de-brasas",              // jerarquía por referencia (v1)
      "name": { "es": "Yunque Roto", "en": "Broken Anvil" },
      "summary": { "es": "Sistema forjado en torno a una estrella partida.", "en": "System forged around a split star." },
      "route": { "unit": "mesa-definida", "coords": [0, 0] }, // NUEVO v2: opcional
      "continuity": "original",
      "provenance": { "kind": "original", "source": "Espaciokoop Lagunak", "license": "GPL-2.0-only" }
    },
    {
      "id": "cuerpo-forja-errante",
      "type": "planet",
      "parent_id": "sistema-yunque-roto",
      "name": { "es": "Forja Errante", "en": "Wandering Forge" },
      "summary": { "es": "Planeta-taller que vaga por el sistema.", "en": "Workshop-planet that roams the system." },
      "tacticalMapId": null,                                // NUEVO v2: enlace opcional a un MapDocument
      "meta": {},                                           // NUEVO v2: preservado, nunca ejecutado
      "continuity": "original",
      "provenance": { "kind": "original", "source": "Espaciokoop Lagunak", "license": "GPL-2.0-only" }
    },
    {
      "id": "enclave-puerto-ceniza",
      "type": "enclave",                                    // NUEVO v2: cuarta capa
      "parent_id": "cuerpo-forja-errante",
      "name": { "es": "Puerto Ceniza", "en": "Ash Harbor" },
      "summary": { "es": "Enclave comercial sobre la Forja Errante.", "en": "Trade enclave atop the Wandering Forge." },
      "continuity": "original",
      "provenance": { "kind": "original", "source": "Espaciokoop Lagunak", "license": "GPL-2.0-only" }
    }
  ]
}
```

> El primer borrador de este documento proponía un esquema anidado (`regions/
> systems/bodies`) con claves `nameKey` — **descartado** al integrarse v1 (#214),
> que fijó la base plana con `parent_id` y texto localizado en línea. Se conserva
> solo la memoria del descarte, no el esquema.

Todos los nombres del ejemplo son **inventados** para el fork (Marea de Brasas,
Yunque Roto, Forja Errante, Puerto Ceniza): no reproducen mundos oficiales.

### Invariantes que ya cumple v1 (#214) y las que añadiría la evolución v2+

**Ya comprobadas por el validador integrado de v1**
([`catalogo-cosmografico.mjs`](../foundry-module/scripts/catalogo-cosmografico.mjs)):

- `version` conocido; jerarquía bien formada por `parent_id`
  (`plane→star_system→planet`, con el padre del tipo esperado).
- IDs únicos, estables y con patrón portable; referencias `parent_id` resueltas.
- Límites de tamaño (≤1 MiB, ≤2000 entradas) y texto plano sin controles ni etiquetas.
- `provenance.kind` en allowlist; `cc` exige `source_url` HTTPS.

**Añadiría la evolución v2+ (aún no implementado):**

- Cuarta capa `enclave` bajo `planet` en la validación de jerarquía.
- Referencias `tacticalMapId` resueltas o marcadas `missing`, nunca silenciadas.
- `meta`/`route` preservados sin ejecución (paridad con `opaque_json` de `MapObject`).
- Round-trip JSON estable (import→export→import) con las capas nuevas.
- Datos privados de campaña excluidos del export del catálogo público.

## Matriz de procedencia y continuidad por fuente (#907)

Verificada el **2026-09-03** contra páginas públicas primarias. Las URLs de
D&D Beyond que muestran índices pueden requerir cuenta o compra para abrir el
contenido: aquí se usan solo como evidencia bibliográfica. Los títulos y
localizadores de esta tabla identifican fuentes; no son un catálogo de datos
extraído de ellas.

| Fuente, editor y continuidad | Alcance para el atlas | Base jurídica / licencia | Se puede versionar | No se puede versionar | Evidencia / localizador verificable | Acción permitida |
|---|---|---|---|---|---|---|
| *System Reference Document 5.1*, Wizards of the Coast — **5e (reglas 2014)** | Reglas y vocabulario genéricos; no aporta un inventario Spelljammer | [SRD oficial](https://www.dndbeyond.com/srd), **CC BY 4.0**; condiciones en la [licencia](https://creativecommons.org/licenses/by/4.0/) | Solo material localizado dentro de SRD 5.1, con atribución, enlace, versión e indicación de cambios | Contenido de otros libros por el mero hecho de usar reglas 5e; ninguna entrada Spelljammer sin localizador SRD | Página oficial, bloque «System Reference Document v5.1» y su preámbulo CC | Reutilizar únicamente contenido SRD comprobado; para el atlas, preferir datos originales |
| *System Reference Document 5.2.1*, Wizards of the Coast — **5.5e / reglas 2024; continuidad separada** | Reglas genéricas 2024; no aporta un inventario Spelljammer | [SRD oficial](https://www.dndbeyond.com/srd), **CC BY 4.0** | Material exacto de 5.2.1 con su atribución propia, solo en un corte que declare reglas 2024 | Mezclarlo silenciosamente con el adaptador 2014 o usarlo para justificar material ausente del SRD | Página oficial, bloque «System Reference Document v5.2.1» y fecha de versión | Mantener fuera del corte 2014 actual; evaluar en una continuidad futura explícita |
| *Astral Adventurer’s Guide*, dentro de *Spelljammer: Adventures in Space*, Wizards of the Coast, 2022 — **5e** | Mar Astral/Plano Astral, Wildspace, tránsito entre sistemas y Roca de Bral | Contenido oficial sin licencia abierta identificada; la [ficha oficial](https://marketplace.dndbeyond.com/TTRPG/spelljammer-adventures-in-space) es comercial y la [licencia digital](https://www.dndbeyond.com/terms-conditions) es personal, no exclusiva y no transferible | Referencia bibliográfica, nuestra clasificación y esquema/adaptador original | Texto, mapas, tablas, arte, estadísticas, rutas o entradas del atlas transcritas; tampoco el mapa de Bral | [Índice oficial](https://www.dndbeyond.com/sources/dnd/sais/aag): «Ch. 2: Astral Adventuring» y «Ch. 3: The Rock of Bral» | Solo esquema/adaptador; cada mesa carga sus datos 5e localmente y registra capítulo/página |
| *Light of Xaryxis*, dentro de *Spelljammer: Adventures in Space*, Wizards of the Coast, 2022 — **5e** | Roca de Bral, Doomspace, Xaryxispace y los trayectos narrativos de la aventura | Misma obra oficial cerrada y mismas condiciones de D&D Beyond que la fila anterior | Referencia bibliográfica, continuidad y campos vacíos del adaptador | Nombres subordinados, cuerpos, distancias, rutas, tablas, trama, texto, mapas, estadísticas o arte convertidos en datos públicos | [Índice oficial](https://www.dndbeyond.com/sources/dnd/sais/lox): parte 3 / capítulo 7 («Wildspace System: Doomspace») y parte 4 / capítulo 10 («Wildspace System: Xaryxispace») | Solo esquema/adaptador; la mesa introduce su copia y conserva el localizador exacto en privado |
| *Spelljammer: Adventures in Space* (boxed set), TSR, 1989 — **AD&D 2e / legado** | Cosmografía base del legado: Wildspace, esferas, phlogiston, sistemas y rutas | Contenido oficial sin licencia abierta identificada; la [ficha oficial de tienda](https://www.dmsguild.com/en/product/17263/spelljammer-adventures-in-space-2e) no es una licencia de redistribución | Referencia bibliográfica, etiqueta `spelljammer-legacy` y esquema original | Texto, mapas, tablas, estadísticas, arte o datos cosmográficos transcritos | DMsGuild product `17263`; código de producto **TSR 1049** | Solo adaptador de legado vacío; datos aportados por cada mesa |
| *SJR2 Realmspace*, TSR, 1991 — **AD&D 2e / legado** | Realmspace: sistema, cuerpos, enclaves y relaciones internas | Contenido oficial sin licencia abierta identificada en su ficha | Referencia bibliográfica y continuidad | Inventario, nombres subordinados, descripciones, coordenadas, rutas, mapas, tablas, estadísticas o arte como catálogo público | [Ficha oficial](https://www.dmsguild.com/en/product/17259/sjr2-realmspace-2e), product `17259`, código **SJR2** | Crear entradas `user_supplied` solo en la campaña privada de la mesa |
| *SJR6 Greyspace*, TSR, 1992 — **AD&D 2e / legado** | Greyspace: sistema, cuerpos, enclaves y relaciones internas | Contenido oficial sin licencia abierta identificada en su ficha | Referencia bibliográfica y continuidad | Los mismos datos expresivos y estructurados cerrados de la fila anterior | [Ficha oficial](https://www.dmsguild.com/en/product/17251/sjr6-greyspace-2e), product `17251`, código **SJR6** | Crear entradas `user_supplied` privadas; no inferir equivalencias con 5e |
| *SJR7 Krynnspace*, TSR, 1993 — **AD&D 2e / legado** | Krynnspace: sistema, cuerpos, enclaves y relaciones internas | Contenido oficial sin licencia abierta identificada en su ficha | Referencia bibliográfica y continuidad | Los mismos datos expresivos y estructurados cerrados de la fila anterior | [Ficha oficial](https://www.dmsguild.com/en/product/17254/sjr7-krynnspace-2e), product `17254`, código **SJR7** | Crear entradas `user_supplied` privadas; no inferir equivalencias con 5e |
| *SJR5 Rock of Bral*, TSR, 1992 — **AD&D 2e / legado** | Roca de Bral como enclave; versión de legado independiente de la 5e | Contenido oficial sin licencia abierta identificada en su ficha | Referencia bibliográfica y continuidad separada | Plano, mapa, localizaciones, habitantes, texto, tablas, estadísticas o arte | [Ficha oficial](https://www.dmsguild.com/en/product/17264/sjr5-rock-of-bral-2e), product `17264`, código **SJR5** | Entrada privada distinta de la 5e; nunca fusionarlas por nombre |
| `cosmografia.example.json`, Espaciokoop Lagunak — **original** | Fixture `plane → star_system → planet` inventado para probar el contrato v1 | Aportación original bajo `GPL-2.0-only` | Archivo completo, metadatos de procedencia y derivados compatibles | Atribuirlo a WotC, TSR o una mesa externa | [Archivo y revisión Git](../foundry-module/data/cosmografia.example.json) | Mantenerlo como único catálogo de ejemplo distribuido mientras no entre otra fuente autorizada |
| Contenido creado por **cada mesa** — `homebrew`, no canónico | Cualquier plano, sistema, cuerpo, enclave o ruta creado para su campaña | Copyright de sus autores; no hay permiso público implícito | Nada por defecto. Solo una contribución expresa del autor, con licencia compatible y sin material ajeno incrustado | Export privado, datos personales o mezcla con contenido oficial/ajeno sin autorización | Declaración de autoría y licencia en el PR; si es privado, `provenance.kind: "user_supplied"` y localizador interno de la mesa | Guardar localmente; publicar únicamente tras revisión de autoría y licencia |
| Contenido de fans o de terceros — continuidad declarada por su autor | Posible ampliación externa del atlas | [Fan Content Policy de WotC](https://company.wizards.com/en/legal/fancontentpolicy): permiso condicionado para fan content, **no** licencia abierta general ni permiso para republicar obra ajena; además prohíbe usar IP de Wizards en otros juegos | Solo metadatos bibliográficos; contenido únicamente con licencia/autorización individual compatible | Copiar una wiki, suplemento o atlas de fans porque sea gratis, público o cite la política | URL de la obra, autor, licencia exacta y autorización verificable por entrada | Rechazar por defecto; revisar caso a caso sin presentarlo como canon |

### Decisión de importación

1. `cc`: el revisor comprueba que el dato exacto está dentro de la obra
   licenciada y registra versión, localizador, atribución y cambios.
2. `original`: el PR identifica a su autor y confirma que no deriva de una
   entrada oficial cerrada.
3. `user_supplied`: nunca pasa al catálogo público; el importador solo lo lee
   desde el mundo o export privado de la mesa.
4. Cualquier otra procedencia, licencia ambigua o contradicción **falla
   cerrada**: no se importa.

La matriz no autoriza por sí misma ninguna entrada. Si cambia una fuente, sus
términos o el alcance del SRD, se vuelve a verificar la fila antes de publicar
datos nuevos.

**Huecos explícitos:** no hay mapeo redistribuible 2e↔5e, escala canónica común
ni catálogo Spelljammer dentro de SRD 5.1/5.2.1. Se mantienen las continuidades
separadas y las unidades/rutas como datos definidos por la mesa.

## Preguntas abiertas a acordar en el issue

1. **Formato canónico:** el primer vertical ya vive como `espaciokoop-cosmography`
   v1 en Foundry (#214). ¿Se confirma seguir evolucionándolo como formato de
   intercambio versionado (v2+ con `enclave`/rutas/`tacticalMapId`), o se prefiere
   Foundry-nativo puro (opción 3) congelando v1 como export mínimo?
2. **Siguiente vertical:** dado que esquema+validador+tests de jerarquía/IDs ya
   están integrados en v1, el próximo PR pequeño sería **añadir una capa nueva de
   v2** (p. ej. `enclave` o `route`) con sus tests, no un validador de cero.
   ¿Cuál se prioriza?
3. **Reparto de ramas:** ¿quién toma la evolución del validador (hoy en JS en
   `foundry-module/`; ¿se porta a C++ `content/` al estilo `campaignGraph` para el
   standalone?) y quién la UI GM de exploración/importación en Foundry?
4. **Coordinación con #54:** el ADR del modelo se escribirá *después* de acordar
   1–3 y de que la evolución esté verificada en `main` (política de `docs/adr/`).
   v1 ya integrado es evidencia del primer vertical, no un ADR: la decisión
   standalone queda abierta hasta que Varo y Eloy la acuerden.

## Relaciones

- #176 / #213 — reposición y atlas comparten la disciplina de datos declarativos.
- #54 — documento/editor visual de mapas tácticos (el atlas los referencia).
- #203 / PR #205 — decorado cosmético del mapa vivo (**fuera** del atlas).
- #204 / PR #208 — colocación de objetos en staging (paridad de trato
  `Unsupported`).
