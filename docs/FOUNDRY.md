# Integración con Foundry VTT y gestión de nave

Este documento define la dirección inicial para usar Espaciokoop Lagunak como simulador operativo de nave dentro de campañas gestionadas con [Foundry Virtual Tabletop](https://foundryvtt.com/), especialmente aventuras de ambientación espacial como *Spelljammer*.

## Estado real

La base técnica de la integración (Fase 2 del roadmap) está **implementada y
verificada en local** (2026-07-12, x86-64):

- Imagen Docker reproducible del servidor headless y `compose.yaml` con red
  interna ([`docker/README.md`](../docker/README.md)).
- Puente con contrato v0 — lecturas seguras y órdenes de lista blanca, sin
  ejecución de Lua arbitrario ([`bridge/README.md`](../bridge/README.md)).
- Verificación end-to-end: `compose up` → `/healthz` → `/v1/state` con datos
  reales del escenario → orden `set_impulse` con efecto observable en la
  simulación → `/exec.lua` inaccesible desde el host.

**El módulo de Foundry VTT ya cubre al director de juego y una primera capa de
tripulación**: muestra el estado en vivo vía polling, permite anotarlo en un
diario, ofrece controles GM cerrados de tempo, reposición, ingeniería y
maniobra, y permite asignar puestos con espacios operativos propios: cada
tripulante emite las órdenes de su puesto, que un relé del GM ejecuta contra
el puente (#162, #176, #216, #236/#238/#240; ver «Permisos por puesto» abajo).
Instalación, configuración y estado de verificación en
[`foundry-module/README.md`](../foundry-module/README.md). Existe evidencia
humana positiva en v11.302 y en un host moderno, pero la matriz completa de
versión, consola limpia y ausencia de secretos sigue abierta en #29; la licencia
de Foundry impide cubrirla en CI. El resto de este documento describe la visión
completa, de la que está construida esa base.

El transporte del contrato v0 queda fijado en **polling HTTP** (issue #6). El
primer evento vertical es la llegada de «Primera Guardia»: el escenario crea
un marcador interno acotado, el puente lo normaliza en `GET /v1/events` y el
módulo lo escribe una sola vez en Journal mediante un `eventId` persistente.
WebSocket queda aplazado hasta que haya una necesidad de latencia medida.

El trayecto inicial publica Argia como destino mediante un marcador interno de
la sesión. `/v1/state` calcula distancia restante y ETA a partir de la posición
y velocidad reales; la ETA es nula cuando la nave está detenida. El módulo
formatea estos datos para el GM sin asumir que otros escenarios tengan ruta.

`/v1/state` publica también `radar` con el alcance real de la nave
(`short_range` / `long_range`, del componente `long_range_radar`), y es `null` si
el componente no se puede leer. Existe para #331 paso 3: los contactos que el GM
difunde a la tripulación van **degradados por ese alcance** y no por dos
constantes elegidas a ojo. Dentro del alcance corto el contacto se identifica
(indicativo y facción); entre el corto y el largo es un eco, sin nombre y sin
bandera; más allá del largo no se publica y **tampoco se cuenta**, porque un total
que incluyera lo invisible ya diría que hay algo ahí fuera.

No se difunden coordenadas absolutas de nada, sino **distancia y marcación**
relativas, redondeadas a la resolución de su banda y acompañadas de ese margen.
Son dos motivos y el segundo manda: la tripulación no recibe la posición de su
propia nave, así que unas coordenadas de mundo no le servirían de nada; y
difundir la posición exacta de cada objeto del sector a un ajuste que toda la mesa
puede leer es justo la fuga que la degradación existe para cerrar. Un puesto de
sensores lee alcance y marcación, y eso es lo que se publica.

La consola del puesto lo enseña como filas: el margen se escribe (`≈20 000 ±1 000
· ≈75° ±15°`) en vez de insinuarse, y un eco se llama eco y no «desconocido» —
«desconocido» suena a que hay un nombre y no se ha averiguado; un eco es que el
sensor solo devuelve un retorno, y esa diferencia es el trabajo del puesto. Una
lectura exacta no lleva `±`, o todo parecería aproximado.

La degradación ocurre en el cliente del GM, antes de difundir, y no al pintar: el
sobre acaba en un ajuste de mundo que toda la mesa puede leer, así que recortar en
la vista no defendería nada. Sin lectura de radar no se difunde ningún contacto —
«no se puede decidir qué ve esta nave» no es «no ve nada», y ante esa duda se
calla. El GM conserva su sondeo crudo: degradar a la tripulación no le quita
precisión a quien dirige.

`/v1/state` publica además el atraque de la nave propia (#391) en `docking`:
`state` vale `docking` o `docked` y **nunca un tercer valor**, con el objetivo en
`target` (indicativo y clase) cuando se puede leer. Sale del componente
`docking_port` del juego, que ya expone `state` y `target` a Lua, así que no hay
divergencia con upstream. El binding entrega ese enum como cadena en minúsculas
(`docking`, `docked`, `not_docking`, `none`: ver `src/script/enum.h`); el puente
normaliza a minúsculas y descarta todo lo demás, `not_docking` incluido.
`docking` es `null` tanto si la nave está libre como si el componente no se pudo leer: son dos cosas distintas que el juego no distingue
desde fuera, y por eso la consola no dibuja «sin atracar» —afirmarlo sería elegir
una de las dos sin saber cuál—. El estado va en texto en la consola; cualquier
representación visual futura es refuerzo, no la única vía al dato.

El control de tempo inicial es binario: `pauseGame()` / `unpauseGame()` son las
únicas APIs verificadas en headless. No se ofrece aceleración ni se inventa un
estado consultable porque `setGameSpeed`, `getGameSpeed` y un getter de pausa no
existen en la API Lua observada.

### La barra de escena: qué se agrupa y qué no (#448)

Toda herramienta del módulo vive en el **grupo propio `lagunak`** de la barra de
controles de escena, nunca mezclada con Token Controls (#125). El grupo lo crea
`main.mjs`; las herramientas entran por `control-escena.mjs`, que es quien
absorbe la diferencia de forma entre generaciones de Foundry (array de grupos en
v11/v12, registro por nombre con `order`/`onChange` en v13).

Cuando varias entradas son variaciones de la misma acción, se sustituyen por una
**puerta con catálogo interno** (`puerta-catalogo.mjs`), como ya hacen la cantina
(#423), la sección de la nave (#427) y el panel de GM (#457).

El criterio para decidir qué entra en una puerta **no es el permiso ni el número
de botones**, sino la frecuencia de uso:

> Agrupar lo que se utiliza puntualmente; mantener accesible lo que se utiliza
> durante la partida.

Por eso el espacio de puesto no se esconde tras una puerta aunque comparta rol
con otras entradas: es la consola que un tripulante usa toda la sesión, y
enterrarla le cobra un clic extra cada vez a cambio de un botón menos. Agrupar
por permisos, o reducir el número de botones al mínimo, convierte el catálogo en
una carpeta donde se mete cualquier cosa para hacer desaparecer botones.

Una puerta **solo pinta**: no transporta identidad. Cada superficie resuelve su
propia autoridad leyendo `game.user` al abrirse, así que meter una entrada en una
puerta no añade caminos nuevos hacia el relé (#237).

### Andar, sección y cantina: una geografía y tres puertas (#577)

Que dos entradas de la barra estén juntas o separadas es la decisión anterior;
esta es otra: tres de ellas —`lagunak-andar-nave` (#444), `lagunak-seccion`
(#427/#276) y `lagunak-cantina` (#423)— dan acceso a **la misma geografía**, la
nave. Aparecer como puertas independientes no las hace tres naves distintas, y
sin decidir cuál manda se acaban manteniendo varias representaciones del mismo
sitio con estados que se van separando.

La jerarquía es:

> **Andar es la navegación principal; la sección es el mapa; la cantina es un
> acceso directo.**

- **Andar** — la superficie principal. Es donde el jugador está realmente dentro
  de la nave y recorre su geografía. Toda estancia por la que se pueda caminar es
  una estancia **de Andar**, aunque no salga de la rejilla nativa: así entraron
  la cantina (#540) y la terraza (#579), y así entrará lo que venga.
- **Sección** — vista general de esa misma nave. Sirve para orientarse y elegir
  destino (`seleccionar sala → abrir Andar en esa sala`), no para estar.
- **Cantina** — atajo a una sala concreta. Es una comodidad legítima, igual que
  un mapa lo es aunque el sitio se pueda recorrer a pie, pero **no** una
  geografía paralela.

De ahí sale la regla operativa: llegar a un sitio por el atajo y llegar andando
dejan en el **mismo estado espacial canónico**, y pueden diferir solo en la
cámara o el punto de entrada. Un espacio nuevo no se añade, por tanto, como una
cuarta puerta de la barra: se añade como estancia de Andar con su paso desde la
estancia vecina, y si merece atajo, el atajo es una entrada más — nunca su única
forma de existir.

### Qué puede hacer una escena de Foundry, y qué no

Los exteriores (#587, y los que vengan por el kit de escenas de #589) plantearon
una duda razonable sobre el ADR-0008: si el módulo se inventa una playa entera
que el núcleo no conoce, ¿sigue siendo cierto que la partida es jugable sin
Foundry?

La pregunta útil **no es «¿dónde vive la escena?» sino «¿la escena concede
algo?»**. El ADR no dice que Foundry no pueda pintar; dice que la autoridad de
campaña —progreso, atlas, misiones, consecuencias— es del núcleo, y que el módulo
es proyección y adaptación, no almacenamiento. La regla, entonces:

> Una escena de Foundry puede **enseñar, transportar y ambientar**. No puede
> **conceder, contar ni recordar**.

La playa la cumple hoy: su único punto de interacción cambia de estancia, o sea,
mueve la cámara. Andar por ella no da nada, no lleva la cuenta de nada y no deja
rastro. Si Foundry desaparece, no se pierde partida: se pierde un sitio bonito.

El día que un exterior tenga pesca que dé un recurso, un hallazgo que abra una
misión o una estatua que registre un descubrimiento, **ese estado es del núcleo y
la escena solo pinta el efecto** — el mismo reparto que ya sigue la asistencia
entre puestos, que no emite órdenes sino que produce algo que gasta su titular.
Diseñar dónde se guarda un pez antes de que exista la pesca es adelantarse; tener
escrito que no se guarda en Foundry, no.

Corolario para el cielo de la playa: **sus planetas son cielo, no atlas**. Ningún
punto de interacción los nombra ni los cruza con el catálogo cosmográfico, porque
en cuanto lo hicieran pasarían a afirmar cosmografía que nadie ha decidido.

Hay también una herramienta del grupo que es **solo-GM sin ser información
privilegiada**: la playa (#587). No se oculta porque revele nada —una
playa no dice nada de la partida— sino porque **no es contenido**: es un banco de
pruebas del motor de exteriores, y ofrecérsela a la tripulación en la misma barra
que su puesto afirmaría que forma parte del juego. El criterio, entonces, no es
solo «permiso» ni «frecuencia», sino también *qué se le está diciendo a quien lo
ve*.

### Superficies de control del GM

La ventana **Estado de nave** del módulo agrupa las órdenes cerradas que el GM
puede dar desde Foundry. Todas son **solo-GM**, viven en las dos rutas aisladas
del módulo (ApplicationV2 y la clásica de v11) y revalidan rol y revocación tras
cada llamada de red. La tripulación no usa estas superficies: emite las órdenes
de su puesto por un relé aparte (ver «Permisos por puesto» abajo).

- **Tempo** — pausa/reanudación de extremo a extremo (integrado; #34/#125). La
  aceleración temporal queda fuera por falta de API del juego.
- **Reposición** — recolocar la nave junto a un ancla de un catálogo cerrado que
  el puente publica en `/v1/anchors`; el escenario es dueño de la coordenada
  exacta. Una orden aceptada vuelve como evento `ship_repositioned` y se anota
  una sola vez en Journal con ancla y tiempo de escenario (#176/#202/#223).
- **Ingeniería** — repartir energía (`set_system_power`) por sistema y leer
  `health`/`heat`/`power`/`coolant` y `repair_crew` de `/v1/state`. No sustituye
  la reparación de la tripulación en EmptyEpsilon; la observa (integrado en
  PR #217, issue #216). El panel del GM solo reparte energía; el **refrigerante**
  (`set_system_coolant`, 0..10 por sistema) es una orden del **puesto de
  ingeniería** de la tripulación, no del GM (ver «Permisos por puesto»; #301).
- **Órdenes directas** — impulso, warp, rumbo (8 puntos de brújula) y escudos:
  las cuatro órdenes de nave que el puente ya autoriza, para dirigir la nave sin
  pasar por los puestos (integrado en PR #218, issue #176).
- **Encuentros** — inyectar un objeto de un catálogo cerrado de arquetipos:
  `derelict`, `patrol`, `freighter`, `sentry`. Foundry elige el arquetipo; el
  escenario decide plantilla, facción, posición y orden de IA. Nunca se aceptan
  coordenadas (#117; catálogo ampliado en PR #220, UI en PR #201).

### Permisos por puesto de tripulación

Cada tripulante emite **solo** las órdenes de su puesto, y lo hace **sin poseer
el token del puente**. El permiso se gatea en el **relé de Foundry**, no en el
token:

- **Doctrina de telemetría** (#331). La telemetría de la **nave propia** se
  difunde a toda la tripulación; lo que permanece cerrado es lo que el GM autora.
  El GM sigue siendo el único que habla con el puente —el Bearer no sale de su
  navegador y ningún cliente de jugador lee el ajuste del token ni ejecuta un
  `fetch` contra él— y reparte por socket el `statePayload` que ya sondeaba
  (`telemetria-difusion.mjs`). Se transporta por socket y **no** por ajuste de
  mundo: un `/v1/state` por sondeo persistido sería escritura continua en la base
  de datos de la campaña, y la pérdida al recargar la repara el siguiente tick.
  La razón de fondo es que «quién puede **pedir** el dato» y «quién puede
  **leerlo**» son preguntas distintas: en el EmptyEpsilon del que esto es fork,
  cada pantalla de tripulación ve casco, energía y sistemas, así que ocultarlo
  aquí era un peor producto a cambio de cero seguridad. **Los contactos son la
  excepción** y siguen siendo recurso del GM: callsign, facción y coordenadas
  exactas son lo que el sistema de sensores debe decidir cuánto revela. Se abren
  degradados (`contactos-degradados.mjs`) por el **estado de escaneo real del
  juego** (`ScanState`, campo `scan_state` de `/v1/contacts` desde #462) para el
  indicativo y la facción, y por distancia/alcance de radar para la posición
  (rumbo y distancia relativos, nunca coordenadas absolutas).
- **Identidad de usuario no falsificable** (#237). El tripulante escribe la orden
  en su propio flag de usuario (`emitWorkspaceOrder`); el GM la recoge en el hook
  `updateUser`. El puesto **nunca** se declara en la orden: el GM lo resuelve
  desde el `User` autenticado que emitió el cambio e ignora cualquier
  `userId`/`station` embebido. Esto impide suplantar a otro usuario, pero no
  convierte el puesto en un rol fijo: cada jugador puede cambiar el flag
  `station` de su propio `User`. Foundry persiste ese flag, pero su valor es un
  contexto operativo mutable, no identidad ni credencial. La garantía actual es
  «acción permitida para el puesto que declara ahora el usuario autenticado»;
  un puesto impuesto por el GM requeriría restringir aparte esa autoasignación.
  Esta descripción documenta el comportamiento vigente, no decide si una versión
  futura conservará la autoasignación o exigirá aprobación del GM.
- **Requisitos de característica por puesto** (`requisitos-puesto.mjs`, ajuste de
  mundo `requisitosPuesto`, **apagado de serie**). Una mesa puede exigir una
  puntuación mínima en alguna de las características del puesto —ingeniería pide
  Inteligencia o Sabiduría, armas Destreza o Fuerza— y basta cumplir **una**: un
  puesto no tiene una sola forma de llevarse, y exigir una característica concreta
  obligaría a construir la ficha contra la idea del personaje. El GM está exento,
  o una mesa mal configurada se quedaría atascada sin salida; quien no tiene
  personaje asignado queda bloqueado a propósito, porque dejarle pasar convertiría
  el ajuste en una mentira. Levantarse del puesto siempre se puede, y el puesto
  que ya se ocupa no se cierra aunque cambien los requisitos con alguien sentado.
  **Es una puerta de interfaz**, del mismo orden que la privacidad de las manos
  del póker: el flag lo escribe el propio usuario, así que alguien con la consola
  del navegador abierta puede saltársela. Sirve para que una mesa se organice, no
  para defenderse de quien quiere hacer trampas.
- **Autodestrucción y frecuencia de escudos (#518)** — las dos decisiones de la
  pantalla nativa de Ingeniería que faltaban. La autodestrucción es cooperativa
  porque el motor la hizo así: tres códigos, tres posiciones distintas. En
  Foundry armar y desarmar son de `engineering`, y confirmar un código lo pueden
  `captain`, `engineering` y `weapons` — es la única acción que tiene el capitán,
  y lo es porque confirmar no es operar la nave sino asumir la decisión. **Los
  códigos no viajan por aquí**: el componente no los expone a Lua, así que se
  leen en la pantalla nativa o los dicta el director. Recalibrar los escudos deja
  la nave sin ellos mientras dura, y la consola lo dice.
- **Puesto `relay` (#517)** — séptimo puesto de `STATIONS`, con las siete
  órdenes que la pantalla nativa de Relay ya tenía: puntos de ruta, sondas,
  enlace sonda→ciencia y condición de alerta. Dos cosas que no son obvias:
  los puntos de ruta y las sondas se señalan por **marcación y distancia** (la
  consola de un puesto no publica coordenadas del mundo, y el relé del GM las
  convierte con `resolver-posicion-relay.mjs`); y la **condición de alerta no
  es** el aviso por daños de la escena (#338) — aquella es un diagnóstico
  derivado del casco y la energía, esta una declaración de la tripulación, y
  conviven sin sincronizarse porque derivar una de la otra borraría la decisión.
  El hackeo queda fuera: el motor no lo expone a Lua (#521).
- **Base de datos científica y vista de sonda (#520)** — las dos cosas que la
  pantalla nativa de Science daba y Foundry no. Ninguna es una orden y por eso
  **ninguna entra en `STATION_ACTIONS`**: autorizar una lectura que no cambia
  nada sería inventar una puerta donde no hace falta. La base de datos llega por
  `GET /v1/database`, se pide **una vez** por consola (no en el bucle de sondeo)
  y el GM la publica en su propio ajuste de mundo para que sensores la vea sin
  token. La vista de sonda reusa la MISMA degradación de contactos con otro
  centro —el de la sonda— y los alcances de la nave, igual que la pantalla
  nativa; sin enlace no se difunde, porque una lista vacía diría «he mirado
  desde la sonda» sin haber sonda.
- **Puesto `damagecontrol` (#522)** — mover equipos de reparación por el interior
  de la nave, la decisión clásica del puesto. **No hizo falta C++ nuevo**: aunque
  `commandCrewSetTargetPosition` no está expuesto a Lua, el componente
  `internal_crew` expone `target_position` con setter, y el Lua del servidor
  escribe el destino directamente. El equipo se identifica por su casilla y no
  por un índice (el orden de las entidades no está garantizado), y el plano que
  se pinta es la **planta real del motor** publicada en `/v1/state`, no la planta
  declarativa de la sección de la nave (#427), que existe para andar por ella.
- **Matriz de autoridad cerrada** (`station-actions.mjs`, `STATION_ACTIONS`).
  Declara qué órdenes del whitelist del puente puede emitir cada puesto:
  `navigation` → `set_target_heading`, `set_impulse`, `set_warp`,
  `combat_maneuver_boost`, `combat_maneuver_strafe`, `dock`, `undock`,
  `abort_dock` (#519 — maniobra de combate y atraque, agencia nativa del timón
  que Foundry no exponía; la carga de maniobra se lee de
  `combat_maneuver.charge` en `/v1/state` y sin lectura se dice "sin lectura",
  nunca cero, y `undock`/`abort_dock` son órdenes distintas del motor y no dos
  nombres de lo mismo); `engineering`
  → `set_system_power`, `set_system_coolant`, `set_auto_repair` (#464 —
  decisión bajo presión: con la reparación automática desactivada, los
  sistemas dañados no se reparan solos; el casco 3D de ingeniería, #419, lo
  refleja: una región dañada cambia de color mientras la reparación
  automática está activa, feedback real del toggle y no solo un cambio de
  valor en texto, #466); `weapons` →
  `set_shields`, `set_weapon_target`, `fire_tube` (#465: `set_weapon_target`
  traduce `ship:commandSetTarget` —habilita el fuego automático de haces ya
  cargados— y `fire_tube` traduce `ship:commandFireTubeAtTarget(index,
  target)`; ninguna de las dos comprueba si el tubo existe o está cargado, el
  juego ya lo valida server-side y no tiene efecto si no procede); `sensors`
  → `scan_object` (#462: traduce a orden de puente el `ship:commandScan`
  nativo, referenciando el objetivo por indicativo);
  `communications` → `answer_comm_hail`, `close_comm`, `send_comm_reply`,
  `send_comm_message` (#463) — reactivas sobre un canal ya abierto por
  Relay/Operations, sin picker de objetivo propio: el Comms nativo tampoco lo
  tiene (`docs/SESION-PANTALLAS-NATIVAS.md`).
  `captain` sigue siendo de **observación/narrativa**: no emite órdenes de
  control de nave (coherente con el género bridge-sim; ratificado en #268).
  Añadir una acción exige que el puente ya la autorice y que el puesto la
  necesite.
- **Selección de objetivo sin indicativo** (#462, generalizado a armas en
  #465). El jugador de sensores o de armas nunca conoce el indicativo real de
  un eco sin escanear —es la doctrina de sensores, no un hueco—, así que la
  consola de puesto solo puede ofrecer "actuar sobre el contacto a este rumbo
  y distancia aproximados" (`objetivosDeLectura`/`scanTargetsFor`/
  `weaponTargetsFor` en `station-workspaces.mjs`, valor codificado en JSON, no
  un indicativo). La resolución al objeto real vive en el **relé del GM**
  (`resolver-objetivo-sensores.mjs`, cableado en `station-order-wiring.mjs`
  vía `prepareOrder` — comparte el mismo resolvedor entre `scan_object`,
  `set_weapon_target` y `fire_tube`, ver `ACCIONES_CON_OBJETIVO_POR_LECTURA`):
  busca, entre el `/v1/contacts` sin degradar que solo el
  GM puede leer, el candidato cuya posición real cae dentro del margen que la
  propia lectura degradada ya declaró. Sin candidato dentro de ese margen —el
  eco pudo salir de alcance entre que se listó y se pulsó escanear— la orden
  se rechaza con un aviso propio, no con un objetivo inventado.
- **Degradación explícita.** Un puesto desconocido o una acción no permitida se
  rechazan con un error tipado (`UNKNOWN_STATION` / `ACTION_NOT_ALLOWED`), nunca
  en silencio; la UI oculta de antemano los controles que el puesto no puede
  emitir (`isActionAllowed`).

**El token del puente sigue siendo grano grueso por diseño.** El permiso por
puesto se aplica en el relé del cliente GM a partir del `User` cuyo cambio
autorizó Foundry; no fortalece el Bearer ante el puente. El Bearer autoriza
*todo* el whitelist a quien lo tenga (hoy, solo el GM). Un token filtrado no gana
permisos por puesto, pero sí podría emitir cualquier orden del whitelist: por eso
el token es solo-GM y su modelo de amenaza vive en
[`bridge/README.md`](../bridge/README.md). Afinar el grano en el propio puente
sería una decisión aparte, con su ADR.

## Visión de juego

Espaciokoop Lagunak es la campaña: personajes, progreso, atlas, misiones y consecuencias viven en el núcleo, igual que la vida operativa de la nave —trayectos, navegación, sistemas, recursos, averías, encuentros y coordinación de la tripulación—. Foundry proyecta esa campaña en la mesa virtual: fichas, mapas narrativos, diarios y escenas con los que el grupo la juega, más sus documentos puramente locales.

El trayecto no será una cuenta atrás pasiva. Durante el viaje, la tripulación podrá:

- fijar destino, rumbo y perfil de velocidad;
- configurar motores, energía, refrigeración y otros sistemas;
- consultar mapas, sensores, posición y tiempo estimado de llegada;
- repartir puestos, permisos, guardias y responsabilidades;
- consumir y gestionar recursos de la nave;
- detectar, diagnosticar y reparar averías;
- reaccionar ante anomalías, encuentros y eventos del director de juego;
- asumir consecuencias persistentes que el núcleo registra en la campaña y Foundry refleja en la mesa.

El director de juego podrá pausar o acelerar el tiempo, introducir eventos y decidir cuánto detalle requiere cada trayecto. Así se pueden jugar viajes importantes en tiempo real y resumir desplazamientos rutinarios sin romper la campaña.

## Flujo de una sesión

1. El director de juego inicia en Foundry un trayecto entre dos destinos.
2. El puente prepara un escenario autorizado en Espaciokoop Lagunak.
3. Los jugadores ocupan sus puestos y configuran la nave.
4. La simulación avanza en tiempo real o con el factor temporal definido por el director de juego.
5. El puente envía a Foundry eventos normalizados, nunca código Lua libre.
6. El núcleo aplica y persiste las consecuencias; Foundry actualiza diarios, recursos y estados para reflejarlas en la mesa.
7. La sesión puede interrumpirse y reanudarse sin duplicar eventos.

### El contrato de escena (#589)

Hoy se deduce leyendo la playa. Escrito, un agente lo cumple sin leerse el módulo
entero — que es exactamente la diferencia entre una escena nueva en un PR y una
escena nueva en cinco.

Un módulo de escena exporta cinco cosas, y el catálogo de `Andar`
(`nave-catalogo-andar.mjs`) no le pide ninguna más:

| Qué | Forma | Para qué |
|---|---|---|
| `planta` | lo que devuelve `crearPlanta({ ancho, profundidad, obstaculos })` | por dónde se puede andar |
| `componer` | `(x, y, z, yaw, opciones) => escena` | pintar el cuadro desde donde está quien mira |
| `entrada` | `{ x, z, yaw }` | dónde se aparece, y mirando a qué |
| `interacciones` | lo que devuelve `declararInteracciones([...])` (#582) | todo lo que se puede tocar, por un solo raíl |
| `fondo` | un color de `paleta.mjs` | qué hay detrás: mamparo dentro, cielo o vacío fuera |

La firma de `componer` es la de `crearSalaCaja` a propósito: el bucle de andar no
distingue una sala de un exterior, y esa es la razón de que un exterior no haya
necesitado tocarlo.

**Lo que una escena NO debería tener que escribir**, porque ya está en el kit:

- formas — `escena-primitivas.mjs`: `caja`, `prisma`, `esfera`, `anillo`, `losa`,
  `rampa`, `disco`, `trasladar`;
- exteriores — `escena-exteriores.mjs`: `declararSol` y todo lo que cuelga de él
  (largo y rumbo de sombra, `sombraDeCaja`, `sombraDeProp`, el disco del sol),
  más `franja` de terreno, `huellaDe` y `ciclo`;
- materiales — `props-materiales.mjs`: `veta`, `chapa`, `hormigon`, `piedra`,
  `tela`. Un material **no es una imagen, es una función del color**: toma el de
  la pieza y saca sus tonos de él, así que la veta de un tablón gris sale gris y
  la del casco rojo sale roja con el mismo generador. Una parte lo hereda del
  prop; `material: null` en la parte significa **liso** (el vidrio de una cabina
  de chapa). El grano se mide en metros (`METROS_POR_TEXTURA`), no por cara, o un
  listón tendría la veta treinta veces más gorda que un tablón.
- props — `nave-props.mjs`: `definirVocabulario` (#583), `colocarProp` y
  `mezclarVocabularios`. Los vocabularios son **por ambiente** y se mezclan: la
  nave (`nave-props.mjs`) y los tres de exterior (`props-exteriores.mjs`: costa,
  marítimo, urbano). Una escena pide los que le tocan — un puerto, el marítimo y
  el urbano; la playa, los tres — y no arrastra los que no. Una clave repetida
  **rompe al mezclar**: que el último callara al primero daría una escena
  sutilmente equivocada sin fallo en ningún sitio.

El criterio de que el kit está terminado (#589) es medible: **una escena nueva de
complejidad parecida a la playa se entrega en tres PRs o menos, y el último no
toca ningún módulo compartido**. Mientras la escena N+1 siga necesitando tocar el
motor, lo que falte va al kit y no a la escena.

## Arquitectura propuesta

```text
┌─────────────────────┐       API limitada       ┌──────────────────────┐
│ Módulo Foundry VTT  │ ◄──────────────────────► │ Puente de integración│
│ proyección en mesa  │                           │ auth, reglas, eventos│
└─────────────────────┘                           └──────────┬───────────┘
                                                           │ red privada
                                                           ▼
                                                ┌────────────────────────┐
                                                │ Espaciokoop Lagunak    │
                                                │ campaña y simulación   │
                                                │ autoritativas          │
                                                └────────────────────────┘
```

El puente será un proceso separado. De este modo, Foundry y el juego pueden evolucionar de forma independiente, el protocolo puede adaptar versiones y ninguna mesa virtual necesita acceso completo al motor de simulación.

## Autoridad de los datos

**Standalone-first** ([ADR-0008](adr/0008-standalone-first-autoridad-del-nucleo.md), que sustituye a ADR-0002): la campaña pertenece al núcleo. Foundry es una integración **opcional** que proyecta y adapta; el juego tiene que ser jugable, guardable y reanudable sin él.

| Dominio | Fuente autoritativa |
|---|---|
| Progreso de campaña, personajes, atlas, misiones y consecuencias | Espaciokoop Lagunak |
| Posición, rumbo, velocidad y sistemas de la nave | Espaciokoop Lagunak |
| Inicio de trayecto y contexto narrativo | Espaciokoop Lagunak / director de juego |
| Resultado táctico y daños simulados | Espaciokoop Lagunak |
| Presentación en la mesa virtual: fichas, diarios y escenas de Foundry | Foundry VTT (proyección, no almacén) |
| Documentos puramente locales de una mesa Foundry (notas del GM, escenas de atrezo) | Foundry VTT |
| Adaptación de eventos del núcleo a documentos de la mesa | Puente y módulo de Foundry (transporte y formato, no fuente) |

Dos matices que evitan malentenderlo:

- **Proyección no es copia autoritativa.** Que una ficha se vea en Foundry no la convierte en la fuente: si los dos discrepan, manda el núcleo, y el módulo se limita a volver a proyectar.
- **Lo local sigue siendo local.** Una mesa puede tener sus notas, atrezo y escenas propias en Foundry sin que eso los convierta en campaña canónica. La frontera es si algo hace falta para seguir jugando cuando Foundry no está.

Esta separación evita bucles de sincronización donde ambos sistemas intentan sobrescribir el mismo estado.

## Áreas funcionales previstas

### Trayectos y tiempo

- origen, destino, ruta y puntos intermedios;
- duración estimada y progreso real;
- pausa, reanudación y factores de aceleración autorizados;
- eventos programados o disparados por condiciones;
- guardado y reanudación de viajes largos.

### Mapa y navegación

- posición y orientación de la nave;
- cartas o sectores relevantes para la campaña;
- obstáculos, anomalías, contactos y zonas de peligro;
- sensores y calidad de la información según sistemas y puesto;
- rutas alternativas con coste, riesgo y duración diferentes.

### Motores y sistemas

- potencia, empuje, velocidad y maniobra;
- distribución de energía y prioridades;
- temperatura, estrés, daños y eficiencia;
- combustible, carga u otros recursos definidos por la campaña;
- mantenimiento, reparación y consecuencias de operar fuera de límites.

### Tripulación

- puestos y permisos por jugador;
- capitán, navegación, ingeniería, sensores, comunicaciones y armas;
- turnos y guardias durante trayectos prolongados;
- acciones coordinadas y alertas compartidas;
- puestos vacantes asistidos por automatización configurable, sin sustituir decisiones importantes.

### Dirección de juego

- preparar rutas y eventos sin revelar información a los jugadores;
- introducir encuentros, averías, señales o cambios ambientales;
- controlar pausa y aceleración temporal;
- decidir qué resultados alteran fichas, diarios o recursos de Foundry;
- aplicar intervención manual sin romper el estado de la simulación.

### Música de a bordo

Ambiente sonoro **sintetizado en cada navegador** a partir de una semilla de
mundo (#344, #347). No hay ficheros de audio en el repositorio ni audio viajando
por la red: cada cliente genera las mismas notas con la misma semilla, así que
toda la mesa oye lo mismo sin sincronizar nada.

- **Automático** por defecto: el registro lo deriva el nivel de alerta (#338) —
  cotidianidad frente a tensión.
- **El GM manda** cuando quiere: el botón «cambiar la música» del grupo de
  controles Lagunak cicla entre automático, los seis registros y el silencio.
  La alerta sabe si el casco está roto, pero no sabe si el momento es solemne,
  ridículo o tierno; eso lo lee el GM.
- **El audio lo habilita cada cliente**, con el botón de auriculares que ven
  todos: los navegadores exigen un gesto del usuario y ese gesto no se puede
  delegar en el GM.
- Un registro desconocido en el ajuste **falla cerrado** y vuelve al automático.

Módulos: `arte/audio/musica-procedural.mjs` (qué notas), `arte/audio/musica-mando.mjs` (quién decide),
`arte/audio/musica-reproductor.mjs` (cómo suena).

### Daño de sistema dibujado, no solo coloreado (#353)

La tabla de sistemas del panel de nave lleva un icono por sistema cuyo **daño se
dibuja**: grietas, píxeles apagados, contorno discontinuo. Las barras comunican
la severidad por color, y el color en solitario no basta (WCAG 1.4.1); el icono
añade forma. **Acompaña** al texto y a la barra, nunca los sustituye.

Son **cuatro** estados, y el cuarto es el que importa: intacto, dañado,
inutilizado y **sin lectura**. `null` significa «no hubo sondeo», no «cero»
—`barras-estado.mjs` ya lo distingue—, y un icono agrietado por falta de lectura
mentiría diciendo «destruido», que en plena sesión es peor que no dibujar nada.
Una prueba fija que ninguna entrada nula puede producir otro estado.

Alcance honesto: hoy esto es una mejora **para el GM**. La tripulación no recibe
telemetría de sistemas en el módulo (la ve en su estación de EmptyEpsilon);
abrirla es otra decisión, con su autoridad y su fuga de sensores (#331).

Módulo: `iconos-sistema.mjs` (lógica pura y SVG), consumido por las dos rutas de
ventana y por sus parcheadores de telemetría.

### La nave en sección (#427)

El corte transversal de la nave: todas las salas a la vez, en 2D, con el daño de
cada región tiñendo la sala que la ocupa. Es el **mapa**; la cantina (#423) es
**estar dentro**. Una lleva a la otra —se pulsa una sala y se abre su vista
propia—, y por eso no compiten: son las dos mitades de «moverse por la nave».

Se eligió antes que andar en primera persona por los pasillos porque es
**mucho más barata y se usa más rato**: una sección no necesita planta navegable
ni colisiones —es una rejilla de salas— y responde de un vistazo a las dos
preguntas que ninguna vista en primera persona contesta, que son quién está
dónde y qué parte de la nave está rota.

Reglas que hereda y no puede romper:

- **No es autoridad** (#237). Dónde esté tu punto en el plano no da mandos de
  nada: el puesto lo sigue resolviendo el relé. La flecha va en un solo sentido
  —del puesto asignado a la sala donde se te pinta— y nunca al revés.
- **Sin lectura no es cero** (#419/#353). Una sala sin región, o una nave sin
  puente conectado, se pintan neutras y se leen «sin lectura». Un plano que
  pinta de rojo una nave intacta es la peor mentira que puede contar un mapa.
- **El color no es el único canal.** Una sala dañada además se **raya**, y la
  lista de texto que acompaña al plano dice integridad, sistemas implicados y
  quién está en cada sala. Todo lo pulsable del plano es pulsable en esa lista.
- **Es de la mesa, no del GM**, igual que la cantina: saber qué forma tiene la
  nave en la que vives no es información privilegiada. La lectura de daño sí lo
  es, y por eso a quien no la tiene el plano le sale sin lectura, no falseado.

La planta se declara **a mano** (`scripts/seccion-nave.mjs`): derivarla de la
plantilla del simulador es más bonito y mucho más caro, y además la plantilla
habla de cascos y sistemas, no de salas. Una sección tolera ser esquemática —esa
es su virtud— así que el primer mapa se dibuja y ya se verá si #55 lo permite
generar.

Módulos: `seccion-nave.mjs` (planta y consultas, puro), `seccion-lienzo.mjs`
(pintado 2D, puro y sin color propio) y `seccion-nave-app.mjs` (las dos ventanas
hermanas V1/V2). Los tonos viven en `paleta.mjs` (`SECCION`); el color del daño
lo sigue mandando `COLOR_REGION` de #419, para que un mismo casco no tenga dos
colores según qué ventana lo mire.

### El visor del piloto (#362)

Lo que la nave tiene delante, dibujado en 3D retro PSX en la consola de
pilotaje: los contactos colocados por su marcación y su distancia, vistos desde
el morro.

Es **la última superficie de #362 y llegó la última a propósito**. Las
anteriores ambientan —el casco propio dice hacia dónde apuntas, la lámina de
reconocimiento dice qué forma tiene aquello, la cantina es un sitio— y ninguna
era la única vía para un dato. Esta **informa**, y por eso arrastra reglas que
las otras no necesitaban:

- **La distancia y la marcación siguen en texto.** El visor es refuerzo y va
  `aria-hidden`: quien lo apague o no lo vea no pierde ni un número. Es la misma
  regla que #338 y #353, escrita antes de tener el juguete delante. En concreto:
  pilotaje arma la **lista de contactos** —la misma que ciencia y artillería—
  desde la misma lectura degradada que el lienzo coloca, y la enseña bajo él.
  Sin esa lista la regla es una frase, no una propiedad: durante la revisión de
  #431 el visor fue la única vía a esos dos datos porque el modelo solo construía
  filas para `sensors` y `weapons`. La regresión que lo impide vive en
  `station-workspaces.test.mjs`.
- **En pilotaje la lista es degradada también para el GM.** No por secreto —el GM
  tiene su sondeo crudo en ciencia— sino por coherencia: la lista respalda al
  visor, el visor pinta lo degradado, y unas coordenadas exactas al lado
  describirían un cuadro distinto del que hay en pantalla.
- **La profundidad está comprimida y no es una lectura.** Un contacto a 28.000 y
  otro a 30.000 tienen que caber los dos en el cuadro y distinguirse, y a escala
  real serían el mismo píxel. La compresión (raíz cuadrada sobre el alcance
  largo) es **monótona** —lo más cercano se ve más cerca, siempre— pero no
  proporcional. Lo único que este visor promete es el **orden**.
- **El margen se dibuja.** `contactos-degradados.mjs` redondea un eco de banda
  larga a 15° y le quita indicativo y facción; el visor lo pinta como un bloque
  gris **tan ancho como esa incertidumbre**, nunca con la silueta afilada de un
  contacto identificado. Deshacer al pintar la honestidad que el origen se toma
  el trabajo de mantener no tendría ningún sentido.
- **Todo cae en un plano.** La simulación es 2D: los contactos tienen `x` e `y`
  y no tienen altura. Repartirlos en vertical quedaría mejor y sería inventar un
  dato que nadie ha medido.
- **Sin sondeo se apaga**, y además se limpia: dejar el fotograma anterior haría
  pasar por actual un sondeo viejo. Un sondeo **vacío** sí se pinta, con su
  cielo, porque «he mirado y no hay nada» es un dato y «no he mirado» no lo es.

No abre ningún dato nuevo: consume la misma lectura degradada que ya se difunde
a toda la tripulación, y lo único que hace es colocarla en un cuadro. Y no tiene
bucle de animación —se repinta cuando llega telemetría— así que
`prefers-reduced-motion` no tiene nada que frenar: interpolar entre dos sondeos
daría movimiento suave y falso justo en la superficie que menos se lo puede
permitir.

PSX y no GameCube, que es lo que el propio #362 propuso para ella: esto se ve de
reojo desde una cabina mientras se pilota. Lo que se mira fijo —la lámina de
reconocimiento— es lo que se ganó los dieciséis tonos.

Módulos: `visor-piloto.mjs` (colocación y mallas, puro) y
`visor-piloto-lienzo.mjs` (el `<canvas>` y nada más). Reutilizan `retro3d.mjs`
sin tocarlo, como ya hicieron la lámina, los dados y la cantina.

### Frontera de estilo: vivo frente a registrado

El módulo genera dos artes en el cliente y comparten disciplina —ninguna usa
degradado, las dos van sobre papel oscuro—, así que conviven sin parecer un
descuido: son una imprenta y un CRT en la misma sala. La frontera es una
pregunta, no una lista de superficies:

> **Grabado** (`TINTA`) para lo que **persiste o enmarca**. **Pixelart**
> (`PIXEL`) para lo que **se repinta con telemetría**.

Cartelas, fichas, códice y el marco cartográfico del mapa son grabado. Sprites
de nave, barras, iconos de sistema, retratos y naipes son pixel.

El eje **no** es «diegético frente a papel», que fue el primer intento: con esa
regla el marco de grabado que envuelve el lienzo de píxeles del mapa vivo sería
una infracción, cuando es justo lo correcto —el marco es la carta, el interior
es la verdad que cambia en cada sondeo—. Formulada como vivo/registrado predice
bien los casos que vienen: la cartela de una lámina impresa es grabado aunque
cuelgue de una consola, y una barra que sigue a `/v1/state` es pixel aunque viva
dentro de un diario.

#### Arte de ficha para naves narrativas (#354)

El GM puede seleccionar tokens en el lienzo y pulsar «arte de ficha» en el grupo
Lagunak: por cada Actor se genera un PNG a partir de la misma
`construirSpriteNave()` que dibuja el mapa vivo, y se escribe en su token
**prototipo**. Así el lenguaje visual del mapa llega al tablero donde juega la
mesa, sin duplicar siluetas ni estilos.

**No son tokens de contacto vivos, y la distinción es el fondo del asunto.**
Nada aquí sondea: no hay hook que regenere la ficha al cambiar la clase, ni
sincronización de posición. Un token cuya `x/y` saliera de `/v1/contacts`
convertiría un documento persistente de Foundry en espejo de un estado que no
posee —y al caer el puente el espejo se queda mintiendo, guardado en la base del
mundo— además de trasladar «qué sabe la tripulación» de una decisión del GM a la
visión de tokens. La lectura táctica es de la tripulación en sus estaciones; el
lienzo de Foundry es la superficie narrativa. Si algún día se quiere lo otro,
antes hace falta un ADR sobre qué parte de `/v1/contacts` es pública para la
mesa: es una decisión de sensores, no de arte.

Consecuencia práctica: la ficha es una decisión editorial congelada, así que un
mundo reabierto meses después sigue teniendo sentido por sí solo.

El PNG se codifica en `scripts/png-indexado.mjs`, en JavaScript puro y con
DEFLATE sin comprimir: ni `canvas.toDataURL()` (ataría la generación al DOM y
con ella la prueba) ni `zlib`/`CompressionStream` (existen cada uno en solo una
de las dos plataformas donde corre el módulo). El color indexado compensa el
tamaño, y `generarFichaNave()` **falla** si el data-URI se pasa del tope: la
imagen vive en la base del mundo y se replica a cada cliente, así que el peso es
requisito y no detalle. La escala se deriva de un lado objetivo para que todas
las fichas pesen parecido, en vez de que la silueta más grande sea la que roce
el límite.

#### Retratos de tripulación (#352)

La fila de tripulación de la consola de puesto lleva un retrato pixel por
tripulante, generado en el cliente a partir de `user.id` — determinista, así que
todos ven la misma cara sin sincronizar nada, y sin un byte nuevo por el puente.
Se siembra con el id y no con el nombre para que sobreviva a un renombrado; la
contrapartida aceptada es que reinvitar a alguien le cambia la cara.

**El retrato no es un galón.** Codifica presencia (color o gris) y sirve de
ancla visual; el marco de puesto y el tinte de alerta se aplican por CSS sobre
el contenedor, fuera de la imagen. El flag `station` es autoasignable y mutable
(#237), así que el puesto y el estado siguen escritos en texto en la misma fila,
y el `<img>` va con `alt=""` y `aria-hidden`: quien use lector de pantalla
recibe la misma información en palabras, sin que se le repita en una forma que
no es autoridad ni permiso.

Los colores viven en `paleta.mjs` y **solo** ahí: una prueba falla si un módulo
de arte declara un color propio —hexadecimal con cualquier comilla, o `rgb()` y
`hsl()`—. La guardia cubre hoy las láminas, el sprite de nave, los naipes y la
paleta de facciones del mapa vivo; `decorado-fondo.mjs` y `mapa-render.mjs`
quedan fuera a la espera de decidir si sus catálogos (tipos de planeta,
nebulosas, tonos de lienzo) son paleta compartida o dato de decorado. Sin eso la regla sería prosa, y el cuarto
módulo volvería a inventarse su propio sepia. Ese módulo también trae el cálculo
de contraste de WCAG, con los pares que portan información verificados en la
suite (#351).

## Seguridad obligatoria

La implementación heredada contiene el endpoint HTTP `/exec.lua`, que ejecuta contenido Lua recibido por la red. Estado verificado en vivo (2026-07-12, servidor headless local con `httpserver=<puerto>`):

- `POST /exec.lua` es funcional: ejecuta el cuerpo de la petición en un subentorno Lua y devuelve su `return` como texto, o `{"ERROR": "Script error: ..."}` si el chunk falla (`src/httpScriptAccess.cpp:12-27`).
- `GET /get.lua` y `GET /set.lua` no están implementados: su lógica está comentada dentro de bloques `/*TODO*/` y ambos responden el literal `TODO` (`src/httpScriptAccess.cpp:99` y `:164`).

En consecuencia, hoy **toda** interacción con el API heredado pasa por ejecución de Lua arbitrario vía `/exec.lua` — no existe un canal de solo lectura.

Por tanto:

- `/exec.lua` no se expondrá directamente a Foundry, a una LAN no confiable ni a Internet;
- el puente solo aceptará operaciones incluidas en una lista explícita;
- las credenciales vivirán fuera del repositorio y no llegarán al navegador del jugador;
- los contenedores usarán una red privada y publicarán únicamente los puertos necesarios;
- se aplicarán autenticación, validación de esquema, límites de frecuencia y tamaño, tiempos máximos e idempotencia;
- los registros no incluirán tokens ni contenido sensible de campaña;
- las acciones administrativas tendrán permisos diferenciados para el director de juego.

## Contrato mínimo inicial

Antes de programar el módulo se acordarán eventos y comandos versionados.

**Alcance v0 — una sola nave de jugador.** El contrato v0 asume una única nave
(la nave de la party), que es el modelo de una mesa de *Spelljammer*. El puente
opera sobre `getPlayerShip(-1)`; escenarios con varias `PlayerSpaceship` (flota o
PvP) quedan fuera de contrato v0. Esto es una decisión de alcance deliberada, no
una limitación a resolver.

### Lecturas

- identidad y versión de la sesión;
- estado de conexión;
- nave y escenario activos;
- posición, rumbo, velocidad y destino;
- motores, energía, casco y sistemas principales;
- progreso del trayecto;
- inicio, progreso y final de encuentros;
- resultado resumido para la campaña.

### Órdenes permitidas

- preparar un escenario incluido en una lista autorizada;
- iniciar, pausar, acelerar o detener una sesión bajo control del director de juego;
- asignar metadatos narrativos al trayecto;
- enviar una orden de nave validada y asociada a un puesto autorizado;
- confirmar que Foundry ha procesado un evento.

La API pública no incluirá ejecución arbitraria de Lua.

## Docker

Docker puede facilitar una instalación reproducible del servidor y del puente, pero no debe ocultar requisitos ni impedir el desarrollo nativo.

La primera composición prevista tendrá:

- servicio de Espaciokoop Lagunak en modo servidor o sin interfaz, si se valida que upstream lo soporta correctamente;
- servicio puente;
- red interna entre ambos;
- puerto del puente publicado solo donde sea necesario;
- volúmenes explícitos para configuración, guardados o escenarios propios;
- comprobaciones de salud y cierre ordenado;
- versiones fijadas, sin imágenes flotantes para despliegues estables.

Foundry VTT no se incluirá ni redistribuirá en este repositorio. Es software con licencia propia y se conectará como sistema externo.

## Primera prueba vertical

La primera integración debe demostrar valor sin intentar cubrir toda una campaña:

1. Arrancar una sesión reproducible de Espaciokoop Lagunak.
2. Obtener mediante el puente un estado de nave seguro.
3. Mostrar en Foundry posición, rumbo, velocidad, motores y estado general.
4. Iniciar desde el director de juego un trayecto corto autorizado.
5. Permitir a dos puestos modificar navegación y energía.
6. Introducir una avería o encuentro controlado.
7. Recibir el final del trayecto y escribir un resumen en un diario de Foundry.
8. Cortar la conexión y comprobar la reconexión sin repetir eventos.

## Decisiones pendientes

- capacidades reales del modo servidor o sin interfaz de EmptyEpsilon;
- escala temporal y reglas de aceleración;
- autenticación para red local y posibles despliegues remotos;
- persistencia, copias de seguridad y migraciones del estado de viaje.

Estas decisiones se resolverán mediante issues antes de fijar una API estable.

### Contrato de accesibilidad para superficies animadas (#694)

Toda superficie animada nueva —incluida la capa lúdica— debe cumplir estas
cuatro comprobaciones antes de considerarse accesible:

1. `prefers-reduced-motion` neutraliza la animación o muestra directamente el
   estado final informativo.
2. Existe una regresión focal sobre el selector o clase concretos de la
   superficie.
3. La regresión incluye una mutación negativa: al retirar la neutralización, el
   test falla. Una aserción que nunca puede fallar no demuestra el contrato.
4. El test genérico de la hoja se interpreta solo dentro de la garantía que
   realmente cubre; no sustituye la regresión focal.

El PR que introduzca la superficie debe declarar honestamente qué verificación
ejecutó y cuál no. Este criterio no exige repetir un smoke completo de Foundry
cuando solo cambia una regresión Node estrecha, pero sí exige demostrar la ruta
reducida concreta.

El precedente que no debe perderse es **#227 (hueco) → #300 (test) → #303
(bloqueo cerrado, no fusionado) → #307 (regresión focal recuperada y fusionada)**.
La cadena explica por qué una checklist positiva no reemplaza una prueba que
pueda detectar la regresión.

Las superficies previstas que quedan sujetas a este contrato son:

- notificaciones de crónica;
- hazañas y recompensas;
- alerta compartida;
- aviso diegético de convocatoria;
- panel de crónica.

Este documento fija el criterio, no implementa esas superficies ni modifica
`lagunak.css` o los tests existentes.

### Resuelta: pausa de Foundry y pausa del simulador (issue #125)

- **No se sincronizan automáticamente en ninguna dirección.** La pausa del
  simulador (`pauseGame()`/`unpauseGame()`) es del simulador; `game.paused`
  de Foundry es de Foundry. Cualquier sincronización automática crearía el
  bucle clásico (Foundry pausa → puente pausa → sondeo detecta pausa →
  Foundry reacciona…) y reintentos ante fallos parciales.
- **Autoridad**: el simulador es la única fuente de verdad de su propia
  pausa. El módulo la lee confirmada del puente (`paused` en `/v1/scenario`)
  y solo la cambia mediante la orden explícita del GM (`set_pause`), una
  orden en vuelo cada vez.
- **UI**: la ventana de estado muestra el estado confirmado (`en marcha`,
  `pausando`, `pausado`, `reanudando`, error, desconexión), deshabilita la
  acción imposible y, si Foundry está además en pausa, lo indica como dato
  informativo independiente. Si el GM quiere pausar «todo», ejecuta ambas
  pausas a mano: son dos actos deliberados, no un acoplamiento.

### Resuelta: motores, combustible, energía y recursos (issue #80)

- **La energía de EmptyEpsilon es el recurso consumible v0**: la batería del
  reactor (`energy`/`energy_max` en `/v1/state`) ya se drena con warp, salto y
  sistemas. No se inventa un «combustible» paralelo mientras ninguna mesa haya
  sentido su falta.
- Si una campaña exige un recurso distinto de la batería, su hogar será
  **estado del escenario Lua** (un contador que el escenario posee y publica) —
  nunca del puente (traduce, no posee estado) ni de Foundry (no manda sobre la
  verdad de la nave).
- **Las averías son la palanca narrativa del GM**: la orden de lista blanca
  `set_system_health` inflige o revierte una avería desde Foundry. La
  **reparación es de la tripulación** en su estación real de ingeniería; el GM
  la observa por `/v1/state` (`health`, `coolant` por sistema y `repair_crew`).
  No habrá botón de «reparar» en Foundry.
- **Los encuentros son la otra mitad de esa palanca** (#117): `spawn_encounter`
  pide un arquetipo de catálogo cerrado (hoy `derelict`) con un rumbo grueso
  opcional; el escenario, dueño del *cómo*, publica el callback
  `spawnEncounter` bajo el namespace `espaciokoop_lagunak` de
  `getScriptStorage()`. Si el escenario no lo publica, la orden degrada a
  `not_supported`. Foundry jamás envía coordenadas ni definiciones de objeto:
  sería doble autoridad sobre la verdad de la nave. Cuando el escenario crea
  el encuentro, publica además `encounter_started` en `/v1/events` con un ID
  estable de sesión y secuencia monotónica; la escritura deduplicada en Journal
  sigue pendiente de la rebanada de módulo de #117.
- El contrato del puente ya autoriza energía (`set_system_power`) y refrigerante
  (`set_system_coolant`) por sistema; su encaminamiento a un **puesto** concreto
  de jugador depende de la matriz de autoridad por puesto (relé de órdenes
  tripulante→GM→puente, #236 y siguientes).
