# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Lectura obligatoria

Este repositorio ya define un contrato operativo para agentes de IA en [`AGENTS.md`](AGENTS.md) —
léelo antes de modificar nada; sus reglas prevalecen sobre cualquier hábito por defecto. Las que más
condicionan el trabajo diario:

- No desarrolles sobre `main`: crea rama y entrega por pull request (flujo en [`CONTRIBUTING.md`](CONTRIBUTING.md)).
- No afirmes que algo compila, arranca o funciona si no has ejecutado la comprobación correspondiente.
- Nada de `push --force`, `reset --hard`, squash del historial heredado ni reescritura de historial
  sin autorización humana explícita.
- No instales paquetes del sistema sin autorización humana.
- No presentes código de EmptyEpsilon como creación de este fork.
- Cada entrega debe resumir: objetivo/issue, archivos cambiados, decisiones, comandos de prueba
  ejecutados con su resultado, comprobaciones pendientes y riesgos.

## Qué es

Espaciokoop Lagunak es un fork comunitario de [EmptyEpsilon](https://github.com/daid/EmptyEpsilon),
simulador cooperativo de puente de mando espacial: C++17 + CMake, motor
[SeriousProton](https://github.com/daid/SeriousProton) (repo hermano, NO submódulo) + SDL2, y
escenarios/lógica de misión en Lua.

**Fase actual: 3 — integración prioritaria con Foundry VTT** (fases 0–2 completadas; roadmap completo
en el README, fases 0–5). Ya hay: escenario propio (`scenario_90_lagunak_primera_guardia.lua`),
compilación reproducible (nativa y Docker), puente seguro con contrato v0 (`bridge/`), módulo Foundry
adaptativo v11/v12/v13 (`foundry-module/`), editor de contenido del GM, asistente de instalación
(`tools/instalar.py` + `docs/INSTALACION.md`, PR #68), publicación de imágenes en GHCR con cada tag
`v*` (`docker-publish.yml`, PR #83 — el primer tag aún no existe, así que aún no hay imagen publicada)
y averías narrativas del GM mediante `set_system_health`, con coolant/repair_crew en `/v1/state`
(PR #81). En desarrollo, aún SIN fusionar: el **mapa vivo** (ventana GM Neo Geo: starfield parallax +
blips de `/v1/contacts`; PR #73, rama `feature/mapa-vivo-nave`, bloqueantes funcionales resueltos;
pendiente actualizar sobre `main`, conservar las regresiones de #72 y ejecutar la suite Node en CI
sobre el resultado combinado). Patrón del mapa vivo: lógica pura en
`ventana-nave.mjs` (testeable en Node, incl. `componerFrame` con tween SIN extrapolación entre muestras
confirmadas), pintor acoplado a canvas en `mapa-render.mjs` (verificación humana), ventanas V1/V2
aisladas en `main.mjs`. Pendiente en fase 3: gestión de motores/combustible/daños, puestos y permisos,
y encuentros inyectados por el GM.
Compilación verificada localmente (2026-07-12, Ubuntu 24.04, g++ 13.3, cmake 3.28.3, ninja 1.11.1,
SDL2 2.30.0): limpio con `WARNING_IS_ERROR=1` (539 objetivos), `luac -p` pasa sobre todo `scripts/`, y
`./build/EmptyEpsilon headless=scenario_10_empty.lua` arranca, carga el escenario y escucha en TCP/UDP
35666 (config en `~/.emptyepsilon`; stdin es consola Lua en headless).

La **prioridad estratégica** es la integración con Foundry VTT para campañas tipo *Spelljammer*
(diseño en [`docs/FOUNDRY.md`](docs/FOUNDRY.md)): Foundry es autoritativo para la narrativa
(personajes, diarios, escenas); este juego es autoritativo para la simulación de nave (posición,
sistemas, daños); un **puente** intermedio con API limitada y versionada conecta ambos. Regla de
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

Hay TRES suites de tests propias del fork — ejecútalas siempre que toques su área, y no
confundas «no está en CI todavía» con «no existe»:

```bash
# C++ (CTest): codec y almacén del editor de contenido. EN CI: docker/build.sh
# configura BUILD_CONTENT_RESOURCE_TESTS=ON y ejecuta ctest en el job Linux.
cmake -S . -B build -G Ninja ... -DBUILD_CONTENT_RESOURCE_TESTS=ON
ninja -C build content_resource_tests content_library_store_tests && ctest --test-dir build -R content

# Python (pytest): el puente, con el juego mockeado — no necesita EmptyEpsilon vivo.
# EN CI: job pytest del workflow Docker (.github/workflows/docker.yml, PR #74).
cd bridge && pip install -r requirements-dev.txt && pytest

# Node (node --test): lógica pura del módulo Foundry (sin Foundry real).
# EN CI: .github/workflows/foundry-module.yml (PR #77).
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
  NO está implementado — devuelve el literal `TODO`, verificado 2026-07-12).
- `scripts/` — escenarios Lua (`scenario_*.lua`), la API Lua expuesta a misiones en `scripts/api/`,
  y utilidades reutilizables (`comms_*.lua`, `*_scenario_utility.lua`).
- `script_docs/` — generador de `script_reference.html` (heredado de upstream) con una divergencia
  propia (issue #87): highlight.js va vendorizado en `script_docs/vendor/` y `main.py` lo incrusta
  inline vía la etiqueta `{{inline ...}}` en vez de cargarlo de un CDN sin `integrity` (alertas
  CodeQL 8/9); la salida sigue siendo un único HTML autocontenido que funciona offline. Vigila esta
  divergencia al mergear cambios de upstream que toquen `script_docs/`.
- `resources/` y `packs/` — assets heredados de upstream.
- La versión se calcula por fecha (`AAAA.MM.DD`) en `CMakeLists.txt` salvo override explícito.
- `docs/` — documentación propia del fork: [`BUILDING.md`](docs/BUILDING.md),
  [`UPSTREAM.md`](docs/UPSTREAM.md), [`FOUNDRY.md`](docs/FOUNDRY.md),
  [`BASELINE.md`](docs/BASELINE.md) (índice AECF del issue #88: qué prácticas de
  seguridad/accesibilidad/calidad/fiabilidad están adoptadas, cuáles cortadas y
  por qué — la regla de admisión es "solo se abre issue cuando duele y cabe en
  un PR", y el cumplimiento se convierte en gate de CI, no en ceremonia).

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

## Estilo

Se mantienen las convenciones de EmptyEpsilon: miembros con guion bajo (`zoom_level`), clases en
`HighCamelCase` (`GuiSlider`), funciones en `lowCamelCase` (`getZoomLevel`). Escenarios y lógica de
misión en Lua. No mezcles reformateos masivos con cambios funcionales.

Actualiza `README.md` (estado/roadmap/características) solo cuando un cambio esté integrado en
`main` y verificado — nunca marques tareas como hechas por el mero hecho de haber escrito código.
