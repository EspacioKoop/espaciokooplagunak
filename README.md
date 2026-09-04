<p align="center">
  <img src="docs/assets/banner.svg" alt="Espaciokoop Lagunak — simulación espacial cooperativa por puestos, conectada con Foundry VTT" width="900"/>
</p>

# Espaciokoop Lagunak

> Fork colaborativo de [EmptyEpsilon](https://github.com/daid/EmptyEpsilon) para juego, experimentación y desarrollo cooperativo entre personas y agentes de IA.

> **Repositorio canónico:** [`EspacioKoop/espaciokooplagunak`](https://github.com/EspacioKoop/espaciokooplagunak). Personas, agentes, bots y automatizaciones deben abrir aquí los issues, ramas y pull requests y usar esta dirección como `origin`. La ubicación anterior bajo `VaroTv7` queda únicamente como redirección histórica y no debe usarse para trabajo nuevo.

[![CI/CD](https://github.com/EspacioKoop/espaciokooplagunak/actions/workflows/cicd.yml/badge.svg)](https://github.com/EspacioKoop/espaciokooplagunak/actions/workflows/cicd.yml)
[![CodeQL](https://github.com/EspacioKoop/espaciokooplagunak/actions/workflows/codeql.yml/badge.svg)](https://github.com/EspacioKoop/espaciokooplagunak/actions/workflows/codeql.yml)
[![Licencia: GPL-2.0](https://img.shields.io/badge/licencia-GPL--2.0-blue.svg)](LICENSE)
[![Base upstream](https://img.shields.io/badge/upstream-EmptyEpsilon-informational.svg)](https://github.com/daid/EmptyEpsilon)
[![Docker](https://img.shields.io/badge/docker-servidor%20%2B%20puente-2496ed.svg?logo=docker&logoColor=white)](docker/README.md)
[![Foundry VTT](https://img.shields.io/badge/foundry%20vtt-integraci%C3%B3n%20en%20curso-ff6400.svg)](docs/FOUNDRY.md)

## Estado del proyecto

**Fase actual: 3 — integración prioritaria con Foundry VTT.**

Espaciokoop Lagunak conserva el código y el historial de EmptyEpsilon y ya
dispone de escenario propio, compilación reproducible, servidor Docker, puente
seguro y módulo Foundry en desarrollo. Las fases 0, 1 y 2 están completadas.

| Área | Estado | Evidencia / siguiente paso |
|---|---|---|
| Historial y atribución de EmptyEpsilon | Hecho | `main` parte de `upstream/master` sin reescribir historial |
| Licencia GPL-2.0 | Conservada | Véase [`LICENSE`](LICENSE) |
| Normas de colaboración | Hecho | [`CONTRIBUTING.md`](CONTRIBUTING.md) y [`AGENTS.md`](AGENTS.md) |
| Decisiones arquitectónicas | Documentadas | [`docs/adr/README.md`](docs/adr/README.md) e índice [`JSON`](docs/adr/index.json) |
| Compilación reproducible | Verificada en Linux | Nativa ([`docs/BUILDING.md`](docs/BUILDING.md)) y en imagen Docker (SeriousProton fijado por commit) |
| Ejecución con Docker | Verificada en local | Servidor headless + puente vía compose ([`docker/README.md`](docker/README.md)) |
| Integración con Foundry VTT | Vertical en desarrollo | Puente v0 + módulo con estado, destino/ETA y mapa vivo; controles GM de tempo, reposición, ingeniería y maniobra; asignación y **espacios operativos de puesto** (cada tripulante emite las órdenes de su puesto: navegación, ingeniería con energía y refrigerante, armas). Smoke GUI **verificado en v11.302**; falta la fila del host moderno ([`docs/FOUNDRY.md`](docs/FOUNDRY.md), #29) |
| Cambios jugables propios | Primera iteración disponible | «Lagunak: Primera guardia» (`scenario_90`) |
| Lanzamientos propios | Primer release publicado, publicación por tag aún sin estrenar | Existe el release/tag `v2026.08.27`. Las imágenes `espaciokooplagunak-server` y `-bridge` están publicadas y son públicas en GHCR, pero se subieron por `workflow_dispatch` y llevan `manual` + SHA corto, no la versión. El disparo por tag `v*` sigue sin ejercitarse y publicaría sin etiqueta de versión hasta que entre el arreglo de #829 |

## Qué es

EmptyEpsilon es un simulador libre y multiplataforma de puente de mando espacial, escrito en C++17, construido con CMake y basado en el motor [SeriousProton](https://github.com/daid/SeriousProton) y SDL2. Permite que una tripulación reparta puestos —como mando, ingeniería, ciencia, comunicaciones o armas— entre varias pantallas.

**Espaciokoop Lagunak no es el proyecto oficial EmptyEpsilon.** Es un fork comunitario independiente mantenido por Varo y sus colaboradores. El código anterior a este fork, sus recursos y gran parte de su documentación pertenecen a sus autores originales. La web, documentación y versiones oficiales están en:

- Proyecto original: <https://github.com/daid/EmptyEpsilon>
- Web oficial: <https://daid.github.io/EmptyEpsilon/>
- Historial de cambios original: [`CHANGELOG.md`](CHANGELOG.md)

## Objetivos

1. Mantener una base jugable sincronizable con EmptyEpsilon.
2. Construir una experiencia cooperativa propia de forma incremental y verificable.
3. Facilitar que varias personas y agentes de IA colaboren sin duplicar trabajo ni introducir cambios opacos.
4. Documentar claramente qué procede de upstream y qué desarrolla este fork.
5. Priorizar cambios pequeños, revisables y compatibles con partidas reales.
6. Integrar la simulación con Foundry VTT para representar trayectos espaciales, gestión de nave y trabajo de tripulación dentro de campañas de rol como *Spelljammer*.

## Características

### Heredadas de EmptyEpsilon

El fork recibe de upstream, entre otras capacidades:

- Juego cooperativo con puestos de tripulación especializados.
- Partidas en red y distintos modos de pantalla.
- Escenarios y lógica de misiones en Lua.
- Game Master y múltiples facciones controladas por IA.
- Soporte original para Linux, Windows, macOS y Android.

Estas características son obra del proyecto EmptyEpsilon y sus contribuidores. Su presencia en upstream no implica que todas hayan sido verificadas todavía por el equipo de Espaciokoop Lagunak en cada plataforma.

### Propias de Espaciokoop Lagunak

Características propias integradas y verificadas:

- escenario cooperativo «Lagunak: Primera guardia»;
- identidad visual del fork y localización Español (España);
- servidor headless y puente seguro reproducibles;
- módulo Foundry para el GM y la tripulación: estado en vivo, destino y ETA,
  mapa, bitácora deduplicada, controles GM cerrados y **espacios operativos de
  puesto** donde cada tripulante emite las órdenes de su puesto, gateadas por
  identidad no falsificable. Los ocho puestos de la matriz de autoridad están
  cubiertos (navegación con maniobra de combate y atraque; ingeniería con
  energía, refrigerante, autodestrucción y frecuencia de escudos; armas;
  sensores; comunicaciones; enlace con waypoints, sondas y nivel de alerta;
  control de daños con equipos móviles; y la confirmación de mando), toda orden
  por la lista blanca versionada del puente y nunca por la API heredada;
- **asistencia entre puestos**: ayudar produce un token que gasta el titular del
  puesto asistido como una de sus órdenes ya autorizadas —nunca una orden
  propia—, con cuatro minijuegos de destreza deterministas por semilla
  (temporización, secuencia, precisión y puzzle) y lectura de los modificadores
  reales de la ficha dnd5e cuando existe
  ([`docs/MINIJUEGOS_ASISTENCIA.md`](docs/MINIJUEGOS_ASISTENCIA.md));
- primera fase del editor integrado de campañas, mapas, personajes y naves,
  con intercambio JSON individual desde Game Master
  ([guía](docs/CONTENT_EDITOR.md));
- **nivel de alerta compartido con toda la mesa**: el GM es el único que recibe
  telemetría, pero la alerta se difunde a todos los clientes —incluido quien
  entra tarde— porque una tripulación sabría de sobra que está en roja (#338);
- **arte y música procedurales generados en el cliente**: grabado clásico,
  pixelart y registros musicales deterministas por semilla, con la frontera de
  estilo vigilada por pruebas ([`docs/FOUNDRY.md`](docs/FOUNDRY.md)). La regla
  sigue siendo generar y no distribuir, pero **ya no es absoluta**, y conviene
  decirlo aquí en vez de descubrirlo leyendo el árbol:
  - Hay **cuatro PNG** en el módulo. Tres son el horizonte prerrenderizado y el
    cuarto es la textura de muro (#584), que se prerrenderiza porque generarla
    en cada arranque costaba más de lo que valía. No son arte ajeno: los produce
    generadores que viven en `tools/`, y **los cuatro están vigilados**: si el
    binario del árbol deja de corresponder a su generador, CI falla. La textura
    de muro por una puerta en el flujo de trabajo
    (`tools/prerender-piel.mjs --check`) y los tres del horizonte por
    `horizonte-matte.test.mjs`, que lee los PNG guardados y los compara con lo
    que el generador produce ahora. Distinto mecanismo, misma garantía.
  - El museo **sí distribuye contenido ajeno**: escaneos 3D de vaciados del
    *Statens Museum for Kunst*, todos **CC0 1.0**, cada uno con su ficha de
    procedencia en la cabecera de su fichero y en
    [`docs/PROCEDENCIA_ASSETS.md`](docs/PROCEDENCIA_ASSETS.md). La regla que se
    aplica no es «nada ajeno», es **«nada sin ficha»**, y se comprueba con
    pruebas que exigen que la cartela no mienta sobre lo que hay delante.
- **espacios por los que se anda dentro de la nave**, en 3D retro de consola de
  los 90: camarotes amueblados, luminarias que cuelgan del techo, minimapa que
  muestra dónde está cada tripulante, y dos escenas de banco de pruebas —una
  playa y una sala de museo— que hoy abre **solo el GM** desde la barra de
  escena, porque no cuelgan de ninguna puerta de la nave.

Infraestructura propia disponible:

- **Servidor headless en Docker** con imagen reproducible y `compose.yaml` ([`docker/README.md`](docker/README.md)).
- **Puente de integración con contrato v0** para Foundry VTT: lecturas de estado y órdenes de lista blanca con autenticación, sin exponer la API heredada insegura ([`bridge/README.md`](bridge/README.md)).

El módulo Foundry consume el puente por polling autenticado y mantiene los
secretos fuera del mundo compartido; véase
[`foundry-module/README.md`](foundry-module/README.md).

## Roadmap

El roadmap refleja intención, no promesas. Los cambios se concretarán mediante issues y pull requests.

### Fase 0 — Base colaborativa

- [x] Conservar historial, autoría y licencia de EmptyEpsilon.
- [x] Establecer `main` como rama principal del fork.
- [x] Añadir documentación para personas y agentes de IA.
- [x] Definir ramas, issues, pull requests y sincronización con upstream.
- [x] Ejecutar y documentar una compilación limpia en Linux ([`docs/BUILDING.md`](docs/BUILDING.md), PR #3).
- [x] Activar CI del fork y corregir cualquier incompatibilidad real (CI heredada y `docker.yml` en verde sobre `main` y PRs #10, #13).

### Fase 1 — Primera iteración jugable

- [x] Arrancar una partida local con una compilación propia ([`docs/SESION-FASE1.md`](docs/SESION-FASE1.md)).
- [x] Crear un escenario Lua mínimo, claramente identificado como propio (`scripts/scenario_90_lagunak_primera_guardia.lua`, PR #15).
- [x] Añadir identidad visible de Espaciokoop Lagunak sin eliminar créditos originales (PR #13; menú, título de ventana y log verificados en la review).
- [x] Probar conexión de al menos dos puestos de tripulación (timón + armas, [`docs/SESION-FASE1.md`](docs/SESION-FASE1.md)).
- [x] Documentar instalación, arranque y resultado de la sesión de prueba ([`docs/SESION-FASE1.md`](docs/SESION-FASE1.md)).

**Criterio de salida:** una persona nueva puede compilar o instalar el juego siguiendo la documentación, iniciar el escenario del fork y conectar dos estaciones sin instrucciones privadas.

### Fase 2 — Docker y API segura

- [x] Validar el modo servidor o sin interfaz de EmptyEpsilon (nativo en PR #3; en contenedor en esta fase).
- [x] Crear una imagen Docker reproducible y un `compose.yaml` documentado ([`docker/README.md`](docker/README.md)).
- [x] Mantener la simulación y el puente de integración en servicios separados y una red privada.
- [x] Inventariar el API HTTP heredado ([`docs/seguridad/API_HTTP.md`](docs/seguridad/API_HTTP.md)) y definir un contrato propio y versionado (v0, [`bridge/README.md`](bridge/README.md)).
- [x] Implementar un puente que solo permita operaciones autorizadas y nunca exponga `/exec.lua` directamente.
- [x] Añadir autenticación, validación de mensajes, límites y comprobaciones de salud.

**Criterio de salida:** el servidor arranca de forma reproducible y el puente puede leer un estado seguro sin permitir ejecución Lua arbitraria desde Foundry. **Cumplido y verificado (2026-07-12)**, reproducido en más de un entorno (nativo Ubuntu 24.04 y Arch/CachyOS — issue #14 —, y en contenedor vía compose). Los dos flecos posteriores quedaron cerrados el 2026-07-14: el puente se prueba en CI (job pytest del workflow Docker, PR #74) y las imágenes del servidor y del puente se publican en GHCR con cada tag `v*` o lanzamiento manual (`docker-publish.yml`, PR #83 / issue #82).

### Fase 3 — Integración prioritaria con Foundry VTT

Hitos verticales:

- [x] Estado de nave visible para el GM mediante polling autenticado.
- [x] Llegada de «Primera guardia» normalizada y deduplicada en Journal.
- [x] Destino y ETA legibles en `/v1/state` y en la ventana Foundry (#32).
- [x] Pausa/reanudación del GM de extremo a extremo (#34); factor temporal pendiente por falta de API.

- [ ] Crear un módulo de Foundry VTT para el director de juego y la tripulación
      (la parte del GM, la asignación y los espacios de puesto están integrados
      —#162—, y las **acciones operativas por puesto** ya funcionan —#236/#238/#268/#301—;
      smoke GUI verificado en v11.302 —#29—, falta solo la fila del host moderno).
- [ ] Representar trayectos en tiempo real, con pausa y aceleración controladas por el director de juego.
- [x] Sincronizar mapa, posición, rumbo, velocidad, destino y tiempo estimado de llegada
      (#33, #69 y #73).
- [ ] Gestionar motores, combustible o energía, temperatura, daños, reparaciones y recursos de la nave
      (el puente ya autoriza impulso, warp, rumbo, escudos, energía por sistema y averías
      —decisión del issue #80—; el panel de ingeniería del GM reparte energía —#217— y la
      **superficie por puesto de ingeniería** ya ordena energía y refrigerante —#238/#301—;
      combustible y recursos siguen fuera de alcance).
- [ ] Modelar puestos, permisos, turnos y acciones de la tripulación
      (asignación y espacios integrados en #162; **permisos por puesto y acciones
      operativas integrados y ratificados** —#237/#268/#238/#301—; turnos y guardias
      siguen pendientes).
- [x] Permitir al director de juego introducir encuentros, anomalías, averías y cambios narrativos
      (el puente inyecta encuentros de un catálogo cerrado de arquetipos
      —`spawn_encounter`, #196/#220— y reposiciona la nave a un ancla —#202/#176—; la UI GM
      está integrada —#201— y el evento `encounter_started` deduplicado en Journal
      cierra #117 —#294—).
- [ ] Enviar a Foundry eventos y resultados normalizados para diarios, escenas y fichas
      (`encounter_started` normalizado —#200— y alertas de umbral a la bitácora —#207—
      ya publicados; falta el resto de resultados de sesión).
- [ ] Probar una sesión completa de *Spelljammer* con director de juego y varios puestos conectados.

**Criterio de salida:** una mesa de Foundry puede iniciar un trayecto, jugar su gestión operativa en Espaciokoop Lagunak y recibir el resultado en la campaña sin acceso directo a la API insegura heredada.

Diseño inicial: [`docs/FOUNDRY.md`](docs/FOUNDRY.md).

#### El otro frente de fase 3: espacios andables dentro del módulo

Empezó como una ventana al espacio y ha acabado siendo un motor de escenas
propio, `retro3d`, con su lenguaje visual y su catálogo. No es una desviación:
es lo que hace que la nave sea un SITIO y no un panel de mandos, y por eso tiene
su propia cadena de trabajo.

- [x] **Motor `retro3d`**: composición por pintor con búfer de profundidad,
      recorte de frustum, luz por cara y focos (#510, #556), y **mapeado de
      texturas** con corrección afín o perspectiva según la época (#573).
- [x] **Andar por la nave**: trece salas del Phobos con puertas, ventanas,
      luminarias y presencia de otros jugadores. Andar es la navegación
      principal; la sección es el mapa y la cantina un atajo (#577).
- [x] **Lenguaje de superficies**: piel de muros, puertas, objetos, suelo y
      techo (#548, #550, #551, #552), y **materiales** que salen del color de
      cada pieza en vez de una imagen por tono.
- [x] **Kit de escenas** (#589): primitivas compartidas, kit de exteriores con
      sol declarado y sombras derivadas, vocabularios de props **por ambiente y
      mezclables**, y un contrato de escena escrito.
- [x] **Exteriores**: la playa de pruebas (#587) y la terraza de la cantina
      (#579), con matte painting multiplano del horizonte.
- [x] **Assets de terceros con procedencia** (#590): entrada de malla ajena con
      decimado por colapso de aristas, UV triplanar y **ficha obligatoria** —
      obra, qué es el fichero, autoría, licencia, enlace y sha256.
- [x] **La sala del museo** (#598): el consumidor que le faltaba al catálogo con
      procedencia. Una ficha ya puede apuntar a una malla —una sola regla de
      licencia para texto y geometría— y tres piezas se enseñan en una sala
      andable, con su cartela diciendo qué es cada fichero: un vaciado en yeso
      escaneado no es el mármol, y una reconstrucción no es «así era».
- [ ] **Enciclopedia y bestiario** (#598): la enciclopedia cabe como superficie
      de consulta; el bestiario **no**, hasta que el núcleo tenga dónde guardar
      un avistamiento — registrar qué ha encontrado la tripulación es recordar,
      y eso no es de una escena de Foundry.
- [ ] **Que una escena nueva cueste 1–3 PRs** y el último no toque ningún módulo
      compartido. Es la métrica de #589, y hasta que no se cumpla en una escena
      de verdad, el kit no está terminado.

Documentación: [`docs/FOUNDRY.md`](docs/FOUNDRY.md) (contrato de escena y reglas
de autoridad), [`docs/ASSETS_LIBRES.md`](docs/ASSETS_LIBRES.md) (qué fuentes
libres tienen dónde entrar y cuáles no) y
[`docs/PROCEDENCIA_ASSETS.md`](docs/PROCEDENCIA_ASSETS.md) (la ficha de cada
asset de terceros que hay en el árbol).

### Fase 4 — Experiencia cooperativa

- [ ] Recoger feedback de partidas mediante issues.
- [ ] Diseñar una campaña o conjunto de escenarios cooperativos.
- [ ] Completar el editor visual integrado y conectar mapas/naves declarativos
      con el mapa vivo y las plantillas del juego.
- [ ] Mejorar accesibilidad, localización y experiencia de incorporación.
- [ ] Definir compatibilidad de red y política de versiones.

Capa de diversión y cohesión social (exploración, del lado de Foundry, sin tocar
la simulación ni el puente):

- [x] Sistema de minijuegos a bordo, diegético y con estética Neo Geo; póker como
      primer vertical (#308, ampliado con dados y blackjack).
- [ ] Ayudar a otro puesto con mini-minijuegos de habilidad tipo *Skyrim*, con
      efecto acotado y coherente con los permisos por puesto (#309; **depende de
      #308**: consume su motor de minijuegos, y el efecto sobre la nave sale solo
      por una orden del titular del puesto asistido, nunca del ayudante).
- [ ] Catálogo verificado de guiños de dominio público del imaginario scifi/pulp,
      separando copyright caducado de marca vigente (#310).

### Fase 5 — Distribución mantenible

- [ ] Automatizar artefactos reproducibles para plataformas validadas
      (las imágenes Docker se publican en GHCR; su ruta de publicación se ejercitó por primera vez
      el 2026-08-27 vía `workflow_dispatch`, que las etiqueta `manual` + SHA corto en lugar de con
      una versión. `espaciokooplagunak-server` y `-bridge` están publicadas y son públicas. Falta
      estrenar el disparo por tag `v*` y los artefactos nativos).
- [ ] Publicar notas de versión que separen cambios propios y de upstream.
- [ ] Establecer una cadencia segura de sincronización con EmptyEpsilon.

### Dirección de producto — standalone-first

La hipótesis de un juego standalone quedó **decidida** en el issue #219: el
producto principal será jugable, guardable y reanudable sin Foundry VTT, que
pasa a ser una integración opcional para las campañas de rol del grupo. La
autoridad de campaña (progreso, atlas, misiones, consecuencias) vive en el
núcleo de Espaciokoop Lagunak; la simulación conserva la del estado de la nave
(ADR-0008, que sustituye a ADR-0002). Divergir de EmptyEpsilon es aceptable
cuando aporte mejora tangible, siguiendo `docs/UPSTREAM.md` y con ADR propio.

Los principios innegociables, los no objetivos y las etapas con criterio de
salida y métrica de éxito están en
[`docs/ROADMAP_PRODUCTO.md`](docs/ROADMAP_PRODUCTO.md). La prioridad vigente es
la etapa A: cerrar el bucle vertical de fase 3 sin Foundry.

## Estructura del repositorio

| Ruta | Procedencia / propósito |
|---|---|
| `src/`, `scripts/`, `resources/`, `packs/` | Código, escenarios y recursos heredados principalmente de EmptyEpsilon |
| `CMakeLists.txt`, `cmake/` | Sistema de compilación original |
| `CHANGELOG.md` | Historial de cambios original de EmptyEpsilon |
| `LICENSE` | Licencia GNU GPL v2 conservada del proyecto original |
| `docs/` | Documentación específica del fork |
| `docker/` | Imagen del servidor headless y `compose.yaml` ([guía](docker/README.md)) |
| `bridge/` | Puente de integración con Foundry VTT ([contrato v0](bridge/README.md)) |
| `CONTRIBUTING.md` | Flujo colaborativo de Espaciokoop Lagunak |
| `AGENTS.md` | Reglas operativas para agentes de IA |
| `SECURITY.md` | Riesgos conocidos y cómo informar de vulnerabilidades |

Para conocer con precisión la relación con upstream, consulta [`docs/UPSTREAM.md`](docs/UPSTREAM.md).

## Compilación y desarrollo

La compilación necesita, como mínimo, un compilador C++17, CMake, SDL2 y una copia compatible de SeriousProton. No se incluye SeriousProton como submódulo: normalmente se clona junto a este repositorio y se indica su ruta a CMake.

Las instrucciones y el estado de validación están en [`docs/BUILDING.md`](docs/BUILDING.md). No interpretes estas instrucciones como garantía de compatibilidad en una plataforma no probada.

## Cómo colaborar

1. Lee [`CONTRIBUTING.md`](CONTRIBUTING.md).
2. Busca o crea un issue con alcance y criterio de aceptación claros.
3. Crea una rama desde `main`: `feature/<tema>`, `fix/<tema>` o `docs/<tema>`.
4. Haz un cambio pequeño y verificable.
5. Actualiza documentación y estado del roadmap si corresponde.
6. Abre un pull request; no hagas push directo a `main` tras el bootstrap.

Los agentes de IA deben leer además [`AGENTS.md`](AGENTS.md) antes de modificar archivos.

## Principios de colaboración humano–IA

- El issue y el pull request son la fuente compartida de contexto; no dependemos de conversaciones privadas.
- Nadie, humano o IA, afirma que algo funciona sin indicar cómo se comprobó.
- Una tarea debe declarar alcance, archivos afectados, pruebas y riesgos.
- No se mezclan objetivos independientes en un mismo pull request.
- No se fuerza `main` ni se reescribe trabajo ajeno.
- Los secretos nunca se copian a prompts, archivos, commits, logs o capturas.
- Una IA no debe realizar cambios destructivos, masivos o ambiguos sin autorización humana explícita.

## Ramas y remotos

- `origin`: fork de Espaciokoop Lagunak.
- `upstream`: repositorio oficial de EmptyEpsilon.
- `main`: rama estable e integrable del fork.
- Ramas de trabajo: cambios aislados, revisados mediante pull request.

La incorporación de cambios de EmptyEpsilon se realiza de forma explícita y sin `push --force`. Procedimiento completo: [`docs/UPSTREAM.md`](docs/UPSTREAM.md).

## Créditos del fork

Espaciokoop Lagunak cuenta con un equipo colaborativo humano–IA formado por
**Varo**, **Eloy «Gurucharri»**, **OTACON** y **Claude Fable 5**, la IA de apoyo
técnico de Gurucharri. Funciones, atribución y reconocimiento del proyecto
original: [`CREDITS.md`](CREDITS.md).

## Licencia y atribución

Este repositorio deriva de EmptyEpsilon y conserva su licencia **GNU General Public License, versión 2**. Consulta [`LICENSE`](LICENSE). Los autores originales mantienen la autoría de sus contribuciones; los cambios del fork pertenecen a sus respectivos contribuidores bajo la misma licencia aplicable.

Espaciokoop Lagunak no está afiliado ni respaldado oficialmente por el equipo de EmptyEpsilon.

## Recursos

- [EmptyEpsilon oficial](https://github.com/daid/EmptyEpsilon)
- [Web y manual oficial](https://daid.github.io/EmptyEpsilon/)
- [Guía de contribución del fork](CONTRIBUTING.md)
- [Asistente de instalación](docs/INSTALACION.md)
- [Compilación](docs/BUILDING.md)
- [Prueba individual de «Primera guardia»](docs/PRUEBA-INDIVIDUAL.md)
- [Despliegue con Docker](docker/README.md)
- [Integración con Foundry VTT y gestión de nave](docs/FOUNDRY.md)
- [Editor integrado de contenido](docs/CONTENT_EDITOR.md)
- [Puente de integración — contrato v0](bridge/README.md)
- [Inventario del API HTTP heredado](docs/seguridad/API_HTTP.md)
- [Inspiración en juegos libres — mecánicas de rol que robar](docs/INSPIRACION_JUEGOS_LIBRES.md)
- [Relación y sincronización con upstream](docs/UPSTREAM.md)
- [Política de versionado y releases](VERSIONING.md)
