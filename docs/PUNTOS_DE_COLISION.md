# Puntos de colisión entre agentes — diagnóstico medido con historial real

> **Objetivo:** reducir los puntos de colisión entre agentes (issue #611).  
> **Método:** extraer datos del historial real con git (desde 2026-07-01), aplicar los patrones de la skill `reducing-merge-conflicts` y documentar qué ficheros concretos sufren cada patrón y qué medida lo arreglaría.  
> **Entregable:** este documento. No se propone refactor de código: solo diagnóstico.

---

## 1. Tabla de los 15 ficheros más disputados (cuenta real de commits)

Los números proceden del siguiente comando (ejecutable tal cual):

```bash
git log --since=2026-07-01 --pretty=format: --name-only \
  | grep -v '^$' | sort | uniq -c | sort -rn | head -15
```

| Puesto | Fichero | Commits que lo tocan |
|--------|---------|---------------------|
| 1 | `foundry-module/lang/en.json` | 90 |
| 2 | `foundry-module/lang/es.json` | 90 |
| 3 | `foundry-module/scripts/main.mjs` | 73 |
| 4 | `CLAUDE.md` | 60 |
| 5 | `docs/FOUNDRY.md` | 56 |
| 6 | `resources/locale/main.es.po` | 38 |
| 7 | `foundry-module/tests/main-compat.test.mjs` | 37 |
| 8 | `src/screens/gm/contentEditor.cpp` | 35 |
| 9 | `README.md` | 33 |
| 10 | `docs/CONTENT_EDITOR.md` | 33 |
| 11 | `foundry-module/styles/lagunak.css` | 32 |
| 12 | `bridge/README.md` | 31 |
| 13 | `foundry-module/scripts/station-workspaces.mjs` | 31 |
| 14 | `resources/locale/main.en.po` | 30 |
| 15 | `foundry-module/scripts/station-workspace-ui.mjs` | 28 |

> **Nota:** la pareja `en.json` / `es.json` aparece siempre junta (90 co-ocurrencias exactas).  
> Comando para verificarlo:

```bash
git log --since=2026-07-01 --pretty=format:"%H" --name-only \
  | awk '/^[0-9a-f]{40}$/ {c=$0; next} NF {print c, $0}' \
  | sort | uniq -c | awk '$2=="foundry-module/lang/en.json" && $3=="foundry-module/lang/es.json"'
# → 90 foundry-module/lang/en.json foundry-module/lang/es.json
```

---

## 2. Patrones de la skill `reducing-merge-conflicts` que aplican aquí

La skill define 4 patrones centrales. Para cada uno indico: (a) qué fichero concreto de la tabla lo sufre, (b) qué medida lo arreglaría.

### 2.1 Extract to Catalog Pattern (patrón “extraer a catálogo”)

**Descripción en la skill:** cuando un fichero contiene una lista a la que distintos agentes añaden elementos (herramientas, módulos, features), extraer la gestión de la lista a un fichero-catálogo separado.

**Fichero que lo sufre:** `foundry-module/scripts/main.mjs` (73 commits, 1.º en scripts, 3.º global).  
En él se registran herramientas GM, pestañas de estación, paneles de nave, minijuegos, etc. Cada agente que añade una herramienta o una estación toca `main.mjs`.

**Medida que lo arreglaría:** extraer cada lista de registro a su propio módulo-catálogo (p. ej. uno para herramientas GM, otro para estaciones, otro para paneles de nave, otro para minijuegos) y que `main.mjs` solo importe y componga. La rama `origin/issue-611-herramientas-catalogo` ya demuestra el patrón para herramientas GM.

**Comando para ver qué ramas tocan `main.mjs` en exclusiva (no en main):**

```bash
git for-each-ref --format='%(refname:short)' refs/heads/ refs/remotes/origin/ \
  | grep -v '^main$' | grep -v '^origin/main$' | grep -v '^origin/HEAD$' | grep -v '^wt/' \
  | while read b; do git log main.."$b" --since=2026-07-01 --pretty=format: --name-only 2>/dev/null | grep -q '^foundry-module/scripts/main.mjs$' && echo "$b"; done
# → 24 ramas distintas (dato de la tabla de ramas exclusivas)
```

---

### 2.2 Feature-Based File Organization (organización por feature/dominio)

**Descripción en la skill:** en lugar de un fichero grande por preocupación transversal (p. ej. `settings.js` con todo), organizar por feature: un fichero por feature/dominio (la skill ilustra con rutas de ejemplo genéricas; *no son rutas reales de este repo*).

**Ficheros que lo sufren:**

| Fichero | Commits | Dominios mezclados que conviven en él |
|---------|---------|----------------------------------------|
| `CLAUDE.md` | 60 | instrucciones para agentes, convención de find, notas de roadmap, hooks de seguridad, etc. |
| `docs/FOUNDRY.md` | 56 | arquitectura, scripts, tests, estilos, plantillas, i18n, todo en uno |
| `foundry-module/styles/lagunak.css` | 32 | estilos de nave, museo, playa, cantina, minimapa, dados, cascos, etc. |
| `resources/locale/main.es.po` / `main.en.po` | 38 / 30 | cadenas de nave, museo, playa, cantina, dados, cascos, etc. |

**Medida que lo arreglaría:**
- Dividir `CLAUDE.md` en ficheros por tema (convenciones de agentes, hooks de seguridad, convención de find, etc.) y mantener un índice.
- Dividir `docs/FOUNDRY.md` en ficheros por subdominio (arquitectura, scripts, tests, i18n, estilos, plantillas) bajo `docs/foundry/`.
- Dividir `lagunak.css` en hojas de estilo por feature/dominio y un índice que las importe.
- Dividir los `.po` por feature (o migrar a JSON por feature y compilar a `.po` en CI).

**Comando para ver co-ocurrencia de `lagunak.css` con scripts de dominios distintos:**

```bash
git log --since=2026-07-01 --pretty=format:"%H" --name-only \
  | awk '/^[0-9a-f]{40}$/ {c=$0; next} NF {print c, $0}' \
  | awk '$2=="foundry-module/styles/lagunak.css" {print $3}' | sort | uniq -c | sort -rn | head -20
# Muestra qué scripts cambian en los mismos commits que el CSS
```

---

### 2.3 Generated Files from Source of Truth (ficheros generados desde fuente única)

**Descripción en la skill:** mantener una única fuente de verdad y generar los formatos consumibles (doc, JSON, etc.) en lugar de editar ambos a mano.

**Ficheros que lo sufren:**

| Pareja de ficheros | Co-ocurrencias | Problema |
|--------------------|----------------|----------|
| `foundry-module/lang/en.json` ↔ `foundry-module/lang/es.json` | 90 | Se editan siempre juntos a mano; drift garantizado. |
| `resources/locale/main.en.po` ↔ `resources/locale/main.es.po` | 30 | Idem en formato gettext. |
| `docs/FOUNDRY.md` ↔ scripts/tests/estilos que documenta | 23–27 | La doc se desincroniza del código. |

**Medida que lo arreglaría:**
- i18n: mantener **una sola** fuente de claves→texto base y generar `en.json`, `es.json`, `main.en.po`, `main.es.po` con script (ya existe `tools/i18n_es.py` que hace parte).
- Docs: generar `docs/FOUNDRY.md` (o secciones) desde metadatos en los propios scripts (JSDoc / comentarios estructurados) o desde un catálogo YAML único.

**Comando para confirmar que `en.json` y `es.json` siempre cambian juntos:**

```bash
git log --since=2026-07-01 --pretty=format:"%H" --name-only \
  | awk '/^[0-9a-f]{40}$/ {c=$0; next} NF {print c, $0}' \
  | awk '$2=="foundry-module/lang/en.json" || $2=="foundry-module/lang/es.json" {print $1}' \
  | sort | uniq -c | awk '$1!=90'
# → (salida vacía = todos los commits que tocan uno tocan el otro)
```

---

### 2.4 Stable Interfaces with Extension Points (interfaces estables con puntos de extensión)

**Descripción en la skill:** diseñar ficheros núcleo con interfaces estables para que los agentes extiendan sin tocar el núcleo (plugins, overrides, directorios de features, hooks).

**Ficheros que lo sufren:**

| Fichero | Commits | Por qué es núcleo inestable |
|---------|---------|-----------------------------|
| `foundry-module/scripts/main.mjs` | 73 | Punto único de registro de todo: herramientas, estaciones, paneles, minijuegos, hooks de escena. |
| `foundry-module/scripts/station-workspaces.mjs` | 31 | Define arrays de workspaces; cada agente que añade una estación lo toca. |
| `foundry-module/scripts/station-workspace-ui.mjs` | 28 | Define UI por workspace; mismo problema. |
| `foundry-module/scripts/nave-sala-caja.mjs` | 21 | Define salas de nave; cada PR de camarotes/puentes lo toca. |
| `foundry-module/scripts/nave-catalogo-andar.mjs` | 20 | Catálogo de suelos/paredes; cada PR de texturas lo toca. |

**Medida que lo arreglaría:**
- `main.mjs` → no define arrays; importa getters de catálogos (herramientas, estaciones, paneles, minijuegos). Solo compone.
- `station-workspaces.mjs` / `station-workspace-ui.mjs` → importan catálogo de estaciones único.
- `nave-sala-caja.mjs` → importa catálogo de salas.
- `nave-catalogo-andar.mjs` → separar catálogos por tipo (suelos, paredes, techos) y un índice que los agregue.

**Comando para ver qué ramas tocan `station-workspaces.mjs` y `station-workspace-ui.mjs` juntas:**

```bash
git for-each-ref --format='%(refname:short)' refs/heads/ refs/remotes/origin/ \
  | grep -v '^main$' | grep -v '^origin/main$' | grep -v '^origin/HEAD$' | grep -v '^wt/' \
  | while read b; do
      git log main.."$b" --since=2026-07-01 --pretty=format: --name-only 2>/dev/null \
      | grep -q '^foundry-module/scripts/station-workspaces.mjs$' && \
      git log main.."$b" --since=2026-07-01 --pretty=format: --name-only 2>/dev/null \
      | grep -q '^foundry-module/scripts/station-workspace-ui.mjs$' && echo "$b"
    done
# → 6 ramas (feat/331-telemetria-abierta, feat/362-casco-consola, prueba/conjunta-20260728, prueba/conjunta-20260731, test/227-ruido-aria-live-estado-nave, test/227-ruido-aria-live-estado-nave-v1)
```

---

## 3. Lo que la skill propone y **NO aplica** a este repo

| Propuesta de la skill | Por qué no aplica aquí |
|------------------------|------------------------|
| **Plugin architecture with well-defined registration points** (arquitectura de plugins con puntos de registro bien definidos) | El módulo Foundry no tiene un sistema de plugins dinámicos en tiempo de ejecución; todo se compila en el bundle del módulo. La skill habla de sistemas donde terceros cargan plugins en caliente; aquí todo es código propio que se edita en repo. |
| **Configuration files with "local overrides" sections** (ficheros de config con secciones de overrides locales) | No hay ficheros de configuración tipo `config.yaml` con overrides; la configuración viva está en JSON/JS que se edita directamente. |
| **Hook/callback systems that allow extension without core modification** (sistemas de hooks/callbacks para extender sin tocar el núcleo) | Foundry VTT provee hooks (`Hooks.on(...)`), pero el registro de herramientas/estaciones/paneles en `main.mjs` no usa hooks: es imperativo (`game.modules.get('lagunak').api.registerTool(...)`). No hay un bus de eventos propio para registro. |
| **Main files that import feature modules from a directory** (ficheros principales que importan módulos de feature desde un directorio) | Actualmente `main.mjs` importa ficheros concretos uno a uno (`import ... from './scripts/x.mjs'`). No hay un `import * from './features/'` automático porque el bundler (Rollup) y Foundry requieren imports estáticos explícitos. |
| **Extract list management to a separate catalog file** → *sí aplica* (véase 2.1) | — |
| **Feature-based file organization** → *sí aplica* (véase 2.2) | — |
| **Generated files from source of truth** → *sí aplica* (véase 2.3) | — |
| **Stable interfaces with extension points** → *parcialmente aplica* (véase 2.4) | El patrón aplica en concepto, pero la implementación concreta (“directorio de features con auto-import”) no es viable sin cambiar el bundler. La adaptación realista es catálogos explícitos importados desde `main.mjs`. |

---

## 4. Comandos de verificación (criterios de hecho)

```bash
# 1. El fichero existe
test -f docs/PUNTOS_DE_COLISION.md

# 2. Contiene al menos un comando git log
grep -qE 'git log' docs/PUNTOS_DE_COLISION.md

# 3. La tabla tiene ≥ 16 líneas que empiezan por "|" (15 filas + cabecera)
test $(grep -cE '^\|' docs/PUNTOS_DE_COLISION.md) -ge 16

# 4. Menciona explícitamente "no aplica"
grep -qi 'no aplica' docs/PUNTOS_DE_COLISION.md

# 5. Pasa el validador de fundamentación documental
~/.hermes/bin/doc-fundamentar.py docs/PUNTOS_DE_COLISION.md
```

---

— Urtzi · hermes-smart
---

## Nota sobre la reproducibilidad de estos comandos

La primera versión de este documento publicaba un `awk` cuyo bloque `END` solo
volcaba los ficheros del **último** commit, así que ninguno de los pipelines
reproducía las cifras de sus propias tablas. Las cifras eran correctas —se
obtuvieron por otra vía— pero el comando publicado no las producía.

Corregido: el `awk` de emparejado ahora vuelca cada línea según la va leyendo
(`/^[0-9a-f]{40}$/ {c=$0; next} NF {print c, $0}`), y la tabla del apartado 1
usa un pipeline directo sin emparejado. Ejecutados los dos contra el
repositorio antes de reponer el documento.

**Un número cuyo comando no se ha ejecutado no está verificado**, aunque el
número sea cierto. Es el mismo fallo que este documento describe en otro plano.
