# Roadmap de producto — sucesor espiritual cooperativo

Versión versionada y revisable de la dirección de producto acordada en el issue
[#219](https://github.com/EspacioKoop/espaciokooplagunak/issues/219). El issue sigue
siendo el hilo de discusión; este documento es el estado acordado.

**Espaciokoop Lagunak** evoluciona, por etapas jugables, hacia un juego
cooperativo **standalone** de tripulación: puestos interdependientes, una nave
que importa, exploración, misiones y consecuencias persistentes. *PULSAR: Lost
Colony* se cita como referencia de experiencia, no de código, arte ni universo:
la identidad, reglas y contenido de Espaciokoop son originales, y se preservan
la autoría, la GPLv2 y la historia de EmptyEpsilon.

## Principios innegociables

Estos principios se evalúan antes que cualquier etapa del roadmap. Una propuesta
que rompa uno de ellos se rechaza aunque encaje en la etapa en curso.

1. **Standalone-first.** El juego se juega, se guarda y se reanuda sin Foundry
   VTT. Pregunta de control para toda funcionalidad nueva: *¿sigue siendo
   jugable si Foundry desaparece?* Si la respuesta es no, esa responsabilidad
   pertenece al núcleo, no a la integración.
2. **Cooperación por información asimétrica.** Cada puesto ve y decide algo que
   los demás no; la coordinación no es un adorno de la interfaz.
3. **Una única autoridad por dato.** Ningún dato tiene dos fuentes de verdad
   (ver [ADR-0008](adr/0008-standalone-first-autoridad-del-nucleo.md)).
4. **Consecuencias persistentes.** Lo que pasa en una sesión se recupera en la
   siguiente.
5. **Integración Foundry siempre opcional.** Desactivarla no pierde la campaña
   ni la capacidad de jugar.
6. **Compatibilidad de partidas guardadas.** Ninguna etapa posterior invalida
   una partida creada en una etapa anterior sin un plan explícito de migración.

## No objetivos

- No es un MMO ni un juego con mundo persistente compartido entre grupos.
- No es una economía persistente ni un simulador de comercio.
- No es un simulador hardcore de vuelo o de física orbital.
- No es un FPS 3D: las expediciones se diseñan como verticales jugables propios.
- No es un clon de *PULSAR* ni una reimplementación de su contenido.
- No es un producto comercial: el material con licencia no libre solo entra por
  referencia legal o importación privada del usuario.

## Estrella polar jugable

Una campaña debe poder completar este bucle sin trucos privados:

1. Elegir un destino desde la campaña e interfaz propias y preparar el trayecto;
   una integración opcional podrá recibir ese contexto desde Foundry.
2. Ocupar puestos distintos en una nave compartida.
3. Navegar y gestionar energía, sensores, daños y recursos en tiempo real.
4. Resolver un encuentro con decisiones coordinadas, no solo DPS.
5. Resolver planetas, estaciones, abordajes y escenas con capacidades propias;
   las mesas que lo deseen podrán proyectarlas o continuarlas en Foundry.
6. Devolver a la campaña daños, descubrimientos, relaciones, botín y decisiones.
7. Guardar, cerrar y reanudar sin duplicar eventos ni perder estado.

El objetivo no es acumular features, sino que cada puesto tenga información y
decisiones propias que afecten al resto de la tripulación.

## Frontera de autoridad

| Dominio | Autoridad |
|---|---|
| Campaña, progreso, personajes, atlas, misiones y consecuencias | Núcleo de Espaciokoop Lagunak |
| Movimiento, combate, sistemas, energía, daños y estado operativo | Simulación de Espaciokoop Lagunak |
| Escenarios y encuentros tácticos | Lua + motor heredado |
| Adaptación opcional a Foundry, permisos y eventos tipados | Puente + módulo Foundry |

La integración Foundry consume o proyecta un subconjunto versionado del estado;
no es la fuente del atlas, la campaña ni la persistencia.

## Pilares de producto

1. **Cooperación por puestos**: capitán, navegación, ingeniería, sensores,
   comunicaciones y armas con permisos, información parcial y acciones
   complementarias.
2. **La nave como personaje compartido**: configuración, módulos, energía,
   temperatura, averías, reparación, carga y evolución persistente.
3. **Exploración con decisiones**: atlas de planos/sistemas/mundos, rutas con
   coste y riesgo, señales, anomalías, facciones y descubrimientos.
4. **Encuentros con alternativas**: combate, negociación, huida, rescate,
   infiltración o investigación; el resultado vuelve a la campaña.
5. **Campaña persistente**: reputación, estado de nave, recursos, misiones y
   consecuencias recuperables tras reinicio.
6. **Director de juego asistido, no sustituido**: herramientas para preparar e
   inyectar eventos y, más adelante, generación procedural revisable.
7. **Contenido modular y original**: escenarios y catálogos versionados,
   validables y redistribuibles.

## Decisiones de producto acordadas

| Pregunta | Acuerdo |
|---|---|
| Jugadores objetivo | 1–10; banda ideal 3–6. El mínimo jugable es 1 con puestos asistidos |
| Alcance de la integración Foundry | Solo la capa de rol de la mesa; nunca requisito del juego |
| Base de reglas de rol | SRD 5.1 (5e 2014) bajo **CC BY 4.0**, con atribución — no «fair use»; nada de reglas 2024 |
| Comportamiento de puestos vacíos | Política acordada en [#512](https://github.com/EspacioKoop/espaciokooplagunak/issues/512): sin IA autónoma; conservar el último valor y avisar de que el puesto está vacío |
| Divergencia de upstream | Permitida cuando aporte mejora tangible, siguiendo [UPSTREAM.md](UPSTREAM.md) y con su propio ADR |

Pendientes de acordar entre Varo y Eloy: límite inicial de expediciones
(narrativo en Foundry frente a vista táctica propia), equilibrio entre campaña
escrita y generación procedural, y reparto de la progresión entre nave,
tripulación y campaña.

## Etapas

Cada etapa tiene un **criterio de salida** técnico y una **métrica de éxito** de
experiencia. La etapa no está terminada hasta cumplir ambos: que las piezas
técnicas existan no basta.

Las matrices siguientes son una vista derivada de GitHub: se actualizan cuando
cambia el estado verificable de un criterio, no por cada PR. `IMPLEMENTED`
acredita que el artefacto existe en `main`, no que el criterio de producto esté
demostrado. Un issue o PR abierto se cita como pendiente, no como evidencia. Los
únicos estados admitidos son `PLANNED`, `IN_PROGRESS`, `IMPLEMENTED`,
`HUMAN_VERIFY`, `DONE` y `BLOCKED`.

### Etapa A — Cerrar el bucle vertical de fase 3

Una sesión standalone completa: trayecto → incidente → resolución → registro
persistente, con varios puestos conectados.

- completar el smoke real multijugador (#29);
- encuentro normalizado y controlado (#117, #199);
- energía y sistemas operables según permisos (#216);
- destino y estado de campaña propios, sin depender del atlas de Foundry
  (#213/#214 quedan como catálogo e integración opcionales);
- control GM acotado y observable (#176).

**Criterio de salida:** el bucle de estrella polar se completa sin Foundry, con
contenido original y documentación pública; con Foundry activo se recibe además
el resultado narrativo sin cambiar la autoridad del juego.

**Métrica de éxito:** un grupo nuevo juega el vertical sin asistencia de quien
lo desarrolló, siguiendo solo la documentación publicada.

| Criterio | Evidencia | Estado | Pendiente |
|---|---|---|---|
| Smoke real multijugador de la integración opcional | **No existe evidencia multijugador registrada**; [#29](https://github.com/EspacioKoop/espaciokooplagunak/issues/29) es solo un smoke GUI con GM y no valida varios clientes ni una sesión multijugador completa | `BLOCKED` | Ejecutar y registrar una validación multijugador específica con clientes conectados |
| Encuentro normalizado y controlado | PR [#196](https://github.com/EspacioKoop/espaciokooplagunak/pull/196), [#200](https://github.com/EspacioKoop/espaciokooplagunak/pull/200), [#201](https://github.com/EspacioKoop/espaciokooplagunak/pull/201) y [#220](https://github.com/EspacioKoop/espaciokooplagunak/pull/220), con pruebas del puente y del módulo | `IMPLEMENTED` | Demostrarlo dentro del bucle standalone completo |
| Energía y sistemas operables según permisos | PR [#217](https://github.com/EspacioKoop/espaciokooplagunak/pull/217) para GM y verticales de puesto [#472](https://github.com/EspacioKoop/espaciokooplagunak/pull/472), [#475](https://github.com/EspacioKoop/espaciokooplagunak/pull/475), [#476](https://github.com/EspacioKoop/espaciokooplagunak/pull/476) y [#487](https://github.com/EspacioKoop/espaciokooplagunak/pull/487) | `IMPLEMENTED` | Demostrarlo dentro del bucle standalone completo |
| Destino y estado de campaña propios, sin autoridad de Foundry | **No existe evidencia integrada**: [#213](https://github.com/EspacioKoop/espaciokooplagunak/issues/213)/[#214](https://github.com/EspacioKoop/espaciokooplagunak/pull/214) solo cubren catálogo y adaptador opcionales de Foundry | `PLANNED` | Implementar y registrar destino, campaña y persistencia standalone |
| Control GM acotado y observable | PR [#202](https://github.com/EspacioKoop/espaciokooplagunak/pull/202), [#218](https://github.com/EspacioKoop/espaciokooplagunak/pull/218) y [#294](https://github.com/EspacioKoop/espaciokooplagunak/pull/294), con órdenes cerradas y eventos idempotentes | `IMPLEMENTED` | Demostrarlo dentro del bucle completo |
| Salida A: bucle de estrella polar sin Foundry y resultado opcional hacia Foundry | **No existe evidencia end-to-end registrada**; el runbook de [#29](FOUNDRY_GUI_SMOKE.md) excluye varios clientes y una sesión completa | `BLOCKED` | Completar la persistencia standalone de [#766](https://github.com/EspacioKoop/espaciokooplagunak/issues/766) y después ejecutar el playtest reproducible de [#219](https://github.com/EspacioKoop/espaciokooplagunak/issues/219) |

### Etapa B — Juego cooperativo de tripulación

- permisos y acciones reales por puesto;
- alarmas compartidas y dependencias entre sistemas;
- guardias y relevo de puestos;
- crisis que exijan coordinación entre al menos tres funciones;
- automatización limitada para puestos vacíos.

**Criterio de salida:** cada puesto ocupado dispone de una decisión exclusiva que
puede cambiar el resultado del encuentro.

**Métrica de éxito:** en un playtest, ningún jugador puede describir su puesto
como «mirar mientras otro juega».

| Criterio | Evidencia | Estado | Pendiente |
|---|---|---|---|
| Permisos y acciones reales por puesto | [Modelo de permisos](PERMISOS_PUESTO.md), PR [#478](https://github.com/EspacioKoop/espaciokooplagunak/pull/478) y verticales integrados [#472](https://github.com/EspacioKoop/espaciokooplagunak/pull/472), [#475](https://github.com/EspacioKoop/espaciokooplagunak/pull/475), [#476](https://github.com/EspacioKoop/espaciokooplagunak/pull/476), [#486](https://github.com/EspacioKoop/espaciokooplagunak/pull/486) y [#487](https://github.com/EspacioKoop/espaciokooplagunak/pull/487) | `IMPLEMENTED` | Validar la agencia percibida en #467 |
| Alarmas compartidas y dependencias entre sistemas | PR [#494](https://github.com/EspacioKoop/espaciokooplagunak/pull/494) y sus pruebas de alarma cruzada | `IMPLEMENTED` | Validar en partida real junto con #467 |
| Guardias y relevo de puestos | PR [#496](https://github.com/EspacioKoop/espaciokooplagunak/pull/496) y sus pruebas de relevo | `IMPLEMENTED` | Validar en partida real junto con #467 |
| Crisis que exige coordinación entre tres o más funciones | [Diseño causal y límites](CRISIS_MULTIPUESTO.md), issue [#484](https://github.com/EspacioKoop/espaciokooplagunak/issues/484) y PR [#546](https://github.com/EspacioKoop/espaciokooplagunak/pull/546) | `IMPLEMENTED` | Playtest humano #467; esta implementación no cierra por sí sola la Etapa B |
| Automatización limitada para puestos vacíos | [#481](VERIFICACION-NAVEGACION-Y-AUTOMATIZACION.md#481--automatización-nativa-de-puestos-sin-tripulación) demuestra que no existe automatización nativa; la [tabla de decisiones](#decisiones-de-producto-acordadas) formaliza la política de #512, sin acreditar que el aviso esté implementado | `PLANNED` | Implementar y probar en [#951](https://github.com/EspacioKoop/espaciokooplagunak/issues/951) el aviso para puestos vacíos |
| Salida B: cada puesto tiene una decisión exclusiva que cambia el encuentro; nadie queda mirando | **No existe documento de playtest**; [#467](https://github.com/EspacioKoop/espaciokooplagunak/issues/467) define la validación humana pendiente | `HUMAN_VERIFY` | Ejecutar y registrar el playtest de 3+ personas de #467; hasta entonces la Etapa B no está cerrada |

Desglose de coordinación del vertical de agencia en #459, con subissues
formales y grafo de dependencias explícito:

- #460 — **cerrado**: auditoría de las pantallas nativas restantes
  ([`SESION-PANTALLAS-NATIVAS.md`](SESION-PANTALLAS-NATIVAS.md), PR #515). Su
  conclusión cambió el plan de la etapa: las seis pantallas **sí** tienen
  agencia real, así que el hueco no era construirla sino exponerla — de ahí
  nació #516.
- #461 — **mergeado**: modelo de permisos por puesto v1
  (`docs/PERMISOS_PUESTO.md`, ADR-0009, PR #478).
- #462 — **mergeado**: `scan_object` en `STATION_ACTIONS.sensors`, backend
  (PR #472) y UI de consola (PR #486).
- #463 — **mergeado**: `answer_comm_hail`/`close_comm`/`send_comm_reply`/
  `send_comm_message` en `STATION_ACTIONS.communications` (PR #475).
- #464 — **mergeado**: `set_auto_repair` en `STATION_ACTIONS.engineering`
  (PR #476) — mover reparadores a mano (`commandCrewSetTargetPosition`)
  queda pendiente de un issue de seguimiento si se prioriza, porque exige
  registrar un global Lua nuevo en C++.
- #465 — **mergeado**: `set_weapon_target`/`fire_tube` en
  `STATION_ACTIONS.weapons` (PR #474/#487).
- #466 — **mergeado**: feedback 3D de `set_auto_repair` en el casco de
  ingeniería, `casco-dano.mjs` (PR #477) — depende de al menos uno de
  #462–#465.
- #467 — playtest del vertical de agencia de Etapa B: **único subissue abierto**
  del grafo, y no se puede cerrar desde código porque exige una sesión con 3+
  personas en puestos distintos.
- #516 — **cerrado**: B8, exponer la agencia nativa que ya existía en el núcleo,
  nacido del hallazgo de #460. Sus seis subissues resueltos: #517 Relay entero
  (PR #529), #518 ingeniería —autodestrucción y frecuencia de escudos— (PR
  #530), #519 navegación —maniobra de combate y atraque— (PR #528), #520
  sensores —base de datos científica y vista de sonda— (PR #531), #522 Damage
  Control (PR #533), y #521 hackeo de Relay resuelto **por decisión y no por
  código**: se queda solo-nativo, registrado en
  [ADR-0010](adr/0010-hackeo-solo-nativo.md) en vez de abrir un binding C++
  nuevo. Ninguna orden nueva relajó la matriz de autoridad: el puesto se sigue
  resolviendo desde el `User` autenticado (#237) y todo entra por la lista
  blanca versionada del puente.

Este grafo valida el criterio de salida de agencia, pero no cierra por sí solo
toda la Etapa B. Sus otros frentes están trazados en #479: #480 (navegación
operacional — **satisfecho**, ver
[`VERIFICACION-NAVEGACION-Y-AUTOMATIZACION.md`](VERIFICACION-NAVEGACION-Y-AUTOMATIZACION.md)
y [`SESION-NAVEGACION-OPERACIONAL.md`](SESION-NAVEGACION-OPERACIONAL.md):
`set_target_heading`/`set_impulse`/`set_warp` ya son una decisión exclusiva
del puesto que cambia el resultado de un encuentro), #481 (automatización de
puestos vacíos — **verificado: no existe automatización nativa**, sistema sin
tripulación queda congelado en su último valor; la decisión de diseño sobre
qué comportamiento adoptar queda trazada en #512, ver
[`VERIFICACION-NAVEGACION-Y-AUTOMATIZACION.md`](VERIFICACION-NAVEGACION-Y-AUTOMATIZACION.md)),
#482 (alarmas compartidas por dependencia entre sistemas — **mergeado**, PR
#494: es dependencia entre sistemas, distinta del nivel de alerta de #338 en
`nivel-alerta.mjs`), #483 (guardias y relevo — **mergeado**, PR #496) y #484
(crisis que exijan coordinación entre al menos tres puestos — **cerrado**: el
arquetipo `ambush`, la emboscada de ecos, es el caso concreto del criterio de
salida de la etapa; qué puesto hace qué y por qué es necesario está
en [`CRISIS_MULTIPUESTO.md`](CRISIS_MULTIPUESTO.md), y su playtest con personas
sigue siendo #467). Antes de declarar la etapa completada deben
quedar todos trazados y satisfechos.

**Estado a 2026-09-03**: quedan dos frentes abiertos: #467 (playtest con 3+
personas, que puede usar la crisis de #484 como su escenario de prueba y no se
puede cerrar solo con código) y #951 (implementar y probar el aviso para puestos
vacíos según la decisión de #512 formalizada arriba; #481 verificó que hoy no
hay automatización nativa alguna). La etapa está, por tanto, esperando a una
sesión con personas y a esa implementación, no a otra decisión de producto.

### Etapa C — Nave persistente y progresión

- esquema estable de nave, módulos y carga sobre el editor declarativo (#55);
- daños y reparaciones que sobrevivan al final del escenario;
- mejoras con compromisos reales (potencia, masa, calor, alcance, capacidad);
- guardado, migración, exportación e importación segura;
- recuperación comprobada tras cierre y reinicio.

**Criterio de salida:** dos sesiones consecutivas usan la misma nave y la segunda
refleja consecuencias verificables de la primera.

**Métrica de éxito:** la tripulación reconoce su nave —habla de averías y mejoras
concretas— sin consultar un fichero de estado.

### Etapa D — Exploración y campaña galáctica

- atlas standalone `plane → star_system → planet` con procedencia por entrada;
  #213/#214 pasan a ser proyección o importación opcional para Foundry;
- rutas alternativas con peligro, duración y requisitos;
- estaciones, facciones, contratos y cadenas de misión originales;
- mapa táctico generado o seleccionado a partir del contexto narrativo, sin
  convertir el atlas en `MapDocument`;
- descubrimientos y reputación persistentes.

**Criterio de salida:** la tripulación elige entre varios destinos y la elección
modifica misión, riesgos y oportunidades posteriores.

**Métrica de éxito:** dos grupos que parten del mismo estado inicial cuentan
campañas distintas.

### Etapa E — Encuentros, abordajes y expediciones

- biblioteca de encuentros espaciales componibles;
- transición explícita entre simulación de nave y expedición propia, con
  adaptador Foundry opcional;
- abordaje, planeta o estación resolubles sin Foundry;
- objetivos no bélicos y condiciones de retirada o fracaso interesantes;
- herramientas GM para intervenir sin corromper la autoridad del simulador.

**Criterio de salida:** una misión encadena vuelo, encuentro y escena exterior, y
conserva sus consecuencias al volver a la nave.

**Métrica de éxito:** un grupo completa una misión sin disparar y la considera
una victoria.

### Etapa F — Director procedural y universo vivo

Solo cuando los bucles manuales sean divertidos y estables.

- plantillas de misión y encuentros con semillas reproducibles;
- actividad de facciones y cambios del atlas por eventos;
- tripulación asistida para mesas pequeñas y modo individual;
- dificultad adaptada mediante reglas explícitas, nunca trampas invisibles;
- contenido generado siempre revisable por el GM antes de entrar en campaña.

**Criterio de salida:** se inicia una campaña original y reproducible sin
preparar cada encuentro a mano, manteniendo control humano.

**Métrica de éxito:** una sesión generada es indistinguible en calidad de una
preparada a mano para quien la juega.

### Etapa G — Producto mantenible

- saves versionados y migrables;
- compatibilidad de red y protocolo;
- artefactos instalables para plataformas verificadas;
- paquetes de contenido originales;
- telemetría de rendimiento y recuperación ante desconexión;
- sincronización regular con upstream sin volver el fork inmantenible.

**Criterio de salida:** una versión publicada se instala y se juega en las
plataformas soportadas desde el artefacto, sin compilar.

**Métrica de éxito:** alguien ajeno al grupo instala, juega y reporta sin
intervención directa de quienes lo desarrollan.

## Disciplina de entrega

- Este documento es brújula de producto, no una cola de trabajo.
- Cada etapa se trocea solo cuando existe un vertical jugable y un criterio de
  salida claro.
- Cada PR debe mejorar una sesión real y conservar rollback, pruebas y autoridad
  de datos.
- El README se actualiza cuando una capacidad está integrada y verificada.
- Un render, un endpoint o un editor aislado no cierran una etapa sin su bucle
  jugable.

## Frentes transversales

Las etapas A–G describen qué se juega. Estos cuatro frentes describen bajo qué
condiciones se entrega, corren **en paralelo a todas** ellas y no son una etapa
nueva: ninguno añade una capacidad jugable, y ninguno puede usarse para posponer
la etapa A. Se listan aquí porque hoy consumen trabajo real que el documento no
representaba, y porque su forma de fallar es silenciosa — una etapa se cierra
sin cumplirlos y nadie lo nota hasta mucho después.

Regla común: **un frente transversal se verifica por un mecanismo, no por un
número**. Donde no exista todavía una comprobación automática, este documento lo
dice en vez de inventar una cifra que nadie mide.

### T1 — Higiene arquitectónica y deuda de entrega

- **Objetivo:** reforzar contratos ya existentes (errores HTTP del puente,
  idempotencia, validación de esquemas) y recuperar trabajo que se quedó sin
  llegar a `main`, sin introducir funcionalidad nueva.
- **Cómo se verifica:** cada PR de este frente es atómico y su suite de área pasa
  en CI; el trabajo rescatado se comprueba contra el estado actual de `main`
  antes de reabrirse, según el procedimiento de rescate de
  [`CONTRIBUTING.md`](../CONTRIBUTING.md) y la regla de ramas huérfanas de
  [`CLAUDE.md`](../CLAUDE.md).
- **Trabajo vinculado:** #715 (tanda de quick wins, abierto), #667 (37 tarjetas
  cerradas cuyo trabajo nunca llegó a un PR, abierto), PR #750 (errores 502 del
  puente, **mergeado**).
- **Criterio de salida:** no hay tarjetas cerradas sin PR pendientes de triar, y
  la deuda táctica deja de aparecer como bloqueo en los frentes de producto.

### T2 — Contratos de calidad transversales

- **Objetivo:** que accesibilidad, seguridad y rendimiento sean invariantes
  escritos que apliquen a toda superficie nueva, y no criterio de cada PR.
- **Cómo se verifica:** el contrato de animación accesible está escrito y es
  exigible (`prefers-reduced-motion`, regresión de foco, mutación negativa); la
  baseline de accesibilidad del módulo (#227) ya está cerrada y vigilada por su
  suite. Lo que aún **no** está automatizado es el modelo de amenazas de la capa
  lúdica.
- **Trabajo vinculado:** #694 (criterio de animación accesible, abierto) con su
  PR #747 **mergeado**, #227 (**cerrado**), #700 (modelo de amenazas de la capa
  lúdica, abierto).
- **Criterio de salida:** cada contrato de esta lista tiene una puerta de CI que
  lo comprueba, o una razón escrita de por qué no puede tenerla.

### T3 — Experiencia de desarrollo y contexto para agentes

- **Objetivo:** que el contexto del repositorio sea reproducible para personas y
  para agentes, y que las convenciones vivan en ficheros versionados
  ([`AGENTS.md`](../AGENTS.md), [`CLAUDE.md`](../CLAUDE.md),
  [`docs/TRABAJO_PARALELO_AGENTES.md`](TRABAJO_PARALELO_AGENTES.md)) en vez de
  en la cabeza de quien lleva más tiempo.
- **Cómo se verifica:** el contrato operativo está en el árbol y se corrige en el
  mismo PR que invalida su prosa. No hay métrica de tiempo de incorporación: no
  se mide, y ponerle un número sería inventarlo.
- **Trabajo vinculado:** #749 (contexto local del espacio de trabajo,
  **cerrado**), #705 (roadmap vivo y grafo de arquitectura para agentes,
  **cerrado**), #717 (auditoría y automatización de labels, abierto).
- **Criterio de salida:** ningún paso de puesta en marcha depende de instrucciones
  que solo existan en un hilo de issue.

### T4 — Localización y QA editorial

- **Objetivo:** coherencia terminológica y naturalidad en los idiomas soportados,
  tanto en el juego nativo como en el módulo.
- **Cómo se verifica:** el lint de i18n en CI cubre la forma (claves, marcadores);
  la naturalidad no la cubre ninguna máquina y exige revisión humana, que es
  exactamente lo que #28 sigue esperando desde julio.
- **Trabajo vinculado:** #28 (playtest y revisión humana ES-ES, abierto), #698
  (volúmenes que no superan el filtro de dominio público, abierto), #699
  (frontera editorial de la capa lúdica, abierto).
- **Criterio de salida:** #28 se cierra con un playtest humano registrado y sin
  hallazgos P1 abiertos.

## El frente paralelo: espacios andables y catálogo de contenido

Hay una cadena de trabajo que no aparece en las etapas de arriba y que ha crecido
mucho: el motor de escenas del módulo de Foundry (`retro3d`), los espacios por
los que se anda dentro de la nave, el kit de escenas de #589 y el catálogo de
assets con procedencia (#571, #590, #598). Dejarla sin mencionar haría que este
documento describiera un proyecto que ya no es el que hay.

- **Andar por la nave** (#427): el frente con más actividad reciente. Su tanda de
  correcciones estructurales está **cerrada** — #539 (era injugable: huecos,
  puertas contra las que golpearse y una escala por sala), #540 (la planta sale
  del interior real del Phobos declarado en `frigates.lua`, no de una geografía
  inventada), #541 (por las ventanas se ve el espacio real de la partida),
  #542 (la sección enseña esa misma planta) y #577 (sección, andar y cantina son
  tres puertas a una sola geografía). Lo que queda no es corregir sino decidir
  qué se recorre.
- **Línea experimental de `retro3d`** (#603): esqueleto, deformación y
  retargeting para PC, NPC y bestiario, en una línea separada del kit de
  escenas (#589).
- **Audición opcional con Freesound** (#604): búsqueda y escucha sin ingestión
  de assets, y sin saltarse la ficha de procedencia cuando un sonido entra al
  árbol.

**No es una etapa nueva ni compite con la A.** Es infraestructura de contenido, y
su sitio en este roadmap es el de una herramienta: existe para que las etapas C
(nave persistente), D (exploración) y E (encuentros y expediciones) puedan
producir sitios sin que cada uno sea un proyecto de ingeniería.

Su disciplina propia, que la mantiene subordinada:

- **Se mide por coste de escena, no por features.** La métrica de #589 es que una
  escena nueva salga en 1–3 PRs y el último no toque ningún módulo compartido.
  Mientras la escena N+1 siga obligando a tocar el motor, el kit no está
  terminado por muchas piezas que tenga.
- **No concede, no cuenta y no recuerda.** Una escena de Foundry puede enseñar,
  transportar y ambientar; la autoridad de campaña sigue siendo del núcleo. La
  regla está escrita en [`FOUNDRY.md`](FOUNDRY.md) y es lo que impide que este
  frente se convierta en un juego paralelo dentro del módulo.
- **Nada de arte ajeno sin ficha.** Obra, qué es el fichero, autoría del archivo,
  licencia exacta, enlace y sha256 — y la herramienta de importación se niega a
  convertir lo que no la tenga.

**Qué NO justifica.** No justifica adelantar contenido de campaña antes de la
etapa A, ni construir sitios que la mesa no vaya a visitar. La playa es un banco
de pruebas y está declarada como tal; el día que un exterior sea contenido, entra
por el bucle de producto y no por el de infraestructura.

### Dónde está hoy este frente, y su deuda

Medido el 2026-08-20 y revisado el 2026-08-28, para que la regla de arriba no se
lea como si ya se cumpliera:

- **La mesa todavía no visita nada de esto.** La playa (#587) y la sala del museo
  (#598) no cuelgan de ninguna puerta de la nave —su lista de puertas está
  vacía—, así que las abre el GM desde la barra de escena y nadie más las pisa.
  Cada pieza que se les añada la ve una sola persona. Es la deuda que hay que
  pagar antes de meter más contenido, no después — y sigue sin pagarse: la tanda
  cerrada de #427 arregló la geografía por la que se anda, no quién entra en
  estas dos salas.
- **Hay 18 mallas 3D en el árbol y el museo enseña 3.** Todas con procedencia
  verificada (escaneos de vaciados del *Statens Museum for Kunst*, CC0 1.0). Lo
  que falta no es licencia ni código: es la **cartela** de cada pieza, que es
  trabajo humano y no escala con el código. Ya lo decía #590 y sigue siendo el
  cuello de botella real de este frente.
- **Los cuatro PNG del módulo están vigilados**, por dos mecanismos distintos: la
  textura de muro con una puerta en el flujo de trabajo y los tres del horizonte
  con `horizonte-matte.test.mjs`, que compara lo guardado con lo que el generador
  produce. Que el generador del horizonte no acepte `--check` no es un agujero:
  es que su comprobación vive en la suite, no en la línea de órdenes.

## Prioridad vigente

La **etapa A** es la única prioridad de producto hasta completar un playtest
público reproducible y standalone del trayecto completo. Después se decide, con
partidas jugadas y no por adelantado, si el siguiente cuello de botella está en
puestos, persistencia de nave o contenido de misión.
