# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ubicación canónica

El trabajo activo vive exclusivamente en [`EspacioKoop/espaciokooplagunak`](https://github.com/EspacioKoop/espaciokooplagunak). Usa esa organización en GitHub, API, issues, pull requests y remotos. `VaroTv7/espaciokooplagunak` queda solo como redirección histórica y no es un destino válido para trabajo nuevo.

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

## Qué es

Espaciokoop Lagunak es un fork comunitario de [EmptyEpsilon](https://github.com/daid/EmptyEpsilon),
simulador cooperativo de puente de mando espacial: C++17 + CMake, motor
[SeriousProton](https://github.com/daid/SeriousProton) (repo hermano, NO submódulo) + SDL2, y
escenarios/lógica de misión en Lua.

Este archivo recoge solo **hechos duraderos**. El roadmap por fases (0–5) y qué característica está
integrada viven en el `README.md`; el estado operativo (qué hay en vuelo, bloqueos, traspasos) se
sigue en el issue de coordinación [#14](https://github.com/EspacioKoop/espaciokooplagunak/issues/14) y en
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
node --test $(find foundry-module/tests -name '*.test.mjs')
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
    documentos `Cards`— y por qué FXMaster es la única integración aceptada.
  - **Telemetría a modelo visual** — `scripts/ship-view/ship-view.mjs` y `scripts/ship-view/barras-estado.mjs`
    convierten el estado crudo en porcentajes y niveles de severidad, sin tocar el DOM: las
    plantillas de V1/V2 solo consumen su salida.
  - **Arte procedural** — generado en el cliente, cero binarios en el repositorio. Los colores viven
    **solo** en `scripts/paleta.mjs`, con la frontera vivo/registrado y una prueba que falla si otro
    módulo de arte declara un color propio (#351). Grabado en `scripts/laminas-clasicas.mjs`, cuyo
    único consumidor es `scripts/mapa-marco.mjs` (#526): el marco del mapa vivo, que va **alrededor**
    del visor y no encima —el bisel arcade del visor es una decisión de estilo ya tomada—, y que
    apaga a propósito los tics del limbo y la rosa de los vientos, porque sobre un instrumento que
    sí se lee serían una escala y una marcación que nadie ha calculado. Esa es la regla general para
    adornar cualquier superficie con lectura: el ornamento no puede abrir por detrás la lectura
    falsa que la superficie cierra por delante. Las dos opciones (`tics`, `rosa`) van encendidas por
    defecto, así que la lámina completa sigue siendo el registro de serie;
    pixelart en `scripts/nave-sprite.mjs`, `scripts/minijuegos/cartas-pixelart.mjs` y
    `scripts/minijuegos/fichas-pixelart.mjs` (volumen por planos de color, nunca degradados: el 3D
    del casco es otro lenguaje); música determinista por semilla en
    `scripts/arte/audio/musica-procedural.mjs`. El 3D de consola de los 90 vive en `scripts/retro3d*.mjs`
    (#362): motor puro que devuelve polígonos, pintor de lienzo aparte, y la **época** (PSX o
    GameCube) como parámetro —rejilla, tonos y niebla— y no como dos módulos. La **visibilidad no
    es un parámetro de época** (#510): quién tapa a quién es una garantía geométrica del motor y
    vale igual para las dos consolas, así que fundir varias piezas en una escena se hace con
    `fundirEscenas(...)` y no con el `flatMap` + `sort` que ocho consumidores copiaban. Ese orden
    es hoy por centroide de cara y es la deuda viva de #510 —empata entre caras que se tocan, que
    es el parpadeo que ve QA—; lo ya intentado y descartado (epsilon con orden estable; Newell sin
    partir caras, que empeora la medida) está escrito en la cabecera de `retro3d.mjs` para no
    repetirlo por cuarta vez. El arte de ficha de
    naves narrativas (`scripts/ficha-nave.mjs`, con el codificador PNG puro de
    `scripts/png-indexado.mjs`) se genera **solo por clic del GM** y escribe el token prototipo:
    nunca sondea ni sincroniza posición, porque un documento persistente que espeje la simulación
    se queda mintiendo cuando cae el puente (#354).
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
  - **Generador de NPC** — `scripts/npc-tablas.mjs` (tablas propias) y
    `scripts/npc-generador.mjs` (motor puro), #676. Semilla más valor de desafío dan una ficha
    completa, y la misma semilla da siempre el mismo NPC. Cuatro capas y **una sola importable**:
    la ficha 5e sale del **SRD 5.1 (CC-BY-4.0)** con sus fórmulas de verdad —modificador,
    competencia por VD, PG por dado de golpe—, y de Shin Megami Tensei, Persona y Pokémon se toma
    solo la MECÁNICA (afinidades de seis grados, matriz de efectividad, etapas): ni un nombre.
    De Argon HUD solo la FORMA del dato (acción/adicional/reacción/movimiento), y ahí no es
    preferencia: `enhancedcombathud` es GPL-3.0 y este árbol GPL-2.0, que son **incompatibles** —no
    se puede copiar ni adaptar código suyo—. Las mecánicas no se registran; los nombres y el arte
    sí, y eso va **codificado**: una prueba recorre cada cadena que el generador puede emitir
    —tablas y trescientas fichas generadas— y falla si aparece un término de esas obras. No es
    teórico: pilló que la tabla de sílabas componía *Maranmir* y *Marasai* por llevar «Mar».
    La matriz de efectividad se **deriva** de lo que cada elemento declara en vez de escribir
    veintiocho casillas, y un elemento desconocido **falla** en vez de valer ×1, que convertiría una
    errata en un NPC inmune a nada sin que saltara ninguna alarma. Es cimiento declarado: nadie lo
    importa todavía porque *recordar* a quién has conocido es del núcleo y no de la escena, el mismo
    reparto que #598 dejó abierto para el bestiario. Ver [docs/NPC_GENERADOR.md](docs/NPC_GENERADOR.md).
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
    **La planta sale de la nave REAL, no se inventa** (#540): el Phobos M3P declara su interior en
    `scripts/shiptemplates/frigates.lua` —trece salas sobre una rejilla, nueve con sistema— y esa es
    la planta que pinta el Control de daños nativo y que el puente publica en `ship.internal.rooms`
    (#522). `scripts/nave-planta-phobos.mjs` la copia como dato del módulo y deriva de ella la
    geometría: una única `CELDA` en metros (el mando de escala de toda la nave), puerta entre TODA
    pareja de salas contiguas calculada del solapamiento real de sus aristas, y punto de llegada
    separado del rect de vuelta para que nadie rebote entre dos salas. Es **estática** a propósito y
    no leída del puente: la distribución no cambia durante la partida y leerla por red dejaría la
    ventana sin geografía cuando no hay puente (standalone-first). El precio —que la copia se
    desactualice— lo cubre una prueba que la compara con el `.lua`.
    Esto sustituyó a una geografía inventada (vestíbulo, pasillo del puente y cinco salas de
    estación idénticas, #508) que producía los cuatro fallos de #539: huecos entre salas, puertas
    contra las que te golpeabas, solo la cantina alcanzable y una escala por sala. Ninguno puede
    volver por construcción, y hay prueba de **alcanzabilidad sobre el catálogo real** —no solo sobre
    `CATALOGO_PRUEBA`—, que es lo que faltaba: el motor tenía sus pruebas y la nave no.
    La **cantina** es la única sala que no sale de la rejilla (el interior nativo no la tiene) y
    conserva sus 126 muebles hechos a mano (#423); cuelga del muro libre de `acceso-cantina`. Pero
    **ya no es un caso especial**: `scripts/cantina-sala.mjs` la construye con la MISMA fábrica y sus
    muebles entran como `mobiliario`. Era la única que no lo hacía, y de ahí salían los cuatro fallos
    que el QA repitió tres veces —puerta pintada sobre muro macizo con su disparador desalineado casi
    un metro, ninguna ventana (no había, literalmente), suelo visible por el que no se podía andar, y
    los ojos a 3,35 m del suelo porque la cámara se ponía en altura absoluta sobre un suelo en −1,9—.
    Todos tenían la misma causa: colisión y dibujo salían de dos declaraciones distintas. Retirados
    con ella `cantina-andar.mjs` y `cantina-planta.mjs`, que solo existían para traducir entre esos
    dos sistemas. **No la devuelvas a mano**: si una sala necesita algo que la fábrica no da, se
    amplía la fábrica. Las
    salas de prueba ("a"/"b", `nave-movimiento-sala-prueba.mjs`) NUNCA aparecen en el catálogo real.
    `scripts/nave-sala-caja.mjs` sigue siendo la fábrica de sala —muros, puertas, columnas,
    VENTANAS y la PIEL de los muros—, y la ventana se **decide** en vez de escribirse: un muro sin vecino es casco, y el
    casco ve el espacio. Lo que se ve por ella es **otra vista del espacio real** y no un cielo de
    adorno (`scripts/nave-ventana-espacio.mjs`, #541): reusa `visor-piloto.mjs` para situar los
    contactos por marcación, pasándole el rumbo de la nave MÁS el del muro, así que la vista gira con
    la nave y cada ventana mira a donde le toca. No abre ningún dato nuevo —es la MISMA lectura
    degradada que ya se difunde a la tripulación— y conserva su disciplina: lo que queda a la espalda
    no se pinta, un eco sin identidad sale como borrón y no como silueta, y una lectura VACÍA sí se
    pinta, porque «he mirado y no hay nada» es un dato. Sin telemetría baja una **persiana**, que es
    distinto de un cielo vacío: una ventana con estrellas quietas afirmaría que no hay nada ahí
    fuera. Y por eso **no** se traen los skybox de EmptyEpsilon: serían 16 MB de binarios contra la
    regla de arte del módulo, para enseñar un espacio que no es el de esta partida.
    La **piel de los muros** es `scripts/nave-mural-pixel.mjs` (#548, reelaborada en #551): pixelart
    EN EL MUNDO —el motor no mapea texturas y no va a hacerlo—, sobre una rejilla métrica única
    (`CELDA` = 10 cm, el mando de escala de la piel igual que la `CELDA` de la planta lo es de la
    geografía), determinista por semilla y encendida de serie en la fábrica; solo las salas de prueba
    la apagan. Y **nada que se pueda leer**: es la regla de #526 en la superficie que más de cerca se
    mira —un dial pintado en el muro sería una medida que nadie ha calculado, y quien anda por la
    nave no tiene cómo saber que ese no cuenta—; lo que hay detrás de una escotilla tampoco se
    declara, por lo mismo. Tres cosas la hacen funcionar y ninguna es «más rayas»:
    **rampa y relieve** (seis tonos y bisel, con el sentido atado a la luz del motor: una pieza
    montada y un hueco recortado lo llevan al revés el uno del otro, y esa es toda la diferencia
    entre un bulto y un agujero); **jerarquía a dos distancias** (bandas —zócalo, paño de planchas,
    bastidor de tubos bajo cornisa— que se leen de lejos, y un greeble sorteado dentro de cada
    plancha —escotilla, rejilla, tendido de cable, placa— que premia acercarse; llenarlo todo por
    igual es ruido, el fallo contrario al de #548 y no mejor; y hay tres capas de lectura, no dos:
    bandas, greeble por plancha y menudencias de dos celdas para quien se pega al muro); y el
    **presupuesto**, que es la CONDICIÓN del detalle y no una optimización suelta: `fundirRectangulos`
    (mallado codicioso 2D — con relieve, que es vertical, fundir solo por filas deja de servir) más
    el agrupado POR COLOR de `chapasDeRejilla`, que quitó un 20% del coste sin cambiar un solo
    polígono, porque `componerEscena` se llamaba una vez por chapa y su peaje fijo se pagaba mil
    veces. Sin las dos cosas, este dibujo no cabe en un fotograma. La celda bajó de 20 a 10 cm en #551 al caerse su argumento original: «fidelidad al
    hardware» era la regla equivocada (Neo Geo y SIGNALIS usan más detalle por metro del que la
    máquina de referencia movía), la buena es el LOOK —paleta corta, sin filtrado, sin degradados—,
    que se conserva entero. El presupuesto medido (20–86 → 122–327 con #550 → 871–1055 con #551 → 886–1135 con #552 →
    894–1173 con #555; 0,4 → 1,45 → 4,11 → 4,19 → 4,21 ms la peor sala) está en la cabecera del módulo: es lo que se vuelve a medir antes
    de subir nada, y si algún día no cabe se recorta la densidad de greebles, nunca la rejilla —media
    resolución se nota en todo el muro, media plancha sin escotilla no la echa nadie de menos.
    La **misma rejilla** viste puertas (`scripts/nave-piel-puerta.mjs`) y objetos
    (`scripts/nave-piel-objeto.mjs`), #550 — y esa es toda la razón de que sean módulos y no copias:
    si cada superficie eligiera su tamaño de detalle, la sala parecería montada con piezas de tres
    maquetas. Comparten el primitivo de #548 (`chapaEnCara`/`chapasDeRejilla`, donde vive el tope,
    porque un tope que solo cumple uno de los tres consumidores no es un tope) y, desde #551, también
    el VOCABULARIO de dibujo (`crearLienzo`, `panelBiselado`, `hundir`): el sentido del bisel es justo
    lo que no puede divergir entre superficies, porque dos relieves iluminados al revés en la misma
    sala se ven a la primera. Ojo con las medidas: en la piel de una puerta van en METROS y se
    convierten a filas, nunca escritas como índice de fila — al bajar la celda en #551, todo lo que
    estaba en filas se partió por la mitad en silencio y la franja de aviso se fue a la rodilla. Se
    separan en lo que
    de verdad difiere: la hoja de una puerta es ESTRECHA —media hoja de 1,2 m son tres celdas, así
    que el dibujo se declara fila a fila y ninguna decisión depende de tener anchura—, va por sus dos
    caras y lleva el ámbar de `AMBAR_SENAL`, que ahí no adorna sino que repite lo que ya dice el marco
    de esa puerta. Tres reglas propias: **no todo objeto lleva piel** (`MINIMO_LADO`/`MINIMO_ALTO`, o
    los 126 muebles de la cantina se multiplican por cuatro caras para poner dos píxeles en algo que
    mide dos píxeles); **la piel es chapa remachada, o sea un MATERIAL**, así que la cantina la apaga
    para sus muebles —una barra de madera con remaches de casco no es un detalle de más, es un
    material equivocado— y cualquier mueble puede renunciar a ella con `piel: false` sin sacar a la
    sala entera del sistema; y **sin semilla**, al revés que el muro: una puerta y un armario son
    piezas de serie, y sortear sus remaches los convierte en artesanía.
    **Suelo y techo** son `scripts/nave-piel-suelo.mjs` (#552), y su cabecera explica por qué un
    plano horizontal NO es un muro girado: la rejilla es 2D de verdad, el presupuesto es otro —el
    suelo está en cuadro SIEMPRE, así que su dibujo es a propósito más pobre que el de un muro— y
    sobre todo la luz les llega distinta, hasta el punto de que la losa de suelo se queda casi en su
    tono crudo y **una junta de suelo no puede ser una sombra**: por debajo de ella no hay dónde ir,
    tiene que ser una línea un punto más clara, y solo un punto —con más, las juntas longitudinales
    convergen en perspectiva y el suelo se lee como el carril de una autopista—. Dos reglas propias:
    **ninguna señal en el suelo** (ni líneas guía ni flechas: es la regla de #526 donde más fácil
    sería saltársela, porque una marca que parezca indicar por dónde ir afirma algo que nadie ha
    decidido), y **todo o nada** al pasarse del tope —en un muro recortar quita rasgos anecdóticos y
    sigue siendo un muro; en un suelo deja media sala con juntas y media lisa, que se lee como un
    fallo—. La sala mayor (22x22 m) es la que fija el coste, no la media, y por eso se dibujan las
    juntas y no las planchas: rellenar plancha a plancha son trescientos rectángulos allí.
    Las **luminarias** son `scripts/nave-luminaria.mjs` (#555). Sustituyen a una lámpara que medía
    `min(ancho, profundidad) * 0.22` —o sea, 4,84 m de lado en el reactor—: una luminaria es una
    PIEZA de medida fija que se repite, igual que una plancha mide 1,6 m mida lo que mida el muro, y
    que un objeto escale con la sala que lo contiene es el error que #540 corrigió en la planta y
    que había sobrevivido en el techo. Ahora una sala grande tiene MÁS luminarias, no una mayor —que
    además es lo que la hace leerse grande—. Dos reglas: **una luminaria ilumina, no señala**, así
    que va en `LUZ_CALIDA` (recogido en `paleta.mjs` al llegar su tercer consumidor) y no en el
    turquesa de `SECCION.entrable`, que marca lo accionable y no se gasta en adornos; y el difusor es
    **la única malla EMISIVA del módulo** (`componerEscena({emisivo: true})`, #555): se pinta a
    intensidad plena sin sombreado por normal, que es lo que hacía la máquina de referencia con
    luces y pantallas. Sin eso parecía fundida — `intensidadCara` deja un suelo ambiente de 0,35 y
    la luz viene de arriba, así que toda cara que mire hacia abajo está en el mínimo y el techo es
    estructuralmente la superficie más oscura de la sala. Es la lección del suelo (#552) en el otro
    extremo: cada orientación tiene su tramo de rampa. **Emisivo NO es una luz**: el difusor no
    alumbra a nadie y el muro de enfrente no se aclara por tenerlo delante. Esa frontera sigue
    intacta ahora que el motor SÍ tiene **luces de punto** (`componerEscena({focos})`, #556): lo que
    alumbra es un foco declarado por la escena, y `emisivo` sigue diciendo solo cómo se ve la propia
    luminaria. La luz de punto se evalúa **en el centroide de cada cara** y entra por
    `intensidadCara` sumada a la direccional de siempre, sin tocar el rasterizador ni el orden por
    pintor: son las mismas caras con otro tono. Eso no valía la pena cuando un muro era un
    cuadrilátero grande —una lámpara al lado no daba un charco de luz, sino un muro que cambiaba de
    tono de golpe—, y lo vale ahora porque la piel pixelart de #548–#552 dejó 742 de 768 caras por
    debajo del 0,5 % del cuadro. Tres reglas de contrato: se **suman todas las luces y se escalona
    después** (escalonar por foco haría que dos focos débiles no equivalieran a uno fuerte), se
    conserva el **suelo ambiente de 0,35** (una cara fuera de todo charco no puede caer a negro), y
    el presupuesto es de `TOPE_FOCOS` focos por escena, los más cercanos al observador, porque el
    coste es por cara y una sala son ~800. **Sin focos declarados nada cambia**, y hoy no los declara
    ninguna escena: qué luminarias son foco, con qué caída y cuántas, es arte y quiere ojos delante.
    Nada de sombras: proyectarlas exige resolver visibilidad, que es la deuda abierta de #510.
    La **maquinaria de sala** es `scripts/nave-mobiliario-sala.mjs` (#560), y su regla es la misma
    que gobierna todo lo demás en esta nave: **el dato ya existe**. `SALAS_PHOBOS` declara el sistema
    de cada sala, y de ahí sale qué le toca —bancadas, armarios, conductos, cajas de registro— igual
    que la planta salió del `.lua` (#540) y la consola de tener puesto (#557). Es una tabla por
    SISTEMA y no por sala: dos salas del mismo sistema traen el mismo material, que es lo correcto en
    una nave, y lo que las diferencia es dónde cae cada pieza. Lo que **no** decide este módulo es el
    contenido narrativo —qué cuelga de las paredes, qué se ha dejado la tripulación— que es de quien
    escribe la campaña. Se mantiene la DENSIDAD y no el número (una pieza cada seis metros de muro,
    igual que las luminarias mantienen cadencia), todo va pegado al muro para no cortar el paso, y
    nada se coloca cerca de una PUERTA — los puntos de llegada los declaran las salas vecinas y aquí
    no se conocen, pero una llegada siempre cae cerca de su puerta, que es el mismo apaño de #557.
    Un **minimapa** (`scripts/nave-minimapa.mjs` + `nave-minimapa-lienzo.mjs`) dice dónde estás,
    reusando el pintor de la sección. Va `aria-hidden` porque el rótulo de sala ya da la lectura en
    texto. **Una sola planta para todo el módulo** (#542): `nave-planta-phobos.celdasConCantina()` es
    el plano canónico —las trece salas del modelo más la cantina, que cuelga encima de su acceso— y
    de ahí salen la ventana de andar, el minimapa y la sección. La sección tenía seis salas
    inventadas (puente, enfermería, bodega…), y con ellas se fueron dos cosas: la traducción a mano
    `puente → pasarela-proa` que #540 tuvo que poner para que el clic no muriera, y la salud por
    «regiones de casco», que podía teñir una sala por una avería que no estaba en ella — ahora la
    salud de una sala es la de SU sistema.
    El **punto de vista** (primera o tercera persona, tecla `V` — `c` ya es agacharse desde #446) es lógica pura en
    `scripts/nave-camara.mjs` y no de la fábrica ni del bucle: la regla es la misma para las catorce
    estancias. En tercera persona el propio cuerpo entra como un avatar más por
    `poligonosOtrosJugadores`, así que el render de presencia no sabe que uno de ellos eres tú.
    Cada sala con sistema tiene una CONSOLA (#509) que abre el puesto del sistema que ALOJA —el
    reactor abre ingeniería— y que desde #557 **se ve**: hasta entonces era solo un rectángulo
    disparador y se activaba pisando un trozo de suelo vacío (y `detalleConsola`, escrita y probada
    desde #509, no la llamaba nadie — un *export* huérfano dentro de un módulo cableado, la variante
    que la guarda de #523 no ve). `scripts/nave-consola.mjs` la construye como mobiliario: cuerpo con
    piel, tapa, monitor y pantalla. Dos reglas: **se arrima a la pared**, nunca al centro de su zona
    —el rect es donde te PONES, y un cuerpo sólido ahí bloquearía su propio disparador—, y la zona se
    elige en el cuarto de sala más lejos de las PUERTAS, porque con la colocación fija de antes caía
    justo donde se aparece al cruzar desde la sala vecina (lo cazó `nave-planta-phobos.test.mjs`). La
    pantalla va **encendida y VACÍA** (`emisivo`, #555): un monitor iluminado no afirma nada, uno con
    un gráfico afirma una lectura que nadie ha calculado — y es la infracción más creíble posible de
    #526, precisamente porque una consola es el único sitio donde un dato tendría sentido. El dato de
    verdad está en el espacio de puesto que se abre al llegar. con su zona de pie separada del punto de entrada para que acercarse sea
    un gesto; `nave-estancias.mjs` la declara con la misma forma que una puerta (`{rect, ...}`,
    reutilizando `nave-movimiento.puertaTocada`) pero sin `destino`, y `nave-movimiento-lienzo.mjs`
    solo avisa en el flanco de ENTRADA. `andar-nave-app.mjs` interpreta el aviso llamando a
    `openWorkspaceApp(puesto)` — el mismo espacio que ya se abre por botón; para quien no es GM ese
    parámetro no hace nada (#237), así que caminar hasta una consola ajena no da ni enseña más.
    Sensores y comunicaciones no son sistemas con sala en EmptyEpsilon: se les asigna una pasarela, y
    esa es la única parte inventada del reparto, aislada en su propia tabla para poder revisarla.
    Ver a otros tripulantes está partido en tres capas que no se mezclan:
    `nave-movimiento-red.mjs` es el **protocolo** (muestras discretas confirmadas, interpolación
    local, nunca extrapola — revisado en #453 y que no se reabre por motivos de render);
    `scripts/nave-presencia.mjs` es el **estado de presencia**, la única respuesta a «quién está aquí
    y dónde», deliberadamente sin nada de cómo se dibuja nadie; y `scripts/nave-avatares-render.mjs`
    es UNA vista de esa presencia, no su forma canónica. El avatar de cada cual (#450) se añade en el
    borde del render dentro de `andar-nave-app.mjs`, nunca aguas arriba.
    **La planta es navegable por COMPOSICIÓN, no por casos especiales** (revisión externa en #508):
    el motor solo sabe recorrer un grafo de espacios conectados y no conoce el nombre de ninguna
    sala. #540 fue su primera prueba de fuego —se cambió la planta entera y el motor no se tocó—; si
    para meter una sala hace falta un `if` con su nombre en el motor, el diseño se ha roto. Corolario:
    `resolverArranque` decide con qué estancia se abre la ventana —lo pedido explícitamente (la
    sección, #508) manda sobre el checkpoint guardado, y un id que el catálogo no conoce cae al
    siguiente escalón en vez de dejar a nadie en la nada—, y esa decisión vive en el catálogo porque
    es sobre el catálogo, no en la ventana que la aplica.
  - **Catálogos con procedencia, y el museo** — `scripts/procedencia-catalogo.mjs` es la ÚNICA
    regla de licencia del módulo (#598): qué es una procedencia aceptable, con errores tipados por
    `code` + `path`. La consumen el atlas (`catalogo-cosmografico.mjs`, #525, que sigue siendo
    cimiento sin cablear a la espera de #213) y el catálogo de piezas (`catalogo-piezas.mjs`), y esa
    unificación es el punto: dos validadores de licencia se desincronizan, y una licencia
    desincronizada no es un fallo de forma. `catalogo-piezas.mjs` es lo que faltaba para unir las dos
    mitades que #590 y #525 habían dejado sin hablarse — texto con procedencia por un lado, malla con
    procedencia por otro—: una ficha declara `malla`, y el validador exige que ese ID exista de
    verdad (el registro se le pasa desde fuera, así que sigue siendo puro). Su campo `naturaleza`
    (escaneo, escaneo-de-vaciado, fotogrametría, reconstrucción, obra propia) es obligatorio y NO es
    metadato: es lo que impide que una cartela diga «así era» de una pieza que es una reconstrucción
    hecha después de que destruyeran el original, o que llame mármol a un vaciado en yeso. El crédito
    de la cartela se **deriva** de la procedencia y no se escribe al lado, misma regla que el cartel
    de reglas del blackjack (#553). La **sala del museo** (`scripts/museo-escena.mjs` +
    `museo-piezas.mjs`, con `MUSEO` en `paleta.mjs`) es su primer consumidor real: tres piezas sobre
    pedestales, andable, solo-GM, con la entrada por herramienta de la barra de escena y la salida
    por un punto de interacción — la misma forma que la playa (#587), y por el mismo motivo (el
    Phobos no tiene un museo, y colgarlo de un mamparo contaría una historia que nadie ha decidido).
    Por eso está fuera de las invariantes de la nave en `nave-planta-phobos.test.mjs` y del minimapa.
    Lo que el museo NO hace es la mitad del diseño: **enseña y ya está**. La cartela se pinta al
    acercarse y se retira al apartarse (`accion: {tipo: "cartela"}` + el flanco de salida
    `alSalirDeInteraccion` de #598); no marca piezas como vistas, no lleva la cuenta ni deja rastro,
    porque la regla de `docs/FOUNDRY.md` es que una escena puede enseñar, transportar y ambientar,
    pero no conceder, contar ni recordar. Un **bestiario** que registre qué ha encontrado la
    tripulación sí recuerda, y por eso #598 lo deja fuera hasta que el núcleo tenga dónde guardar un
    avistamiento. Tres piezas y no treinta es la disciplina de #590: lo caro no es convertir malla
    —las dieciocho ya están en el árbol— sino escribir cada cartela, que es trabajo humano. Y la
    copia de procedencia no se puede pudrir en silencio: una prueba la compara con las `FICHAS` de
    `tools/convertir-estatua.mjs`, igual que la planta del Phobos se compara con su `.lua`.
  - **Huesos y deformación de malla** — `scripts/rig-esqueleto.mjs` (#603, fase 1, PR #609). La capa
    que le faltaba al motor para que una malla importada pueda DOBLARSE: jerarquía de huesos con su
    pose de reposo, pesos por vértice (máximo cuatro influencias, normalizados en el binding y no en
    cada evaluación) y mezcla lineal de matrices. Se eligió esqueleto y no cortar por planos porque
    está medido: una estatua escaneada es UNA sola pieza conectada, así que «detectar el brazo» no se
    resuelve por topología, y cortar da piezas estáticas cuando lo que se quiere son cosas que se
    mueven. **El motor no se toca**: esto entra y sale en `{vertices, caras}` y se compone la malla ya
    deformada — un esqueleto dentro del rasterizador ataría la deformación a una época de consola
    cuando es geometría y vale para las dos (#362). El reposo se declara **solo por traslación** (la
    cabeza del hueso), y por eso no hay una sola inversión de matriz en el módulo: la inversa de un
    reposo trasladado es restar el punto. La pose es `{eje, angulo}` por hueso: un giro puro en
    espacio de mundo, sin escala ni longitud — la propiedad que hace barata la fase 3.
    **Fase 2** (`tools/pesar-despiezar.mjs`, PR #841) añade pesos automáticos por distancia al hueso y
    extracción de una región como malla suelta.
    **Fase 3** (`scripts/retargeting-pose.mjs`, #603) es retargeting de poses: traslada una pose
    declarada sobre un rig a OTRO rig de proporciones distintas por mapeo de ids (`mapeoPorId` cuando
    los nombres ya coinciden, un mapeo explícito si no) y copia el giro tal cual — no hay álgebra
    nueva porque un giro en espacio de mundo no sabe de longitudes; solo la traslación de cada hueso
    respecto a su padre, que pone el rig y no la pose, cambia entre esqueletos. La frontera es la
    correspondencia de anatomía: un rig destino con una jerarquía distinta (un dedo de más) dobla por
    donde no toca, y eso lo declara quien escribe el mapeo, no lo detecta el módulo.
    La **decisión de arte que bloqueaba la fase 4** ya se tomó (Eloy, 2026-08-20, en #603): avatares
    **todo escaneado** — PC, NPC, criaturas y estatuas son malla decimada con el mismo tratamiento, no
    cajas. El primer consumidor real (`estatua-rig.mjs`, museo) se cableó en el PR #844 y su
    cherry-pick limpio es el PR #882. Hasta que uno de los dos entre en `main`, `rig-esqueleto.mjs`
    sigue `declared-orphan` en `docs/orphan-declarations.json`; `retargeting-pose.mjs` nace igual de
    huérfano porque su consumidor (dar `rig`+pose a una pieza real del catálogo, o un PC/NPC) es
    contenido, no motor. Sigue fuera de alcance la reproducción de clips con interpolación.
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

- `origin` = `EspacioKoop/espaciokooplagunak`; `upstream` = `daid/EmptyEpsilon`. Nunca apuntes `upstream`
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
