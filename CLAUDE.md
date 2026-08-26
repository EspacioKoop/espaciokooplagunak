# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Lectura obligatoria

Este repositorio ya define un contrato operativo para agentes de IA en [`AGENTS.md`](AGENTS.md) —
léelo antes de modificar nada; sus reglas prevalecen sobre cualquier hábito por defecto. Las que más
condicionan el trabajo diario:

- No desarrolles sobre `main`: crea rama y entrega por pull request (flujo en [`CONTRIBUTING.md`](CONTRIBUTING.md)).
- Si trabajas en paralelo con otro agente, mira el mapa de áreas y los puntos de colisión conocidos en
  [`docs/TRABAJO_PARALELO_AGENTES.md`](docs/TRABAJO_PARALELO_AGENTES.md) ANTES de elegir por dónde
  empezar: media docena de archivos (este mismo, `lang/*.json`, `main.mjs`, `paleta.mjs` y sus
  guardas) los toca casi cualquier trabajo del módulo, y ahí es donde chocan dos ramas que por lo
  demás no se rozan. Los agentes especializados del proyecto van versionados en
  [`.claude/agents/`](.claude/agents).
- No afirmes que algo compila, arranca o funciona si no has ejecutado la comprobación correspondiente.
- Nada de `push --force`, `reset --hard`, squash del historial heredado ni reescritura de historial
  sin autorización humana explícita.
- No instales paquetes del sistema sin autorización humana.
- No presentes código de EmptyEpsilon como creación de este fork.
- Cada entrega debe resumir: objetivo/issue, archivos cambiados, decisiones, comandos de prueba
  ejecutados con su resultado, comprobaciones pendientes y riesgos.

### Decisiones ya tomadas: no las rediscutas, cítalas

Las reglas duras del proyecto están registradas en [`docs/adr/`](docs/adr/README.md), y este archivo
las **apunta** en vez de repetirlas. Si vas a proponer algo que choca con una de ellas, la vía es un
ADR nuevo que la sustituya, no un PR que la ignore. Índice legible por máquina en
[`docs/adr/index.json`](docs/adr/index.json).

| Si estás tocando… | Léete antes |
|---|---|
| El endpoint HTTP heredado, exposición de red | [ADR-0001](docs/adr/0001-exec-lua-nunca-expuesto.md), [ADR-0011](docs/adr/0011-riesgos-de-seguridad-y-defensa-en-profundidad.md) |
| Qué dato es de quién (Foundry / puente / simulación) | [ADR-0008](docs/adr/0008-standalone-first-autoridad-del-nucleo.md) |
| Transporte del contrato del puente | [ADR-0003](docs/adr/0003-transporte-polling-http.md) |
| Código heredado de EmptyEpsilon | [ADR-0007](docs/adr/0007-frontera-upstream.md) |
| Permisos por puesto, órdenes de puente | [ADR-0009](docs/adr/0009-modelo-permisos-por-puesto-v1.md), [ADR-0010](docs/adr/0010-hackeo-solo-nativo.md) |
| Una escena, estancia o exterior nuevo | [ADR-0012](docs/adr/0012-que-puede-hacer-una-escena-de-foundry.md) |
| Material de terceros, catálogos, licencias | [ADR-0013](docs/adr/0013-frontera-de-licencias-y-procedencia.md) |
| Cualquier superficie que se dibuje | [ADR-0014](docs/adr/0014-doctrina-de-arte-procedural.md) |
| Copiar al módulo un dato que ya existe en el árbol | [ADR-0015](docs/adr/0015-dato-derivado-se-copia-y-se-compara.md) |

## Qué es

Espaciokoop Lagunak es un fork comunitario de [EmptyEpsilon](https://github.com/daid/EmptyEpsilon),
simulador cooperativo de puente de mando espacial: C++17 + CMake, motor
[SeriousProton](https://github.com/daid/SeriousProton) (repo hermano, NO submódulo) + SDL2, y
escenarios/lógica de misión en Lua.

Este archivo recoge solo **hechos duraderos**. El roadmap por fases (0–5) y qué característica está
integrada viven en el `README.md`; el estado operativo (qué hay en vuelo, bloqueos, traspasos) se
sigue en el issue de coordinación [#14](https://github.com/VaroTv7/espaciokooplagunak/issues/14) y en
los issues/PRs abiertos — no lo dupliques aquí: si un dato necesita actualizarse cada semana, no
pertenece a este archivo.

Piezas propias del fork: escenario `scenario_90_lagunak_primera_guardia.lua`, puente seguro con
contrato v0 (`bridge/`), módulo Foundry adaptativo v11–v13 (`foundry-module/`), editor de contenido
del GM, asistente de instalación (`tools/instalar.py` + `docs/INSTALACION.md`) y compilación
reproducible nativa y Docker, con publicación en GHCR por tag `v*`. Para QA local:
`./build/EmptyEpsilon headless=<escenario>.lua` arranca sin ventana, escucha en TCP/UDP 35666
(config en `~/.emptyepsilon`) y su stdin es una consola Lua.

La dirección de producto es **standalone-first** (issue #219, ADR-0008, [`docs/ROADMAP_PRODUCTO.md`](docs/ROADMAP_PRODUCTO.md)):
el juego debe poder jugarse, guardarse y reanudarse sin Foundry VTT. La autoridad de campaña
(progreso, atlas, misiones, consecuencias) es del núcleo; la simulación es autoritativa para el
estado de la nave (posición, sistemas, daños). La integración con Foundry VTT para campañas tipo
*Spelljammer* (diseño en [`docs/FOUNDRY.md`](docs/FOUNDRY.md)) sigue siendo una línea de trabajo
activa, pero **opcional**: un **puente** intermedio con API limitada y versionada le proyecta un
subconjunto versionado del estado. Ante una funcionalidad nueva, pregunta primero «¿sigue siendo
jugable si Foundry desaparece?»; si no, pertenece al núcleo. Regla de
seguridad no negociable: el endpoint HTTP heredado `/exec.lua` (`src/httpScriptAccess.cpp`) ejecuta
Lua arbitrario recibido por red y **nunca** se expone a Foundry, a una LAN no confiable ni a
Internet; `/get.lua` y `/set.lua` están además marcados como incompletos.

## Comandos

Estructura esperada (SeriousProton como hermano; detalle en [`docs/BUILDING.md`](docs/BUILDING.md)):

```text
padre/
├── SeriousProton/
└── espaciokooplagunak/
```

```bash
# Configurar y compilar (Linux; requiere cmake, ninja, libsdl2-dev)
cmake -S . -B build -G Ninja -DSERIOUS_PROTON_DIR=../SeriousProton -DWARNING_IS_ERROR=1
cmake --build build --parallel

# Validar sintaxis de todos los escenarios Lua (equivalente al job LuaTest de CI; requiere lua5.3)
find scripts -type f -iname '*.lua' -print0 | xargs -0 -n 1 luac -p
```

`.luarc.json` (raíz) configura lua-language-server: `diagnostics.globals` contiene
únicamente las globales que el runtime registra con `setGlobal("...")` en `src/` —
nunca nombres observados en escenarios, que ocultarían erratas ejecutables. El test
`tools/tests/test_luarc_globals.py` hace cumplir ese contrato (y, con
`lua-language-server` en el PATH, verifica el comportamiento focal). Si añades API
nueva que se inyecte como global, regístrala en C++ y añádela a la lista; el test
fallará si la lista contiene nombres sin binding. Los diagnósticos restantes en
escenarios upstream (`need-check-nil`, `undefined-field`, `undefined-global` de
estado opcional comentado…) son ruido honesto por falta de anotaciones `---@meta` —
pendiente para Fase 4/5; no los «arregles» en escenarios upstream.

Hay TRES suites de tests propias del fork — ejecútalas siempre que toques su área, y no
confundas «no está en CI todavía» con «no existe»:

```bash
# C++ (CTest): codec y almacén del editor de contenido. EN CI: docker/build.sh
# configura BUILD_CONTENT_RESOURCE_TESTS=ON y ejecuta ctest en el job Linux.
cmake -S . -B build -G Ninja ... -DBUILD_CONTENT_RESOURCE_TESTS=ON
ninja -C build content_resource_tests content_library_store_tests && ctest --test-dir build -R content

# Python (pytest): el puente, con el juego mockeado — no necesita EmptyEpsilon vivo.
# EN CI: job pytest del workflow Docker (.github/workflows/docker.yml).
cd bridge && pip install -r requirements-dev.txt && pytest

# Node (node --test): lógica pura del módulo Foundry (sin Foundry real).
# EN CI: .github/workflows/foundry-module.yml.
node --test foundry-module/tests/*.test.mjs
```

La CI actual: `cicd.yml` ejecuta builds Linux (con el CTest anterior dentro de
`docker/build.sh`) / macOS / Windows-cross, más `luac -p` sobre `scripts/` (job LuaTest);
`docker.yml` construye ambas imágenes, corre el pytest del puente, verifica que compose no
publica el puerto de `/exec.lua` (job `guardia-exec-lua`) y hace smoke test headless del
escenario propio del fork — también en PRs que tocan `src/**`; `foundry-module.yml`
corre la suite Node; `tools.yml` prueba los scripts de `tools/`; `codeql.yml` analiza;
`docker-publish.yml` publica en GHCR solo con tag `v*` o dispatch (actions fijadas por SHA
— mantén ese fijado al actualizar versiones). Lo que ninguna suite cubre se prueba a mano
tras compilar: localizar el binario
bajo `build/`, crear partida local y, si el cambio toca red/multijugador, conectar al menos
dos estaciones — documentando escenario, pasos y resultado en el PR.

No añadas al repositorio `options.ini`, `keybindings.json`, logs ni directorios de build.

## Arquitectura

- `src/` — juego en C++ sobre SeriousProton. Áreas principales: `screens/` (pantallas por puesto de
  tripulación: mando, ingeniería, ciencia…), `gui/` (toolkit propio, widgets `gui2_*`), `spaceObjects/`
  y `components/` (entidades de la simulación), `multiplayer/`, `ai/` (facciones controladas por IA),
  `menus/`, `hardware/` (integración con hardware físico de puente), `httpScriptAccess.*` (la API
  HTTP heredada — ver advertencia de seguridad arriba; para QA en localhost: `httpserver=<puerto>`
  la activa, `/exec.lua` ejecuta el POST y devuelve su `return` o `{"ERROR": ...}`, y `/get.lua`
  NO está implementado — devuelve el literal `TODO`).
- `scripts/` — escenarios Lua (`scenario_*.lua`), la API Lua expuesta a misiones en `scripts/api/`,
  y utilidades reutilizables (`comms_*.lua`, `*_scenario_utility.lua`). La **crisis multipuesto**
  (#484, `lagunak_crisis_scenario_utility.lua`, doc en
  [`docs/CRISIS_MULTIPUESTO.md`](docs/CRISIS_MULTIPUESTO.md)) es una utilidad, no una parte del
  escenario 90: el escenario solo despacha el arquetipo `ambush` y avanza las crisis vivas. Su regla
  de diseño es que la coordinación sea una **cadena** y no cuatro tareas paralelas —comunicaciones
  sostiene el parlamento, sin el cual el escaneo se borra; sensores identifica al buque trampa entre
  tres cascos idénticos; armas dispara al correcto y matar a un señuelo es la forma de perder—, y que
  la necesidad del cuarto puesto no se finja: ingeniería gana la frecuencia de escudos revelada por
  el escaneo, pero eso depende de un ajuste de servidor que el anfitrión puede apagar, así que no
  se le cuelga ninguna condición de victoria. No añade ninguna orden nueva al puente ni a la matriz
  de autoridad: las cuatro que la resuelven ya existían.
- `script_docs/` — generador de `script_reference.html` (heredado de upstream) con una divergencia
  propia (issue #87): highlight.js va vendorizado en `script_docs/vendor/` y `main.py` lo incrusta
  inline vía la etiqueta `{{inline ...}}` en vez de cargarlo de un CDN sin `integrity` (alertas
  CodeQL 8/9); la salida sigue siendo un único HTML autocontenido que funciona offline. Vigila esta
  divergencia al mergear cambios de upstream que toquen `script_docs/`.
- `foundry-module/` — unos cincuenta módulos ESM con una suite Node por área. La arquitectura por
  grupos —orquestación, ventanas, puente, puestos, arte, minijuegos, andar por la nave, catálogos…—
  vive en [`docs/arquitectura/foundry-module.md`](docs/arquitectura/foundry-module.md), que es donde
  hay que documentar un módulo nuevo. Reglas transversales que no se negocian por área: `main.mjs`
  es un orquestador puro y la barra de escena tiene UN solo injerto (`control-escena.mjs`); la
  matriz de autoridad vive en `station-actions.mjs` y el puesto se resuelve del `User`, nunca de la
  orden (#237); y los colores van solo en `paleta.mjs`.
- `resources/` y `packs/` — assets heredados de upstream.
- La versión se calcula por fecha (`AAAA.MM.DD`) en `CMakeLists.txt` salvo override explícito.
- `docs/` — documentación propia del fork: [`BUILDING.md`](docs/BUILDING.md),
  [`UPSTREAM.md`](docs/UPSTREAM.md), [`FOUNDRY.md`](docs/FOUNDRY.md),
  [`BASELINE.md`](docs/BASELINE.md) (índice AECF del issue #88: qué prácticas de
  seguridad/accesibilidad/calidad/fiabilidad están adoptadas, cuáles cortadas y
  por qué — la regla de admisión es "solo se abre issue cuando duele y cabe en
  un PR", y el cumplimiento se convierte en gate de CI, no en ceremonia),
  [`docs/adr/`](docs/adr/README.md) (registro de decisiones de arquitectura ya
  tomadas, formato MADR; las propuestas siguen siendo issues),
  [`ASSESSMENT-ARQUITECTURA.md`](docs/ASSESSMENT-ARQUITECTURA.md) (evaluación
  ATAM-lite/ISO 42010) y [`AECF-METRICAS.md`](docs/AECF-METRICAS.md) (madurez
  AECF, escala M0–M5).

## Flujo git

- `origin` = `VaroTv7/espaciokooplagunak`; `upstream` = `daid/EmptyEpsilon`. Nunca apuntes `upstream`
  a otro sitio ni incluyas tokens en URLs de remotos.
- Ramas desde `main`: `feature/`, `fix/`, `docs/`, `test/`, `chore/`, `upstream/`. Todo llega a
  `main` por pull request.
- Sincronización con EmptyEpsilon: rama dedicada `upstream/AAAA-MM-DD`, `git merge --no-ff
  upstream/master`, **nunca** mezclada con funcionalidades propias, siempre revisada por PR —
  procedimiento completo en [`docs/UPSTREAM.md`](docs/UPSTREAM.md).
- Commits breves, imperativos y con prefijo: `feat(scenario): …`, `fix(network): …`, `docs: …`.
- El issue es el contrato de alcance; el PR es el registro de implementación y verificación. Antes
  de trabajar, revisa issues/PRs/ramas existentes para no duplicar.
- **Quién aprueba.** `.github/CODEOWNERS` pone a `@VaroTv7` y `@eGurucharri` como revisores de todo,
  y `main` exige la aprobación de un code owner. GitHub **no cuenta al autor**, así que un PR abierto
  por uno solo lo puede aprobar el otro, y abrir una tanda entera con la misma cuenta deja a esa
  cuenta sin poder firmar ninguno. Tenlo en cuenta al elegir con qué cuenta se abre; el estado real
  se ve con `gh pr view <n> --json mergeStateStatus,reviewDecision` — un `CLEAN` con CI en verde
  puede seguir parado en `REVIEW_REQUIRED`.
- **Una rama sin PR no es trabajo a salvo, pero tampoco es trabajo perdido.** Borrar un worktree
  **no** borra su rama: lo confirmado no se pierde al limpiar, y lo único en riesgo es lo que no
  está confirmado.
- **Antes de rescatar una rama huérfana, pregunta si su trabajo ya está en `main`.** No basta con
  que la rama esté limpia y el CI verde: si sale de un worktree anterior a trabajo que después
  entró por otra vía, el rescate **revierte** ese trabajo — y el CI sale verde porque la rama se
  lleva por delante también los tests que lo detectarían. Código y suite quedan coherentes entre sí,
  en el estado antiguo, y ninguna guarda del repositorio ve eso. Se comprueba antes de leer nada más:

  ```bash
  git log --oneline origin/main -- <los ficheros que toca>   # ¿es reciente lo que hay en main?
  git diff origin/main...<rama> | grep '^-' | grep -v '^---' # ¿borra código o tests?
  ```

  Si lo segundo borra lo que lo primero dice que es reciente, es una reversión: ciérrala y abre lo
  que quede pendiente como tarjeta nueva **contra el estado actual**.

## Estilo

Se mantienen las convenciones de EmptyEpsilon: miembros con guion bajo (`zoom_level`), clases en
`HighCamelCase` (`GuiSlider`), funciones en `lowCamelCase` (`getZoomLevel`). Escenarios y lógica de
misión en Lua. No mezcles reformateos masivos con cambios funcionales.

Toda feature nueva se diseña modular desde el principio, no se extrae después: un archivo nuevo por
responsabilidad (settings/hooks, UI de una ventana, lógica pura testeable, modelos de datos), en vez
de crecer un archivo existente hasta que haga falta un PR de "modularizar X" (como el #283 en
`foundry-module/scripts/main.mjs` o la extracción de `bridge/app.py` en middleware/rate
limit/modelos). Si una pieza es lógica pura sin dependencias de Foundry/FastAPI/DOM, vive en su
propio módulo testeable desde Node/pytest sin mockear el framework — el patrón ya establecido en
`ventana-nave.mjs`, `mapa-render.mjs` y `command_models.py`.

Actualiza `README.md` (estado/roadmap/características) solo cuando un cambio esté integrado en
`main` y verificado — nunca marques tareas como hechas por el mero hecho de haber escrito código.

Un objetivo numérico se cierra con **la cifra medida**, no con los tests en verde. Si una tarea pide
subir la cobertura de un módulo, el criterio es el porcentaje que imprime
`node --test --experimental-test-coverage` (o `pytest --cov`) **después** del cambio, y hay que
pegarlo en el PR. No es teórico: ya han aparecido ramas con toda su batería en verde —decenas de
tests— que dejaban la cobertura igual o **peor**, por sobrescribir un fichero de test existente con
otro más corto. Un fichero de test que **encoge** en un diff es la señal a mirar:

```bash
gh pr view <n> --json files --jq '.files[]|select(.path|test("test"))|select(.deletions > .additions)'
```

Y una cifra a medias no cierra el objetivo: si el encargo pide 88 % y la rama llega al 85 %, eso es
una tarjeta nueva con el número real medido, no un criterio cumplido.

## Mantenimiento de la documentación

La documentación se queda obsoleta silenciosamente (un refactor mecánico como el del PR #283 cambia
rutas que otro documento describe en prosa, sin que ningún test lo detecte). Al fusionar un cambio a
`main`, revisa si toca actualizar:

- **`README.md`** — marcar casillas del roadmap solo si el criterio de salida de la fase ya está
  verificado en `main` (no en un PR abierto); añadir a "Características propias" solo lo integrado.
- **`CLAUDE.md` y [`docs/arquitectura/`](docs/arquitectura/)** — describen rutas y
  responsabilidades de archivos concretos; una extracción, renombrado o movimiento de archivo las
  deja desactualizadas de inmediato. Un módulo nuevo del módulo Foundry se documenta en
  [`docs/arquitectura/foundry-module.md`](docs/arquitectura/foundry-module.md), **no** en
  `CLAUDE.md`: ese archivo entra entero en el contexto de cada agente en cada sesión y era el punto
  de colisión número uno del repositorio. Corrígelas en el mismo PR que mueve el código, no en uno
  aparte.
- **`docs/BASELINE.md`** y **`docs/AECF-METRICAS.md`** — si el cambio activa, corta o mueve de estado
  una práctica AECF (seguridad/accesibilidad/calidad/fiabilidad), o cambia qué gate de CI la vigila.
- **`docs/adr/`** — un ADR registra una decisión ya tomada y verificada; no se edita retroactivamente
  salvo error, se añade uno nuevo si la decisión cambia (ver `docs/adr/README.md`).
- **Documentos de investigación** (p. ej. `docs/ATLAS_SPELLJAMMER.md`) — permanecen "a validar" hasta
  que Varo y Eloy cierren la decisión en su issue; no los promuevas a hecho por iniciativa propia.

Regla general: el PR que cambia el código es también el lugar de corregir la prosa que ese código
invalida — no una tarea de "documentación" aparte que se pospone.

## `SeriousProton::string::find` devuelve `int`, y `-1` es "no encontrado"

`SeriousProton::string` (en `SeriousProton/src/stringImproved.h`) redefine `find` con firma
`int find(std::string_view sub, int start=0) const`: devuelve `int`, no `size_t`, y **`-1`**
cuando no encuentra, no `std::string::npos`. La propia cabecera se apoya en ello
(`if (find('\n') > -1 && ...)`), igual que `strip`, `split` y `replace`.

Consecuencias al tocar C++ de este repositorio:

- El idioma del repositorio es `find(...) > -1` (o `!= -1`). Escribir `!= std::string::npos`
  **no** es un bug: el `-1` convertido a `size_t` es exactamente `npos`, así que da el mismo
  resultado. Es peor por otro motivo — sugiere una semántica de `std::string` que esta clase
  no tiene, y ya ha provocado dos PRs de "arreglo" que eran no-ops (#605 y #607). Por eso se
  escribe `> -1` siempre: no por corrección, por legibilidad.
- No es un descuido de upstream que haya que "arreglar": cambiarlo rompería todos los usos
  existentes. Si molesta la constante mágica, es una propuesta para upstream
  (ver [ADR-0007](docs/adr/0007-frontera-upstream.md)), no un cambio local.
- `std::string::find` sigue comportándose como siempre; la excepción es sólo la clase de
  SeriousProton, así que hay que mirar el tipo antes de asumir.
