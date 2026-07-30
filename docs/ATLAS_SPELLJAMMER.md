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

## Guardia legal (vinculante para todo el corte)

- **No** extraer PDFs, D&D Beyond ni libros oficiales.
- **No** copiar descripciones, estadísticas, tablas, mapas ni ilustraciones
  protegidas al repositorio público.
- Los nombres propios de mundos/planos de Spelljammer publicados por WotC/TSR
  son **contenido protegido**: se tratan como *dato privado de campaña* que cada
  mesa introduce desde material que posee, nunca versionado en este repo.
- Si una fuente oficial no es redistribuible, se implementa **solo el esquema y
  el adaptador**; los datos los aporta la mesa.
- Cualquier ejemplo versionado en el repo es **original** (mundos inventados
  para el fork) o proviene de fuentes CC/SRD con procedencia declarada.
- No se declaran equivalentes 5e y 2e como idénticos sin fuente verificable.

## Matriz de procedencia/licencia

Clasifica **de dónde** puede venir cada capa de datos y qué puede versionarse.
Cada entrada real del atlas de una mesa heredará una de estas filas.

| Clase de contenido | Procedencia / licencia | Redistribución en este repo | Evidencia exigida |
|---|---|---|---|
| Esquema JSON, IDs de campo, validador | Original del fork (este repo) | **Sí**, versionado | Código y tests en el PR |
| Ejemplos de sistemas/mundos **inventados** | Creación original para el fork | **Sí**, versionado como fixtures | Autoría propia en el PR |
| Datos SRD 5.1 / material CC-BY compatible | SRD (OGL/CC-BY 4.0 según edición) | **Sí**, con atributo de licencia por entrada | Localizador verificable (URL/ISBN) + nota de licencia |
| Mundos/planos oficiales de Spelljammer (nombres, lore, mapas, stats) | WotC / TSR, protegido | **No**. Solo esquema; dato lo aporta la mesa | La mesa declara poseer el material |
| Homebrew de una mesa | La mesa | **No** en el repo público; queda en el mundo Foundry / export privado | Marca `provenance.kind: "user_supplied"` por entrada; el archivo privado se mantiene explícitamente fuera del catálogo público del repo |
| Contenido de fans bajo *Fan Content Policy* WotC | Fan, no comercial, no oficial | **No** por defecto; caso a caso, nunca como canon | Enlace a política + declaración de la mesa |

**Regla de separación:** el catálogo redistribuible (esquema + ejemplos
originales/SRD) vive en el repo; los datos de una campaña concreta (incluidos
todos los nombres canónicos de Spelljammer) viven en el mundo de Foundry de esa
mesa o en un export privado que la mesa custodia. El repo nunca mezcla ambos.

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

## Matriz de trazabilidad por fuente (entregable #213)

Esta es la matriz que exige #213: **una fila por fuente concreta**, con título,
editor, URL pública cuando exista, alcance, procedencia/licencia, redistribución
en este repo y localizador verificable. No copia ni parafrasea contenido
protegido: registra la *procedencia*, no los datos. Donde no hay URL pública o el
dato lo aporta la mesa, el hueco se declara de forma explícita.

| Fuente (título) | Editor | URL pública | Alcance | Procedencia / licencia | ¿Redistribuible aquí? | Localizador verificable |
|---|---|---|---|---|---|---|
| *Spelljammer: AD&D Adventures in Space* (boxed set) | TSR, 1989 | — (obra impresa, sin publicación pública gratuita) | Planos, esferas de cristal, phlogiston, mundos y naves 2e | Protegido (copyright TSR/WotC) | **No** — solo esquema; datos aportados por la mesa | Código de producto TSR 1049 |
| *Spelljammer: Adventures in Space* | Wizards of the Coast, 2022 | [dnd.wizards.com](https://dnd.wizards.com/products/spelljammer) (ficha comercial, no el contenido) | Wildspace, Astral Sea, mundos y criaturas 5e | Protegido (copyright WotC); disponible en D&D Beyond, no redistribuible | **No** — solo esquema; datos aportados por la mesa | ISBN-13 978-0-7869-6787-4 |
| System Reference Document 5.1 (SRD 5.1) | Wizards of the Coast, 2023 | [dndbeyond.com/srd](https://www.dndbeyond.com/srd) · PDF: [media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf) | Reglas y contenido genérico SRD; **no incluye material propio de Spelljammer** | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | **Sí**, con atributo por entrada — pero su cobertura espacial es marginal | Sección/número de página del SRD citada por entrada |
| Fan Content Policy de WotC | Wizards of the Coast | [company.wizards.com/…/fancontentpolicy](https://company.wizards.com/en/legal/fancontentpolicy) | Marco para contenido de fans no comercial | Política, no licencia de contenido | **No** por defecto; caso a caso, nunca como canon | URL de la política + declaración de la mesa |
| Ejemplos originales del fork | Espaciokoop Lagunak | [`foundry-module/data/cosmografia.example.json`](../foundry-module/data/cosmografia.example.json) | Mundos inventados de prueba (Mar de Argia, Sistema Laguna, Auzolan) | Original, `GPL-2.0-only` | **Sí**, versionado como fixtures | El propio archivo en el repo |

**Huecos declarados explícitamente** (no se rellenan con datos inventados como si
fueran canon):

- **Mapeo verificado 2e↔5e:** no existe fuente redistribuible que lo fije; se deja
  como hueco, nunca se afirma equivalencia sin cita.
- **Porción del SRD 5.1 realmente aplicable a un atlas espacial:** el SRD 5.1 es
  contenido genérico y **no** incluye Wildspace/esferas de cristal; su aporte al
  atlas es marginal y está pendiente de auditar entrada por entrada.
- **Unidad de escala/ruta canónica:** sin fuente redistribuible; se deja
  `mesa-definida`.
- **URL pública del contenido 2e/5e:** no existe de forma legal y gratuita; las
  fichas enlazadas son comerciales, no el contenido.

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
