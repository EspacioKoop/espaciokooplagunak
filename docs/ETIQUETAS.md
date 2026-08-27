# Etiquetas del repositorio

Inventario medido y política mínima de etiquetas (issue #717).

Los recuentos de este documento salen de `gh label list` y de las etiquetas
aplicadas sobre **255 issues y 502 PRs** (todos los estados), medidos el
25-ago-2026. No son estimaciones: se pueden reproducir con los comandos de la
sección [Cómo reproducir el inventario](#cómo-reproducir-el-inventario).

## 1. Inventario

40 etiquetas definidas, **34 en uso** y 6 sin usar.

### Por función

**Área / módulo** — dónde vive el cambio. Se infieren solas (ver §3).

| Etiqueta | Usos | Significado |
| --- | ---: | --- |
| `area:foundry` | 363 | Módulo Foundry VTT y experiencia de campaña |
| `area:bridge` | 107 | Puente de integración y su contrato API |
| `area:juego` | 62 | Servidor/cliente del juego heredado (C++ en `src/`) |
| `area:escenarios` | 29 | Escenarios Lua y contenido jugable |
| `area:docker` | 11 | Imagen del servidor, compose, despliegue |

**Lenguaje** — también inferibles por extensión.

| Etiqueta | Usos |
| --- | ---: |
| `cpp` | 36 |
| `python` | 32 |
| `javascript` | 27 |
| `lua` | 3 |

**Tipo de trabajo**

| Etiqueta | Usos | Significado |
| --- | ---: | --- |
| `documentation` | 262 | Documentación |
| `enhancement` | 164 | Funcionalidad nueva |
| `automation` | 79 | Automatización de procesos |
| `decision` | 52 | Decisión de arquitectura, API o integración |
| `Fix` | 31 | Correcciones (junto a `bug` cuando aplique) |
| `bug` | 13 | Algo no funciona |
| `dependencies` | 32 | Actualización de dependencias (Dependabot) |
| `github_actions` | 31 | Actualización de Actions (Dependabot) |
| `docker` | 1 | Actualización de código Docker (Dependabot) |

**Fase del roadmap** — `Fase 3` (156), `Fase 4` (12), `Fase 2` (7), `Fase 1` (7), `Fase 0` (2).

**Calidad y baseline AECF** — `AECF` (15) es el paraguas (*Análisis Estático de
Código Fuente*); `Calidad` (21) y `Accesibilidad` (13) son dimensiones suyas.
`Betatesting` (6) marca pruebas con personas reales.

**Estado y coordinación** — `seguridad` (29), `Coordinación` (11), `triage` (7),
`main-roto` (1), `Compatibilidad` (1), `help wanted` (3), `good first issue` (2).

### Sin uso

`bloqueado`, `upstream-sync`, `duplicate`, `invalid`, `question`, `wontfix`.

Las cuatro últimas son etiquetas por defecto de GitHub. `bloqueado` y
`upstream-sync` sí son propias del proyecto y describen situaciones reales
—esperar una dependencia externa, sincronizar con EmptyEpsilon—, así que su
cero refleja que nadie las aplica, no que sobren.

### Duplicidades

**No hay duplicados que fusionar.** El único par sospechoso es `docker` frente a
`area:docker`, y son cosas distintas: `docker` la pone Dependabot al actualizar
imágenes base, `area:docker` marca cambios en la infraestructura del proyecto.

Sí hay **inconsistencia de forma**: conviven minúsculas (`documentation`, `bug`,
`area:*`) con capitalizadas y en castellano (`Fase N`, `Fix`, `Calidad`, `AECF`,
`Coordinación`, `Accesibilidad`, `Betatesting`, `Compatibilidad`). Renombrarlas
reescribiría 250+ asignaciones históricas, y el beneficio es estético. Se deja
como está a propósito.

## 2. Política mínima

> Si una información puede deducirse de los ficheros modificados, del código o
> del milestone, no lleva etiqueta puesta a mano.

De ahí salen tres reglas:

1. **Área y lenguaje no se ponen a mano.** Las infiere el labeler por rutas.
2. **Una etiqueta nueva necesita justificar por qué no es deducible.** Antes de
   crearla, comprobar que ninguna existente significa ya lo mismo.
3. **No se crea una etiqueta por módulo ni por issue.** El área es el nivel de
   granularidad; por debajo, lo dice el diff.

## 3. Automatización

`.github/workflows/label.yml` ejecuta `actions/labeler` v7 en cada
`pull_request_target` y aplica lo que declara `.github/labeler.yml`.

La política local de ese fichero es deliberadamente estrecha: cada etiqueta usa
solo reglas `changed-files` con listas explícitas de matchers, sin reglas de
rama ni grupos `any`/`all`. La hace cumplir `tools/tests/test_labeler_config.py`,
que además rechaza claves YAML duplicadas.

Cobertura actual — las 5 áreas y los 4 lenguajes:

| Etiqueta | Rutas |
| --- | --- |
| `area:bridge` | `bridge/**` |
| `area:docker` | `docker/**`, `compose.yaml`, `compose.*.yaml` |
| `area:foundry` | `foundry-module/**` |
| `area:escenarios` | `scripts/**/*.lua` |
| `area:juego` | `src/**` |
| `cpp` | `**/*.cpp`, `**/*.h`, `**/*.hpp` |
| `python` | `**/*.py` |
| `javascript` | `**/*.js`, `**/*.mjs`, `**/*.ts` y sus variantes de test |
| `lua` | `**/*.lua` |
| `documentation` | `docs/**`, `*.md` |
| `automation` | `.github/workflows/**`, `.github/dependabot.yml`, `.github/labeler.yml` |

Cuatro globs preexistentes no casan hoy con ningún fichero del árbol:
`compose.yaml` y `compose.*.yaml` (en `area:docker`), y `**/*.ts`, `**/*.spec.ts`
más `**/*.test.js` (en `javascript`, donde además son subconjuntos de `**/*.js` y
`**/*.ts`). Se mantienen a propósito: describen ficheros que el proyecto puede
adoptar, y una regla que no casa no hace daño. Conviene revisarlos si al cabo de
un tiempo siguen vacíos.

Lo que **no** se automatiza, porque no se deduce del diff: `enhancement`, `bug`,
`Fix`, `decision`, `seguridad`, las fases del roadmap y las dimensiones AECF.

## Cómo reproducir el inventario

Una etiqueta se usa en issues **y** en pull requests, así que el inventario se
construye UNA sola vez con las dos fuentes y se reutiliza. Es lo que arregla la
contradicción que tenía esta receta: el recuento de uso combinaba ambos y el
`comm` de «etiquetas sin uso» comparaba solo contra `gh issue list`, de modo que
cualquier etiqueta empleada únicamente en PRs aparecía falsamente como huérfana.

```sh
gh label list --limit 200 --json name,description,color \
  -q '.[] | [.name, (.description//""), .color] | @tsv' > /tmp/labels.tsv

# UNA sola lista de usos, issues + PRs. Todo lo demás sale de aquí.
{ gh issue list --state all --limit 1000 --json labels -q '.[] | .labels[].name'
  gh pr    list --state all --limit 1000 --json labels -q '.[] | .labels[].name'
} | sort > /tmp/usos.txt

sort -u /tmp/usos.txt > /tmp/usadas.txt

# uso real, por frecuencia
uniq -c /tmp/usos.txt | sort -rn

# etiquetas definidas que nadie usa
comm -23 <(cut -f1 /tmp/labels.tsv | sort) /tmp/usadas.txt
```

### Comprobar que la receta no vuelve a mentir

La forma de que este error reaparezca es que alguien recorte una de las dos
fuentes. Se detecta con las etiquetas que existen **solo en PRs**: si la lista
de «sin uso» contiene alguna de ellas, la receta está rota.

```sh
gh issue list --state all --limit 1000 --json labels \
  -q '.[] | .labels[].name' | sort -u > /tmp/solo_issues.txt

# etiquetas que solo aparecen en PRs: la receta NO debe darlas por huérfanas
comm -23 /tmp/usadas.txt /tmp/solo_issues.txt
```

Ejecutado el 27-ago-2026 contra este repositorio, ese último comando devuelve
cuatro etiquetas —`Compatibilidad`, `dependencies`, `docker`, `Fase 0`—, que son
exactamente las que la receta anterior habría declarado sin uso. El inventario
correcto deja seis sin uso: `bloqueado`, `duplicate`, `invalid`, `question`,
`upstream-sync`, `wontfix`.
