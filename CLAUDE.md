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
adaptativo v11/v12/v13 (`foundry-module/`) y editor de contenido del GM. En desarrollo, aún SIN
fusionar: el asistente de instalación (`tools/instalar.py` + `docs/INSTALACION.md`, rama
`feature/asistente-instalacion`, PR #68 — no existen en `main` todavía) y el **mapa vivo** (ventana GM
Neo Geo: starfield parallax + blips de `/v1/contacts`; PR #73, rama `feature/mapa-vivo-nave`, que
depende de #69, `/v1/contacts` en el puente, ya fusionado). Patrón del mapa vivo: lógica pura en
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

No hay suite de tests unitarios: la CI (`.github/workflows/cicd.yml`) son builds Linux/macOS/
Windows-cross más el `luac -p` anterior. Tras compilar, la prueba es manual: localizar el binario
bajo `build/`, crear partida local y, si el cambio toca red/multijugador, conectar al menos dos
estaciones — documentando escenario, pasos y resultado en el PR.

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
- `resources/` y `packs/` — assets heredados de upstream.
- La versión se calcula por fecha (`AAAA.MM.DD`) en `CMakeLists.txt` salvo override explícito.
- `docs/` — documentación propia del fork: [`BUILDING.md`](docs/BUILDING.md),
  [`UPSTREAM.md`](docs/UPSTREAM.md), [`FOUNDRY.md`](docs/FOUNDRY.md).

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
