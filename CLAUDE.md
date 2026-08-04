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
  y utilidades reutilizables (`comms_*.lua`, `*_scenario_utility.lua`).
- `script_docs/` — generador de `script_reference.html` (heredado de upstream) con una divergencia
  propia (issue #87): highlight.js va vendorizado en `script_docs/vendor/` y `main.py` lo incrusta
  inline vía la etiqueta `{{inline ...}}` en vez de cargarlo de un CDN sin `integrity` (alertas
  CodeQL 8/9); la salida sigue siendo un único HTML autocontenido que funciona offline. Vigila esta
  divergencia al mergear cambios de upstream que toquen `script_docs/`.
- `foundry-module/` — unos cincuenta módulos ESM con una suite Node por área. Aquí van los grupos y
  la regla de cada uno, no el inventario: `ls foundry-module/scripts` es más fiable que una lista en
  prosa, y la responsabilidad es lo que no se deduce del nombre del archivo.
  - **Orquestación** — `scripts/main.mjs` es un orquestador puro (settings, hooks, scene controls):
    no contiene lógica de dominio. Constantes compartidas en `scripts/lagunak-constantes.mjs`.
  - **Ventanas** — las cuatro factorías originales (estado de nave y mapa vivo, V1/V2, aisladas a
    propósito entre sí) siguen en `scripts/estado-nave-app-v{1,2}.mjs` y
    `scripts/mapa-vivo-app-v{1,2}.mjs` (extracción del PR #283) y abren sus ventanas sueltas de
    siempre desde los controles de escena. **Consola caliente del GM** (#276,
    `docs/CONSOLA_CALIENTE_GM.md`): en hosts con `ApplicationV2` (v12+) hay además
    `scripts/consola-caliente-v2.mjs`, que fusiona estado + mapa + encuentros en pestañas con UN
    solo bucle de sondeo y backoff — el bucle en sí (cadencia, backoff, conteo de fallos, y el
    reparto de un ciclo en `conexion` global solo-`healthz` + estado por pestaña que no se contagia
    entre sí) es lógica pura y probada en Node en `scripts/consola-caliente-poll.mjs`. Entrega
    parcial: solo se fusionó V2 (V1 se queda con sus dos ventanas sueltas, decisión explícita del
    propio documento de spec — "¿V1 se fusiona o se congela?") y solo tres pestañas (Estado, Mapa,
    Encuentros); la cuarta pestaña de previsualización por puesto (paso 4, migrar la rama `isGM` de
    `station-workspaces.mjs`) no se hizo. Los botones de escena de estado/mapa sueltos tampoco se
    retiraron: la consola fusionada convive con ellos como una entrada más, no los sustituye
    todavía. `scripts/foco-render.mjs` conserva el foco entre reconstrucciones del DOM (#227).
  - **Mapa vivo** — lógica pura en `scripts/ventana-nave.mjs`, pintor Canvas en
    `scripts/mapa-render.mjs`, con `scripts/decorado-fondo.mjs` y `scripts/nave-sprite.mjs`. El
    mapa interpola únicamente muestras confirmadas y **nunca** extrapola.
  - **Puente** — `scripts/bridge-client.mjs`, el token en
    `scripts/bridge-token-session.mjs` (solo en memoria y solo para el GM: `getBridgeToken()`
    devuelve cadena vacía a quien no lo sea, y el valor legado en almacenamiento se borra en el
    arranque, #183) y `scripts/diagnostico-conexion.mjs`.
  - **Controles del GM** — un módulo por superficie: `scripts/{tempo,pausa,ingenieria,maniobra,
    reposicion,encuentro}-control.mjs`. Todos solo-GM y de catálogo cerrado.
  - **Puestos de tripulación** — `scripts/station-*.mjs`. La matriz de autoridad vive en
    `scripts/station-actions.mjs` y el relé que la aplica en `scripts/station-order-relay.mjs`: el
    puesto se resuelve desde el `User` autenticado, nunca desde la orden (#237).
  - **Eventos y ambiente** — `scripts/event-journal.mjs` (deduplicado por `eventId`),
    `scripts/bitacora-nave.mjs`, `scripts/alertas-nave.mjs` y el nivel de alerta difundido a toda
    la mesa (`scripts/nivel-alerta.mjs`, `scripts/alerta-escena.mjs`, #338).
  - **Telemetría a modelo visual** — `scripts/ship-view.mjs` y `scripts/barras-estado.mjs`
    convierten el estado crudo en porcentajes y niveles de severidad, sin tocar el DOM: las
    plantillas de V1/V2 solo consumen su salida.
  - **Arte procedural** — generado en el cliente, cero binarios en el repositorio. Los colores viven
    **solo** en `scripts/paleta.mjs`, con la frontera vivo/registrado y una prueba que falla si otro
    módulo de arte declara un color propio (#351). Grabado en `scripts/laminas-clasicas.mjs`;
    pixelart en `scripts/nave-sprite.mjs`, `scripts/minijuegos/cartas-pixelart.mjs` y
    `scripts/minijuegos/fichas-pixelart.mjs` (volumen por planos de color, nunca degradados: el 3D
    del casco es otro lenguaje); música determinista por semilla en
    `scripts/musica-procedural.mjs`. El 3D de consola de los 90 vive en `scripts/retro3d*.mjs`
    (#362): motor puro que devuelve polígonos, pintor de lienzo aparte, y la **época** (PSX o
    GameCube) como parámetro —rejilla, tonos y niebla— y no como dos módulos. El arte de ficha de
    naves narrativas (`scripts/ficha-nave.mjs`, con el codificador PNG puro de
    `scripts/png-indexado.mjs`) se genera **solo por clic del GM** y escribe el token prototipo:
    nunca sondea ni sincroniza posición, porque un documento persistente que espeje la simulación
    se queda mintiendo cuando cae el puente (#354).
  - **Minijuegos** — `scripts/minijuegos/` y su enganche en `scripts/minijuegos-wiring.mjs` (#308).
    `sesion-motor.mjs` es COMÚN a todos —identidad, época, nonces, lobby, espectadores, ausencias—
    y aloja cada juego por su interfaz interna; los verticales son hermanos suyos y no ramas dentro
    de él: `poker-motor.mjs` (#308) y `dados-motor.mjs` (#413, con su dado en 3D retro legible en
    `dados-3d.mjs`, que reusa `retro3d.mjs` sin tocarlo). El cableado los tiene en un CATÁLOGO POR
    NOMBRE y resuelve el vertical por el que declara la mesa en su estado público: con una variable
    única, dos mesas de juegos distintos se despacharían contra el motor equivocado. Un juego nuevo
    aporta motor, política de sus NPC, configuración de mesa (si necesita) y ventana — nada más.
    La sesión viva del coordinador no se persiste en ningún sitio: vive en memoria del GM.
    La entrada única es la **cantina** (`scripts/cantina.mjs`, catálogo puro de "puertas";
    `scripts/cantina-app.mjs`, la ventana V1/V2, #423): sustituye a los botones de mesa sueltos en
    los controles de escena, y una mesa nueva se añade como una entrada más del catálogo, no como
    un botón nuevo en `main.mjs`. La cantina solo pinta y traduce un clic en "abre esa mesa" — la
    autoridad la sigue resolviendo cada mesa por su cuenta al abrirse, nunca la ventana que lleva
    hasta ella.
  - **Sección de la nave** — `scripts/seccion-nave.mjs` (planta declarativa y consultas, puro),
    `scripts/seccion-lienzo.mjs` (pintado 2D, sin color propio) y `scripts/seccion-nave-app.mjs`
    (ventana V1/V2), #427. El corte transversal con todas las salas a la vez: es el MAPA, y la
    cantina es ESTAR dentro. Pulsar una sala abre la vista que ya existe (cantina o consola de
    puesto) — la sección no estrena ninguna. No da autoridad (#237: el puesto se lee para saber
    dónde pintarte, nunca al revés) y no inventa lecturas (sin sondeo la sala va neutra, no en
    cero). Una sala nueva es una entrada más de la planta, no un botón nuevo en `main.mjs`.
  - **Visor del piloto** — `scripts/visor-piloto.mjs` (geometría pura) y
    `scripts/visor-piloto-lienzo.mjs` (el <canvas>), #362. Lo que la nave tiene delante, en PSX,
    en la consola de pilotaje. Es la primera superficie 3D del módulo que **informa** en vez de
    ambientar, y de ahí sus tres reglas: la distancia y la marcación siguen en **texto** —el
    visor es refuerzo y va `aria-hidden`, y pilotaje arma la lista de contactos desde la misma
    lectura degradada para que ese texto exista de verdad, degradada también para el GM—; la
    profundidad está **comprimida** (monótona, no
    proporcional: conserva el orden, no es un telémetro); y el **margen se dibuja** —un eco de
    banda larga sale como un bloque gris tan ancho como su incertidumbre, nunca con la silueta
    afilada de un contacto identificado—. Todo cae en un plano porque la simulación es 2D:
    repartir en vertical sería inventar altura. Lee la MISMA lectura degradada que ya se difunde
    a la tripulación (`contactos-degradados.mjs`), así que no abre ningún dato nuevo. Sin sondeo
    se apaga y limpia (#353); un sondeo vacío sí se pinta, porque «he mirado y no hay nada» es un
    dato. No hay bucle de animación: se repinta con cada telemetría y por eso
    `prefers-reduced-motion` no tiene nada que frenar.
  - **Asistencia entre puestos** — `scripts/asistencia/` (#309, diseño en
    [`docs/MINIJUEGOS_ASISTENCIA.md`](docs/MINIJUEGOS_ASISTENCIA.md)): motor puro más el reductor
    `sesion.mjs` y la costura `relevo.mjs`. Ayudar NUNCA emite orden: produce un token que gasta el
    **titular** del puesto asistido como una de sus órdenes ya autorizadas, vía relé (#237) — el
    consumo se cuelga de ese camino y no abre otro hacia el puente. Una ayuda caducada o ajena no
    bloquea la orden del titular: la asistencia es bonus, no peaje.
    **Contenido**: `asistencia/catalogo.mjs` declara las tareas base (ingeniería, pilotaje y una
    narrativa de sensores) y `crearCatalogo()` deja que una mesa traiga las suyas sin tocar el motor;
    una tarea rota revienta al importar, no en mitad de una crisis.
    **Cableado**: `asistencia-wiring.mjs`. El asistente pide por flag de su propio `User`, el GM
    coordinador resuelve en `updateUser` y responde por socket dirigido; la sesión vive **en memoria
    del GM** a propósito —caduca en dos minutos, no es dato de partida—. El consumo se engancha al
    relé por `prepareOrder`, que solo puede mover un parámetro dentro del rango ya autorizado: no es
    una puerta de autoridad y no debe convertirse en una. Dos ajustes de mundo, cerrados por defecto:
    gastar recursos de la ficha y la regla de la casa del 1/20 natural.
    **Falta la interfaz** (ventana del asistente y barra de temporización): hoy el camino está
    completo de extremo a extremo pero no hay dónde pulsar.
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

## Mantenimiento de la documentación

La documentación se queda obsoleta silenciosamente (un refactor mecánico como el del PR #283 cambia
rutas que otro documento describe en prosa, sin que ningún test lo detecte). Al fusionar un cambio a
`main`, revisa si toca actualizar:

- **`README.md`** — marcar casillas del roadmap solo si el criterio de salida de la fase ya está
  verificado en `main` (no en un PR abierto); añadir a "Características propias" solo lo integrado.
- **`CLAUDE.md`** — la sección `## Arquitectura` describe rutas y responsabilidades de archivos
  concretos; una extracción/renombrado/movimiento de archivo (como #283 o la modularización de
  `bridge/app.py`) la deja desactualizada de inmediato. Corrígela en el mismo PR que mueve el código,
  no en uno aparte.
- **`docs/BASELINE.md`** y **`docs/AECF-METRICAS.md`** — si el cambio activa, corta o mueve de estado
  una práctica AECF (seguridad/accesibilidad/calidad/fiabilidad), o cambia qué gate de CI la vigila.
- **`docs/adr/`** — un ADR registra una decisión ya tomada y verificada; no se edita retroactivamente
  salvo error, se añade uno nuevo si la decisión cambia (ver `docs/adr/README.md`).
- **Documentos de investigación** (p. ej. `docs/ATLAS_SPELLJAMMER.md`) — permanecen "a validar" hasta
  que Varo y Eloy cierren la decisión en su issue; no los promuevas a hecho por iniciativa propia.

Regla general: el PR que cambia el código es también el lugar de corregir la prosa que ese código
invalida — no una tarea de "documentación" aparte que se pospone.
