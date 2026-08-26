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
- `foundry-module/` — unos cincuenta módulos ESM con una suite Node por área. Aquí van los grupos y
  la regla de cada uno, no el inventario: `ls foundry-module/scripts` es más fiable que una lista en
  prosa, y la responsabilidad es lo que no se deduce del nombre del archivo.
  - **Orquestación** — `scripts/main.mjs` es un orquestador puro (settings, hooks, scene controls):
    no contiene lógica de dominio. Constantes compartidas en `scripts/lagunak-constantes.mjs`.
    La barra de escena tiene UN solo injerto (#448): `scripts/control-escena.mjs` es el único sitio
    que conoce la diferencia de forma entre v11/v12 (arrays, `onClick`) y v13 (records, `order` +
    `onChange`) — estaba copiada verbatim en cinco registradores más `main.mjs`, que es el número de
    sitios que habría que arreglar el día que v14 la cambie. `main.mjs` decide QUÉ botones hay y
    quién los ve; nunca cómo se injertan. Un botón nuevo se añade como entrada de un catálogo de
    puerta existente (`scripts/puerta-catalogo.mjs`, y `panel-gm.mjs`/`cantina.mjs` como
    consumidores), no como una herramienta suelta más.
  - **Alcanzabilidad e inventarios** — `scripts/check_orphan_modules.py` (#701) es la única
    implementación del contrato: recorre el grafo desde los `esmodules` de `module.json`, acredita
    solo imports literales completos y clasifica cada módulo como `connected`, `declared-orphan` o
    `unknown`. Ante regex, templates, concatenaciones o sintaxis que el lexer reducido no pueda
    demostrar, debe preferir `unknown`; esa salida no rompe CI. La fuente declarativa única es
    [`docs/orphan-declarations.json`](docs/orphan-declarations.json): ahí viven tanto las
    declaraciones huérfanas —motivo, autoría, fecha, decisión de cimiento y evidencia— como
    `artModules` y la justificación de su frontera. Los tests Node
    `modulos-alcanzables.test.mjs` y `paleta.test.mjs` **consumen** ese JSON; no mantengas listas
    paralelas en ellos ni en esta guía. Los enlaces de evidencia a issues/PRs se verifican por la API
    de GitHub con timeout y token de solo lectura en CI; un 404 confirmado invalida la declaración y
    un fallo de red bloquea la verificación en vez de aceptar el enlace en silencio. Para declarar o
    reclasificar un módulo, edita el JSON y ejecuta
    `python3 scripts/check_orphan_modules.py --check` más las suites Python y Node del área.
  - **Ventanas** — **Consola caliente del GM** (#276, `docs/CONSOLA_CALIENTE_GM.md`) fusionó las
    cuatro factorías originales (estado de nave y mapa vivo, V1/V2) en una sola ventana con pestañas
    (Estado, Mapa, Encuentros, Previsualización) y UN solo bucle de sondeo y backoff, sustituyendo
    los botones sueltos de estado/mapa en los controles de escena — `main.mjs` abre
    `scripts/consola-caliente-v1.mjs` (Application clásica, v11) o `scripts/consola-caliente-v2.mjs`
    (ApplicationV2, v12+) según lo que ofrezca el anfitrión; ambas réplicas son deliberadamente
    AISLADAS entre sí (nada de clase o mixin compartido), con la disciplina que ya declaraban las
    cuatro factorías que sustituyen. El bucle en sí (cadencia, backoff, conteo de fallos, y el
    reparto de un ciclo en `conexion` global solo-`healthz` + estado por pestaña que no se contagia
    entre sí) es lógica pura y probada en Node en `scripts/consola-caliente-poll.mjs`. La pestaña de
    Previsualización (paso 4) migró la rama `isGM` de `station-workspaces.mjs`/`espacio-puesto.hbs`:
    el GM ve la consola de un puesto tal y como la vería su tripulante, con la misma
    `buildWorkspaceModel` pura; ese archivo ya no bifurca por rol para esa selección de puesto (sigue
    bifurcando por rol donde corresponde a autoridad real, como qué contactos ve un GM). Reabrir la
    consola reusa la instancia perezosa en vez de crear una segunda. `scripts/foco-render.mjs`
    conserva el foco entre reconstrucciones del DOM (#227).
  - **Mapa vivo** — lógica pura en `scripts/ventana-nave.mjs`, pintor Canvas en
    `scripts/mapa-render.mjs`, con `scripts/decorado-fondo.mjs` y `scripts/nave-sprite.mjs`. El
    mapa interpola únicamente muestras confirmadas y **nunca** extrapola.
  - **Puente** — `scripts/bridge-client.mjs`, el token en
    `scripts/bridge-token-session.mjs` (solo en memoria y solo para el GM: `getBridgeToken()`
    devuelve cadena vacía a quien no lo sea, y el valor legado en almacenamiento se borra en el
    arranque, #183) y `scripts/diagnostico-conexion.mjs`.
  - **Controles del GM** — un módulo por superficie: `scripts/{tempo,pausa,ingenieria,maniobra,
    reposicion,encuentro}-control.mjs`. Todos solo-GM y de catálogo cerrado. **Cinco de los seis
    están cableados**: la consola caliente importa `encuentro`, `pausa`, `ingenieria`, `maniobra` y
    `tempo` y `reposicion`. La reposición se cableó en #537, cuatro semanas después de escribirse: su
    commit original entregó puente, Lua, i18n, módulo puro y pruebas, y **ninguna superficie** — nació
    huérfana y la guarda de alcanzabilidad fue lo que la encontró. Va con el grupo de maniobra pero
    con su propio `<select>` + botón, porque es la única de esas órdenes que teletransporta y no debe
    parecerse a subir un punto de impulso. La disciplina que la hace segura sigue intacta: anclas
    **por nombre** desde `/v1/anchors`, validadas contra el catálogo antes de tocar la red, nunca
    coordenadas crudas (ADR-0002).
  - **Puestos de tripulación** — `scripts/station-*.mjs`. La matriz de autoridad vive en
    `scripts/station-actions.mjs` y el relé que la aplica en `scripts/station-order-relay.mjs`: el
    puesto se resuelve desde el `User` autenticado, nunca desde la orden (#237).
  - **Eventos y ambiente** — `scripts/event-journal.mjs` (deduplicado por `eventId`),
    `scripts/bitacora-nave.mjs`, `scripts/alertas-nave.mjs` y el nivel de alerta difundido a toda
    la mesa (`scripts/nivel-alerta.mjs`, `scripts/alerta-escena.mjs`, #338). El tinte del lienzo
    delegado en FXMaster es opcional y apagado por defecto (`scripts/filtros-escena.mjs`); el borde
    accesible del `<body>` no depende de él.
  - **Módulos ajenos** — el módulo no declara ninguna dependencia dura. Antes de añadir una, leer
    `docs/ECOSISTEMA_MODULOS_FOUNDRY.md`: recoge la regla de admisión (una dependencia puede degradar
    la presentación y nunca la autoridad), los descartes ya razonados —socketlib, sequencer/JB2A,
    documentos `Cards`— y por qué FXMaster es la única integración aceptada. La regla de admisión
    está registrada en [ADR-0013](docs/adr/0013-frontera-de-licencias-y-procedencia.md).
  - **Telemetría a modelo visual** — `scripts/ship-view.mjs` y `scripts/barras-estado.mjs`
    convierten el estado crudo en porcentajes y niveles de severidad, sin tocar el DOM: las
    plantillas de V1/V2 solo consumen su salida.
  - **Arte procedural** — generado en el cliente, cero binarios en el repositorio, y los colores
    **solo** en `scripts/paleta.mjs`, con una prueba que falla si otro módulo de arte declara un color
    propio (#351). La doctrina completa —incluida la regla de que el ornamento no puede abrir por
    detrás la lectura falsa que la superficie cierra por delante (#526)— está en
    [ADR-0014](docs/adr/0014-doctrina-de-arte-procedural.md); esto es solo dónde vive cada cosa.
    Grabado en `scripts/laminas-clasicas.mjs`, cuyo único consumidor es `scripts/mapa-marco.mjs`
    (#526): el marco va **alrededor** del visor y no encima, y apaga a propósito los tics del limbo y
    la rosa de los vientos, que sobre un instrumento que sí se lee serían una escala y una marcación
    inventadas. Las dos opciones (`tics`, `rosa`) siguen ENCENDIDAS por defecto, así que la lámina
    completa es el registro de serie para el resto del módulo.
    Pixelart en `scripts/nave-sprite.mjs`, `scripts/minijuegos/cartas-pixelart.mjs` y
    `scripts/minijuegos/fichas-pixelart.mjs` (volumen por planos de color, nunca degradados: el 3D del
    casco es otro lenguaje); música determinista por semilla en `scripts/musica-procedural.mjs`.
    El 3D de consola de los 90 vive en `scripts/retro3d*.mjs` (#362): motor puro que devuelve
    polígonos, pintor de lienzo aparte, y la **época** (PSX o GameCube) como parámetro —rejilla, tonos
    y niebla— y no como dos módulos. La **visibilidad no es un parámetro de época** (#510): quién tapa
    a quién es una garantía geométrica del motor y vale para las dos consolas, así que fundir piezas
    en una escena se hace con `fundirEscenas(...)` y no con el `flatMap` + `sort` que ocho consumidores
    copiaban. Ese orden es hoy por centroide de cara y es la **deuda viva de #510** —empata entre caras
    que se tocan, que es el parpadeo que ve QA—; lo ya intentado y descartado está escrito en la
    cabecera de `retro3d.mjs` para no repetirlo por cuarta vez.
    El arte de ficha de naves narrativas (`scripts/ficha-nave.mjs`, con el codificador PNG puro de
    `scripts/png-indexado.mjs`) se genera **solo por clic del GM** y escribe el token prototipo: nunca
    sondea ni sincroniza posición, porque un documento persistente que espeje la simulación se queda
    mintiendo cuando cae el puente (#354).
  - **Minijuegos** — `scripts/minijuegos/` y su enganche en `scripts/minijuegos-wiring.mjs` (#308).
    La mesa de blackjack (#553) añade una **lectura** aparte de la vista
    (`minijuegos/blackjack-lectura.mjs`): qué pasa ahora, en qué estado va cada asiento y las reglas
    de la casa. Es solo PALABRAS —no concede nada, las acciones siguen viniendo del coordinador— y
    su regla dura es que el cartel de reglas se DERIVA de las constantes del motor
    (`LIMITE_PLANTADO_BANCA`, `PAGO_BLACKJACK`, `CARTAS_PARA_DOBLAR`), nunca se escribe al lado: un
    cartel escrito a mano no falla, se desincroniza, y sigue anunciando cómo se jugaba antes.
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
  - **Generador de NPC** — `scripts/npc-tablas.mjs` (tablas propias) y `scripts/npc-generador.mjs`
    (motor puro), #676. Semilla más valor de desafío dan una ficha completa, y la misma semilla da
    siempre el mismo NPC. Cuatro capas y **una sola importable**: la ficha 5e sale del SRD 5.1, y de
    Shin Megami Tensei, Persona, Pokémon y Argon HUD se toma solo la mecánica o la forma del dato —la
    frontera y su porqué, en [ADR-0013](docs/adr/0013-frontera-de-licencias-y-procedencia.md), que es
    también donde vive la incompatibilidad GPL-3.0/GPL-2.0 con `enhancedcombathud`. La puerta va
    **codificada**: `npc-tablas.test.mjs` recorre cada cadena que el generador puede emitir —tablas y
    trescientas fichas generadas— y falla si aparece un término de esas obras.
    Dos reglas del motor: la matriz de efectividad se **deriva** de lo que cada elemento declara en
    vez de escribir veintiocho casillas, y un elemento desconocido **falla** en vez de valer ×1, que
    convertiría una errata en un NPC inmune a nada sin que saltara ninguna alarma.
    Es **cimiento declarado**: nadie lo importa todavía porque *recordar* a quién has conocido es del
    núcleo y no de la escena (ADR-0012), el mismo reparto que #598 dejó abierto para el bestiario.
    Ver [docs/NPC_GENERADOR.md](docs/NPC_GENERADOR.md).
  - **Sección de la nave** — `scripts/seccion-nave.mjs` (planta declarativa y consultas, puro),
    `scripts/seccion-lienzo.mjs` (pintado 2D, sin color propio) y `scripts/seccion-nave-app.mjs`
    (ventana V1/V2), #427. El corte transversal con todas las salas a la vez: es el MAPA, y la
    cantina es ESTAR dentro. Pulsar una sala abre la vista que ya existe — la sección no estrena
    ninguna: la cantina abre su ventana propia (#423) y el puente e ingeniería se entran ANDANDO
    (`destino: "andar"` + `estancia`, #508), apareciendo dentro de la nave recorrible en vez de
    abriendo la consola del puesto por botón; la consola queda a un paso, dentro de su sala (#509).
    La `estancia` es un id OPACO para la sección: lo declara y lo transporta, pero quien lo resuelve
    contra `nave-catalogo-andar.mjs` es `main.mjs` — un test comprueba que toda `estancia` declarada
    exista de verdad en ese catálogo. No da autoridad (#237: el puesto se lee para saber
    dónde pintarte, nunca al revés) y no inventa lecturas (sin sondeo la sala va neutra, no en
    cero). Una sala nueva es una entrada más de la planta, no un botón nuevo en `main.mjs`.
  - **Andar por la nave** — `scripts/nave-movimiento.mjs` (colisión círculo-caja y el paso continuo,
    puro), `scripts/nave-estancias.mjs` (contrato de estancia: planta + composición + puertas +
    consolas, y `resolverArranque`) y `scripts/nave-movimiento-lienzo.mjs`/`nave-movimiento-red.mjs`
    (bucle de render y sincronización de otros jugadores, #453/#498), #427.
    **La planta sale de la nave REAL, no se inventa** — el porqué y lo que costó aprenderlo están en
    [ADR-0015](docs/adr/0015-dato-derivado-se-copia-y-se-compara.md). En la práctica: el Phobos M3P
    declara su interior en `scripts/shiptemplates/frigates.lua` (trece salas sobre una rejilla, nueve
    con sistema), `scripts/nave-planta-phobos.mjs` lo copia como dato del módulo y **deriva** de ahí
    la geometría —una única `CELDA` en metros, puerta entre toda pareja de salas contiguas por
    solapamiento real de aristas, y punto de llegada separado del rect de vuelta—, y
    `nave-planta-phobos.test.mjs` compara la copia con el `.lua`. Es estática a propósito: leerla del
    puente dejaría la ventana sin geografía cuando no hay puente (ADR-0008).
    **Una sola planta para todo el módulo** (#542): `celdasConCantina()` es el plano canónico —las
    trece salas más la cantina— y de ahí salen la ventana de andar, el minimapa y la sección. La
    salud de una sala es la de SU sistema, no la de una «región de casco».
    La **cantina** es la única sala que no sale de la rejilla y conserva sus 126 muebles hechos a mano
    (#423), colgada del muro libre de `acceso-cantina`, pero **no es un caso especial**:
    `scripts/cantina-sala.mjs` la construye con la MISMA fábrica y sus muebles entran como
    `mobiliario`. Era la única que no lo hacía y de ahí salían cuatro fallos que el QA repitió tres
    veces, todos con la misma causa: colisión y dibujo salían de dos declaraciones distintas. **No la
    devuelvas a mano**: si una sala necesita algo que la fábrica no da, se amplía la fábrica. Las
    salas de prueba ("a"/"b", `nave-movimiento-sala-prueba.mjs`) NUNCA aparecen en el catálogo real.
    `scripts/nave-sala-caja.mjs` es la fábrica de sala —muros, puertas, columnas, VENTANAS y la PIEL
    de los muros—, y la ventana se **decide** en vez de escribirse: un muro sin vecino es casco, y el
    casco ve el espacio. Lo que se ve por ella es otra vista del espacio real
    (`scripts/nave-ventana-espacio.mjs`, #541): reusa `visor-piloto.mjs` pasándole el rumbo de la nave
    MÁS el del muro, así que cada ventana mira a donde le toca. No abre ningún dato nuevo —es la MISMA
    lectura degradada que ya se difunde— y sin telemetría baja una **persiana**, nunca un cielo de
    estrellas quietas (el porqué, en [ADR-0014](docs/adr/0014-doctrina-de-arte-procedural.md), que es
    también el motivo de no traer los skybox de EmptyEpsilon).
    La **piel** es pixelart EN EL MUNDO —el motor no mapea texturas— sobre una rejilla métrica única
    (`CELDA` = 10 cm, el mando de escala de la piel): `scripts/nave-mural-pixel.mjs` los muros (#548,
    #551), `nave-piel-puerta.mjs` y `nave-piel-objeto.mjs` puertas y objetos (#550),
    `nave-piel-suelo.mjs` suelo y techo (#552). Comparten primitivo (`chapaEnCara`/`chapasDeRejilla`,
    donde vive el tope) y vocabulario de dibujo (`crearLienzo`, `panelBiselado`, `hundir`): el sentido
    del bisel es lo que NO puede divergir entre superficies, porque dos relieves iluminados al revés
    en la misma sala se ven a la primera. **Nada que se pueda leer** en ninguna de ellas —ni diales en
    el muro, ni señales en el suelo—: es ADR-0014, y la piel es la superficie que más de cerca se
    mira. Tres trampas medidas, que son las que cuestan tiempo:
    - **Las medidas de una piel van en METROS**, nunca escritas como índice de fila. Al bajar la celda
      en #551, todo lo que estaba en filas se partió por la mitad en silencio y la franja de aviso de
      una puerta se fue a la rodilla.
    - **No todo objeto lleva piel** (`MINIMO_LADO`/`MINIMO_ALTO`), y la piel es chapa remachada, o sea
      un MATERIAL: la cantina la apaga para sus muebles y cualquiera puede renunciar con `piel: false`
      sin sacar a la sala del sistema. El muro va por semilla; puertas y objetos NO, que son piezas de
      serie.
    - **El presupuesto es la CONDICIÓN del detalle**, no una optimización suelta: `fundirRectangulos`
      (mallado codicioso 2D) más el agrupado POR COLOR de `chapasDeRejilla`. La serie medida
      (894–1173 polígonos, 4,21 ms la peor sala) está en la cabecera del módulo y es lo que se vuelve
      a medir antes de subir nada. Si no cabe, se recorta densidad de greebles, **nunca** la rejilla.
    Las **luminarias** (`scripts/nave-luminaria.mjs`, #555) son PIEZAS de medida fija que se repiten:
    una sala grande tiene MÁS luminarias, no una mayor. Van en `LUZ_CALIDA`, no en el turquesa de
    `SECCION.entrable` que marca lo accionable. El difusor es la **única malla emisiva del módulo**
    (`componerEscena({emisivo: true})`), y **emisivo NO es una luz**: no alumbra a nadie. Lo que
    alumbra es un foco declarado por la escena (`componerEscena({focos})`, #556), evaluado en el
    centroide de cada cara y sumado a la direccional. Tres reglas de contrato: se **suman todas las
    luces y se escalona después**, se conserva el **suelo ambiente de 0,35**, y el tope es
    `TOPE_FOCOS` focos por escena (los más cercanos al observador; el coste es por cara y una sala
    son ~800). Sin focos declarados nada cambia, y hoy no los declara ninguna escena. **Nada de
    sombras**: proyectarlas exige resolver visibilidad, que es la deuda abierta de #510.
    La **maquinaria de sala** (`scripts/nave-mobiliario-sala.mjs`, #560) sale del `sistema` que ya
    declara `SALAS_PHOBOS` — es ADR-0015 otra vez: el dato ya existe. Tabla por SISTEMA y no por sala.
    Se mantiene la DENSIDAD y no el número, todo pegado al muro para no cortar el paso, y **nada cerca
    de una PUERTA** (una llegada siempre cae cerca de su puerta). Lo que este módulo **no** decide es
    el contenido narrativo: eso es de quien escribe la campaña.
    Un **minimapa** (`scripts/nave-minimapa.mjs` + `nave-minimapa-lienzo.mjs`) dice dónde estás,
    reusando el pintor de la sección; va `aria-hidden` porque el rótulo de sala ya lo dice en texto.
    El **punto de vista** (primera o tercera persona, tecla `V` — `c` ya es agacharse desde #446) es
    lógica pura en `scripts/nave-camara.mjs`, no de la fábrica ni del bucle. En tercera persona el
    propio cuerpo entra como un avatar más por `poligonosOtrosJugadores`.
    Cada sala con sistema tiene una **CONSOLA** (#509) que abre el puesto del sistema que ALOJA y que
    desde #557 se ve (`scripts/nave-consola.mjs`: cuerpo con piel, tapa, monitor y pantalla) — hasta
    entonces era solo un rectángulo disparador, y `detalleConsola` llevaba desde #509 escrita y
    probada sin que la llamara nadie: un *export* huérfano dentro de un módulo cableado, que es la
    variante que la guarda de #523 NO ve. Dos
    reglas: **se arrima a la pared**, nunca al centro de su zona —el rect es donde te PONES, y un
    cuerpo sólido ahí bloquearía su propio disparador—, y la zona va en el cuarto de sala más lejos de
    las PUERTAS, porque con la colocación fija de antes caía justo donde apareces al cruzar (lo cazó
    `nave-planta-phobos.test.mjs`). La pantalla va **encendida y VACÍA** (ADR-0014: un monitor
    iluminado no afirma nada, uno con un gráfico afirma una lectura que nadie ha calculado). Se
    declara con la misma forma que una puerta (`{rect, ...}`, reutilizando `puertaTocada`) pero sin
    `destino`, y el lienzo solo avisa en el flanco de ENTRADA; `andar-nave-app.mjs` llama a
    `openWorkspaceApp(puesto)`, que para quien no es GM no hace nada (#237). Sensores y comunicaciones
    no son sistemas con sala en EmptyEpsilon: se les asigna una pasarela, y esa es la **única parte
    inventada** del reparto, aislada en su tabla para poder revisarla.
    Ver a otros tripulantes está partido en tres capas que no se mezclan: `nave-movimiento-red.mjs` es
    el **protocolo** (muestras discretas confirmadas, interpolación local, **nunca** extrapola —
    revisado en #453, no se reabre por motivos de render); `scripts/nave-presencia.mjs` es el **estado
    de presencia**, sin nada de cómo se dibuja nadie; y `scripts/nave-avatares-render.mjs` es UNA
    vista de esa presencia, no su forma canónica. El avatar de cada cual (#450) se añade en el borde
    del render dentro de `andar-nave-app.mjs`, nunca aguas arriba.
    **La planta es navegable por COMPOSICIÓN, no por casos especiales** (#508): el motor solo recorre
    un grafo de espacios conectados y no conoce el nombre de ninguna sala. Si para meter una sala hace
    falta un `if` con su nombre en el motor, el diseño se ha roto. Corolario: `resolverArranque` decide
    con qué estancia se abre la ventana —lo pedido explícitamente manda sobre el checkpoint guardado, y
    un id desconocido cae al siguiente escalón en vez de dejar a nadie en la nada—, y vive en el
    catálogo porque es una decisión sobre el catálogo, no en la ventana que la aplica.
  - **Catálogos con procedencia, y el museo** — `scripts/procedencia-catalogo.mjs` es la ÚNICA regla
    de licencia del módulo (#598), con errores tipados por `code` + `path`. La consumen el atlas
    (`catalogo-cosmografico.mjs`, #525, cimiento sin cablear a la espera de #213) y el catálogo de
    piezas (`catalogo-piezas.mjs`). El porqué de esa unificación, el campo `naturaleza` y la frontera
    de qué se puede importar de dónde están en
    [ADR-0013](docs/adr/0013-frontera-de-licencias-y-procedencia.md).
    Operativamente: una ficha declara `malla` y el validador exige que ese ID exista de verdad (el
    registro se le pasa desde fuera, así que sigue siendo puro); `naturaleza` (escaneo,
    escaneo-de-vaciado, fotogrametría, reconstrucción, obra propia) es **obligatoria**; y el crédito
    de la cartela se **deriva** de la procedencia, nunca se escribe al lado — misma regla que el
    cartel del blackjack (#553).
    La **sala del museo** (`scripts/museo-escena.mjs` + `museo-piezas.mjs`, con `MUSEO` en
    `paleta.mjs`) es su primer consumidor real: tres piezas sobre pedestales, andable, solo-GM, con
    entrada por herramienta de la barra de escena y salida por un punto de interacción — la misma
    forma que la playa (#587) y por el mismo motivo: el Phobos no tiene un museo, y colgarlo de un
    mamparo contaría una historia que nadie ha decidido. Por eso está fuera de las invariantes de la
    nave en `nave-planta-phobos.test.mjs` y del minimapa.
    Lo que el museo NO hace es la mitad del diseño: **enseña y ya está** — la cartela se pinta al
    acercarse y se retira al apartarse (`accion: {tipo: "cartela"}` + el flanco `alSalirDeInteraccion`
    de #598), no marca piezas como vistas, no lleva cuenta ni deja rastro. Es
    [ADR-0012](docs/adr/0012-que-puede-hacer-una-escena-de-foundry.md), que es también por lo que el
    **bestiario** queda fuera hasta que el núcleo tenga dónde guardar un avistamiento.
    Tres piezas y no treinta es la disciplina de #590: lo caro no es convertir malla —las dieciocho ya
    están en el árbol— sino escribir cada cartela, que es trabajo humano. Y la copia de procedencia no
    se puede pudrir en silencio: una prueba la compara con las `FICHAS` de
    `tools/convertir-estatua.mjs` (ADR-0015).
  - **Huesos y deformación de malla** — `scripts/rig-esqueleto.mjs` (#603, fase 1). La capa que le
    faltaba al motor para que una malla importada pueda DOBLARSE: jerarquía de huesos con su pose de
    reposo, pesos por vértice (máximo cuatro influencias, normalizados en el binding y no en cada
    evaluación) y mezcla lineal de matrices. Se eligió esqueleto y no cortar por planos porque está
    medido: una estatua escaneada es UNA sola pieza conectada, así que «detectar el brazo» no se
    resuelve por topología, y cortar da piezas estáticas cuando lo que se quiere son cosas que se
    mueven. **El motor no se toca**: esto entra y sale en `{vertices, caras}` y se compone la malla ya
    deformada — un esqueleto dentro del rasterizador ataría la deformación a una época de consola
    cuando es geometría y vale para las dos (#362). El reposo se declara **solo por traslación** (la
    cabeza del hueso), y por eso no hay una sola inversión de matriz en el módulo: la inversa de un
    reposo trasladado es restar el punto. Es la fase 1 y se para ahí: no hay pesos automáticos
    (fase 2), ni retargeting entre esqueletos (fase 3), ni clips. Sigue **sin consumidor y declarado**
    en `HUERFANOS_DECLARADOS`, porque la fase 4 depende de una decisión de arte que #603 deja abierta
    —avatares todo-escaneado o todo-estilizado— y cablearlo antes es exactamente como sale la opción
    incoherente del medio.
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
    **Interfaz**: `scripts/asistencia-ui.mjs` (máquina de estados, hooks, rAF y DOM) sobre
    `scripts/asistencia/vista.mjs` (puro: qué se pinta en cada fase). La ventana no decide nada —
    cada gesto acaba en `pedirAsistencia`/`resolverAsistencia`, y la autoridad sigue entera en el
    GM coordinador. El reto de temporización se repinta tocando el DOM de la barra y no con
    `render()`: un render por fotograma tira el foco 60 veces por segundo. Sin
    `requestAnimationFrame` la barra no se anima pero el reto sigue siendo jugable.
  - **Contenido externo de dnd5e** — `scripts/contenido-externo/` (#332, doc en
    [`docs/CONTENIDO_EXTERNO.md`](docs/CONTENIDO_EXTERNO.md)): lectura OPCIONAL del material que el
    usuario ya tenga importado en su mundo (plutonium/5etools u otra vía), **filtrado al ruleset de
    2014**. Detectar, no depender: sin proveedor —o con uno roto— devuelve listas vacías y el módulo
    funciona igual. Nada de contenido de terceros entra en el repo y `module.json` no declara la
    dependencia ni como `recommends` (guarda en `manifiesto.test.mjs`). El clasificador
    **falla cerrado**: lo que no se pueda clasificar con certeza se descarta, los metadatos que se
    contradicen se resuelven en contra, y cada descarte deja su `motivo`. Ampliar la lista blanca
    suma, nunca sustituye. Solo `proveedor-foundry.mjs` sabe qué es Foundry; el resto es puro.
    **Primer consumidor**: `contenido-externo/inventario.mjs` (puro) y `contenido-externo/ventana.mjs`
    (superficie solo-GM, botón `lagunak-contenido-externo`), que es también lo único que construye
    el proveedor. Diagnostica antes que consumir a propósito: el clasificador falla cerrado, así que
    su modo de fallo natural es «no sale nada», indistinguible de «no tengo nada importado». Los
    consumidores de juego (#308/#213) siguen pendientes.
    Este directorio **sustituyó** al trío `plutonium-*.mjs` que nació del mismo #332 y que convivió
    con él sin consumidor: retirado en #524 tras comparar superficie, porque hacía menos con más
    acoplamiento (gateaba por «plutonium activo», y el contenido importado sigue en el mundo cuando
    plutonium se desactiva). Lo único que tenía y aquí faltaba —el patrón de nombre «X + abreviatura»
    de la revisión de 2024— se migró a `edicion.mjs`, pero **después** de la lista blanca: aplicado
    antes rechazaba XGE, que es de 2014. No lo reintroduzcas: si buscas un adaptador de plutonium, es
    esto.
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
