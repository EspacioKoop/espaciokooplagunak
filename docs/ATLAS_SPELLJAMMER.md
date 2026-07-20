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
dependencia. Coherente con [ADR-0002](adr/0002-autoridad-de-datos-foundry-vs-simulacion.md)
(Foundry = narrativa, simulación = nave) y [ADR-0007](adr/0007-frontera-upstream.md)
(frontera upstream).

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
| Homebrew de una mesa | La mesa | **No** en el repo público; queda en el mundo Foundry / export privado | Marca `provenance: "private"` por entrada |
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

- **A favor:** cero formato nuevo en el repo; Foundry ya es autoritativo del
  lore (ADR-0002); nada de lore ni código viaja al puente.
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

## Modelo mínimo propuesto

Jerarquía `región/plano → sistema → cuerpo → enclave`, con:

- **IDs estables** por entrada y **nombres localizables** (clave i18n, no texto
  incrustado).
- **Procedencia y continuidad por entrada** (`provenance`, `continuity`: p. ej.
  `2e` / `5e` / `original`), sin declarar equivalencias entre ediciones sin
  fuente.
- **Coordenadas/rutas opcionales**, sin inventar escalas canónicas (unidad
  declarada por la mesa; ausencia ≠ origen).
- **Enlace opcional** a un `MapDocument` táctico por `tacticalMapId`.
- **Metadatos extensibles** preservados sin ejecución de código (equivalente al
  `opaque_json` de `MapObject`: se conserva, nunca se interpreta).
- **Import/export JSON declarativo, versionado**, con límites y validación.
- **Separación** entre catálogo redistribuible y datos privados de campaña
  (`provenance: "private"` nunca se exporta al catálogo público).

### Borrador de esquema (v0, a validar — no comprometido aún)

```jsonc
{
  "atlasVersion": 0,                 // entero; el validador rechaza versiones desconocidas
  "id": "atlas-ejemplo-original",
  "nameKey": "atlas.ejemplo.nombre", // clave i18n; nunca texto crudo canónico
  "provenance": "original",          // original | srd | private
  "license": "CC0-1.0",              // obligatorio salvo provenance=private
  "regions": [
    {
      "id": "region-marea-de-brasas",
      "nameKey": "atlas.region.mareaDeBrasas",
      "continuity": "original",
      "systems": [
        {
          "id": "sistema-yunque-roto",
          "nameKey": "atlas.sistema.yunqueRoto",
          "route": { "unit": "mesa-definida", "coords": [0, 0] }, // opcional
          "bodies": [
            {
              "id": "cuerpo-forja-errante",
              "nameKey": "atlas.cuerpo.forjaErrante",
              "kind": "planet",              // allowlist; desconocido -> reportado, no perdido
              "tacticalMapId": null,          // enlace opcional a un MapDocument
              "enclaves": [
                { "id": "enclave-puerto-ceniza", "nameKey": "atlas.enclave.puertoCeniza" }
              ],
              "meta": {}                      // preservado, nunca ejecutado
            }
          ]
        }
      ]
    }
  ]
}
```

Todos los nombres del ejemplo son **inventados** para el fork (marea de brasas,
Yunque Roto, Forja Errante, Puerto Ceniza): no reproducen mundos oficiales.

### Invariantes que el validador (entregable #4) deberá comprobar

- `atlasVersion` conocido; jerarquía bien formada `región→sistema→cuerpo→enclave`.
- IDs únicos y estables dentro del atlas; referencias (`tacticalMapId`)
  resueltas o marcadas `missing`, nunca silenciadas.
- `kind` fuera de la allowlist se **reporta** conservando la entrada (paridad con
  el trato de `Unsupported` en `MapObject`).
- Límites de tamaño/profundidad; round-trip JSON estable (import→export→import).
- `provenance: "private"` excluido del export del catálogo público.
- `license` presente salvo `provenance: "private"`.

## Inventario Spelljammer por edición (marco, con huecos explícitos)

El inventario **no** versiona datos oficiales; registra qué **ediciones/fuentes**
existen como localizadores bibliográficos y marca toda entrada concreta como
*dato de mesa*. Cobertura medible = número de sistemas/mundos que **la mesa**
ha cargado, no datos incluidos aquí.

| Edición / fuente (localizador) | Naturaleza | Redistribuible aquí | Estado de cobertura |
|---|---|---|---|
| AD&D 2e *Spelljammer* (TSR, 1989–1993) | Protegido | No — solo esquema | Hueco: aportado por la mesa |
| D&D 5e *Spelljammer: Adventures in Space* (WotC, 2022) | Protegido | No — solo esquema | Hueco: aportado por la mesa |
| SRD 5.1 (contenido compatible, si aplica) | OGL/CC-BY | Sí, con atributo | Pendiente de revisar qué es realmente aplicable |
| Ejemplos originales del fork | Original | Sí | Semilla incluida en el borrador de esquema |

**Huecos declarados explícitamente** (no se rellenan con datos inventados como si
fueran canon): mapeo verificado 2e↔5e; qué porción del SRD es utilizable para un
atlas espacial; unidad de escala/ruta canónica (se deja `mesa-definida`).

## Preguntas abiertas a acordar en el issue

1. **Formato canónico:** ¿se confirma el híbrido 2+3 con `CampaignAtlasDocument`
   como formato de intercambio, o se prefiere Foundry-nativo puro (opción 3)?
2. **Primer vertical implementable:** propuesta → esquema v0 + validador + tests
   de jerarquía/IDs/round-trip con los **ejemplos originales** (sin UI todavía),
   como PR pequeño siguiente. ¿De acuerdo?
3. **Reparto de ramas:** ¿quién toma esquema/validador (C++ `content/` al estilo
   `campaignGraph`) y quién la UI GM de exploración/importación en Foundry?
4. **Coordinación con #54:** el ADR del modelo se escribirá *después* de acordar
   1–3 y de que el vertical esté verificado en `main` (política de `docs/adr/`).

## Relaciones

- #176 / #213 — reposición y atlas comparten la disciplina de datos declarativos.
- #54 — documento/editor visual de mapas tácticos (el atlas los referencia).
- #203 / PR #205 — decorado cosmético del mapa vivo (**fuera** del atlas).
- #204 / PR #208 — colocación de objetos en staging (paridad de trato
  `Unsupported`).
