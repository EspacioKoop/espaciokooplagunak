# Asistencia entre puestos con minijuegos de habilidad

- Estado: **implementado y jugable en mesa** — motor puro, reductor de sesión, cableado
  (`foundry-module/scripts/asistencia-wiring.mjs`) e interfaz (`foundry-module/scripts/asistencia-ui.mjs`
  sobre `foundry-module/scripts/asistencia/vista.mjs`) integrados y enganchados en `main.mjs`
  (`foundry-module/scripts/asistencia/`, suite `foundry-module/tests/asistencia-*.test.mjs`).
  El ciclo completo —pedir, resolver, consumir vía el relé del titular— es jugable de extremo a
  extremo, con cuatro minijuegos de destreza (temporización, secuencia, precisión, puzzle) y
  lectura real de modificadores dnd5e — ver
  [#500](https://github.com/EspacioKoop/espaciokooplagunak/issues/500).
- Issue: [#309](https://github.com/EspacioKoop/espaciokooplagunak/issues/309)
- Fase: **4** (experiencia cooperativa). No forma parte del criterio de salida de Fase 3.
- Depende de: contrato de minijuegos [#308](https://github.com/EspacioKoop/espaciokooplagunak/issues/308)
  ([MINIJUEGOS_FOUNDRY.md](MINIJUEGOS_FOUNDRY.md)), identidad no falsificable
  [#237](https://github.com/EspacioKoop/espaciokooplagunak/issues/237), permisos por puesto
  [#268](https://github.com/EspacioKoop/espaciokooplagunak/issues/268),
  [ADR-0002](adr/0002-autoridad-de-datos-foundry-vs-simulacion.md).

Este documento fija el diseño de «ayudar a otro puesto» **antes** de escribir código. No declara
nada implementado ni cierra el issue. Se construye en Fase 4, no ahora.

## Qué es y qué no es

Un tripulante puede **echar una mano a otro puesto** jugando un **minijuego de habilidad corto**
(temporización, precisión, secuencia…) o resolviendo una **tirada de habilidad de dnd5e** desde su
hoja de personaje. No es tomar el control del puesto ajeno: es **asistir**. La ayuda es **sal, no
peaje**: opcional, de bonus, nunca un gate obligatorio a una orden que el titular ya podía dar.

**Fuera de alcance** (líneas rojas, iguales que en el issue):

- Suplantar un puesto o saltarse su permiso.
- Cualquier efecto no acotado sobre la simulación.
- Que el minijuego emita por sí mismo una orden de nave.

## El muro de diseño (ADR-0002)

Regla dura, heredada del pase de diseño del issue: **el minijuego vive en Foundry y no emite nada.**
El efecto sobre la nave sale **siempre** por una orden del *whitelist* (`STATION_ACTIONS`) **emitida
por el titular del puesto asistido, bajo su identidad autenticada** (relé identidad→GM→puente, #237).

> «Ayudar» no puede hacer nada que el puesto asistido no pudiera pedir por sí mismo. Si pudiera, es
> una acción fuera de `STATION_ACTIONS` sin autorización del puente = doble autoridad sobre la verdad
> de la nave, prohibida por ADR-0002 aunque compile.

Esto **no cambia** al introducir dnd5e: la tirada de habilidad es color y tensión del lado de Foundry;
su resultado no toca `/v1/state` ni el puente. Solo alimenta uno de los dos modos legítimos de abajo.

## Dos modos legítimos de «ayudar»

Solo existen estos dos modos; cualquier iteración que empuje efecto a un puesto sin emisión de su
titular se corta de raíz.

### Modo A — Narrativo/social puro
El minijuego (o la tirada) es tensión y color; **el GM adjudica el fruto** en la campaña. **Cero**
efecto en `/v1/state`. Es el más fiel a «sin tocar la simulación» y el único disponible para puestos
sin vía de control (capitán, comunicaciones, sensores en su faceta no accionable).

### Modo B — Propuesta consumible
Un éxito genera un **token/flag efímero en Foundry** que **el titular del puesto asistido** gasta como
**una de SUS órdenes ya autorizadas** (p. ej. sugiere un `set_system_coolant` que ingeniería ya podía
emitir). El token **nunca emite solo**; caduca; y su efecto está **acotado** al rango que esa orden ya
permite. El ayudante nunca gana derechos de emisión sobre un puesto que no ocupa.

## Integración con las habilidades de dnd5e (el foco de esta iteración)

El módulo corre sobre **Foundry + dnd5e** (objetivo de regresión: dnd5e 2.3.1). En vez de que toda la
asistencia sea destreza de ratón, se ofrece un **modo de resolución por habilidad** que consume la
**hoja de personaje** del ayudante, para integrar la ayuda con el sistema base de 5e y reforzar la
identidad de cada personaje.

### Enfoques por habilidad, elegidos por el jugador
Cada tarea de asistencia declara un pequeño conjunto de **enfoques**, y cada enfoque mapea a una
**habilidad/tirada de dnd5e** con una **CD (dificultad)**. El jugador **elige el enfoque** que mejor
casa con su hoja — eso es la agencia y la integración con 5e:

| Tarea de asistencia | Enfoques posibles (habilidad dnd5e → CD) | Puesto asistido |
|---|---|---|
| Estabilizar un sistema caliente | Reparar en caliente (*Juego de herramientas*), Recalcular márgenes (*Arcana/Naturaleza*) | Ingeniería |
| Afinar un contacto dudoso | Leer el patrón (*Investigación*), Corazonada (*Perspicacia*) | Sensores |
| Bordar una maniobra | Coordinar la cadencia (*Interpretación/Acrobacias*) | Navegación |

El repertorio de tareas y sus enfoques es **contenido de escenario/tabla**, no lógica fija: el reto
representa un **tipo de habilidad**, el puesto solo cambia el **contexto narrativo** (comentario 4 de
Odiseo). Así el aprendizaje del jugador se transfiere entre sistemas sin que todas las ayudas se
sientan idénticas.

### Hechizos y rasgos de clase como enfoques
Además de las habilidades, un enfoque puede invocar un **hechizo** o un **rasgo/aptitud de clase** de
la hoja (p. ej. un mago que usa *Reparar*/*Prestidigitación* o *Detectar magia* para ayudar a
ingeniería o sensores; un pícaro que aplica *Pericia*; un clérigo un rasgo de canalizar divinidad de
color). Esto refuerza la identidad de clase y da variedad de caminos por personaje.

Ahora bien, **no todos los enfoques se resuelven igual**, y meterlos a todos en un único
`d20 + modificador vs CD` sería inventar reglas que dnd5e no tiene: muchos hechizos no piden ninguna
prueba a quien los lanza. Por eso el contrato distingue **tres clases de enfoque**; cada tarea declara
a cuál pertenece cada uno de los suyos (ver «Tres clases de enfoque» más abajo, que fija para cada una
quién tira, cuándo se consume el recurso y cómo se produce la banda).

Dos matices de diseño, porque los hechizos y rasgos **sí consumen recursos reales** de la hoja:

- **Coste de recurso = decisión con gate del GM.** Gastar un **espacio de conjuro** o un **uso limitado**
  (recarga corta/larga) es un coste de campaña *real*, no efímero. Por eso el enfoque «hechizo/rasgo»
  es **opt-in y lo habilita el GM** por tarea; cuando está activo, el gasto se contabiliza en el actor
  como cualquier lanzamiento de dnd5e (respeta la economía de 5e, no la inventa). El motor de
  asistencia **no fabrica ni regala recursos**: solo puede *consumir* los que el jugador ya tiene, y
  únicamente si el GM abrió esa vía.
- **La línea de #308 se mantiene al revés.** #308 prohíbe que un minijuego **conceda** recursos de
  campaña o de nave. Aquí no se concede nada: el hechizo/rasgo **gasta** un recurso del personaje para
  producir, como cualquier otro enfoque, **solo una banda de resultado** → propuesta acotada. El
  resultado sigue sin poder salir de `STATION_ACTIONS` ni superar el rango ya autorizado.

Enfoques sin coste (habilidad a secas, truco/*cantrip* a voluntad) quedan siempre disponibles; los de
coste se ofrecen como **opción de más potencia** cuando el jugador quiere invertir un recurso propio.

### Tres clases de enfoque
Cada enfoque declara su **clase de resolución**. La clase determina **quién tira**, **cuándo se
consume el recurso** y **cómo se produce la banda**. Un enfoque que no encaje en ninguna de las tres
no es declarable: no hay cuarta vía improvisada.

| Clase | Quién tira | Contra qué | Cuándo se consume el recurso | Cómo produce la banda |
|---|---|---|---|---|
| **(a) Prueba de habilidad o de herramienta** | el **ayudante** | CD declarada por la tarea | no hay recurso que gastar | margen de `d20 + modificador` frente a la CD |
| **(b) Ataque de conjuro o salvación** | ataque: el **ayudante**; salvación: el **objetivo** declarado por la tarea | ataque: CA del objetivo; salvación: CD de salvación del lanzador | **al lanzar**, antes de conocer el resultado (economía 5e) | margen de la tirada relevante frente a CA/CD |
| **(c) Uso sin tirada** | nadie tira | — | **al lanzar/activar** | banda **fija** que la tarea declara para ese enfoque |

Notas que fijan el contrato y evitan reinterpretaciones:

- **(b) solo es declarable si la tarea define un objetivo concreto** con CA o que haga la salvación.
  Una tarea de asistencia sin objetivo (estabilizar un sistema, leer un contacto) **no** puede
  ofrecer enfoques de clase (b): usaría un `d20 vs CD` que 5e no pide ahí. En ese caso el hechizo
  entra por (c), o no entra.
- En **(b) por salvación, quien tira es el objetivo, no el ayudante**, y un éxito en la salvación es
  el **fallo** del enfoque. La UI lo dice con esas palabras, porque la lectura intuitiva es la
  contraria.
- En **(c) la banda es fija y la declara la tarea**; por diseño nunca es «éxito crítico»: un efecto
  garantizado no compra además el tier alto. Es la vía de *Reparar*, *Prestidigitación* o un rasgo que
  simplemente funciona.
- El **recurso se consume en (b) y (c) al comprometerse**, no al conocer el resultado. Un ataque
  fallado o una salvación superada **gastan igual** el espacio de conjuro: así funciona 5e y así debe
  contabilizarlo el adaptador. La UI advierte del gasto antes de confirmar.
- La clase (a) es la **única** que existe siempre; (b) y (c) requieren el opt-in del GM descrito
  arriba, porque tocan recursos reales de campaña.

### «Ver el rango de éxito» antes de comprometerse
Al elegir un enfoque, la UI muestra **antes de comprometerse** lo que se puede saber de *esa* clase:

- **Clase (a) y (b)**: probabilidad de cada **banda de resultado** (ver tiers abajo) calculada con la
  tirada que corresponda —`d20 + modificador` del ayudante frente a la CD o la CA, o la salvación del
  objetivo frente a la CD de salvación del lanzador—, más la CD/CA y el modificador aplicado en claro
  (no un número mágico). Si el personaje tiene **competencia/pericia**, se refleja en el modificador y
  por tanto en el rango mostrado. La probabilidad se calcula siempre sobre el **margen a favor del
  enfoque** definido abajo, no sobre la tirada en bruto. En (b) por salvación se muestra **quién
  tira** y que un éxito suyo es el fallo del enfoque.
- **Clase (c)**: no hay probabilidad que mostrar. La UI enseña la **banda fija** que se obtendrá y el
  **recurso que se gastará**; presentar un porcentaje aquí sería inventar una tirada inexistente.
- En **(b) y (c)**, siempre el **coste** (espacio de conjuro o uso limitado) y el aviso de que se
  consume al confirmar, aunque el resultado sea un fallo.

Esto convierte la decisión en táctica de personaje: «con mi Arcana +7 tengo buena banda; con
Herramientas +2, no» — sin destripar el resultado, que sigue siendo una tirada real de dnd5e.

### De grados de éxito a efecto acotado
La tirada se resuelve con el **motor de dados de dnd5e/Foundry** (no con el reductor determinista de
#308; ver «Frontera con #308»). Su resultado se **cuantiza** en bandas y cada banda mapea a un efecto
**ya acotado**:

Las bandas **no** se leen directamente sobre la tirada: se leen sobre un **margen a favor del
enfoque**, que cada clase calcula de forma distinta. Esto importa porque en una salvación quien tira
es el objetivo y su éxito es el **fracaso** del enfoque; aplicarle `≥ CD → Éxito` invertiría el
resultado y premiaría al ayudante justo cuando el objetivo resiste.

| Clase | Quién tira | Margen a favor del enfoque |
|---|---|---|
| (a) prueba de habilidad o herramienta | ayudante | `total del ayudante − CD` |
| (b) por **ataque** de conjuro | ayudante | `total del ataque − CA del objetivo` |
| (b) por **salvación** | **el objetivo** | `CD de salvación del lanzador − total de la salvación` **(mapeo invertido)** |
| (c) uso sin tirada | nadie | no aplica: banda fija declarada por la tarea |

En (b) por salvación el margen es invertido a propósito: una salvación **alta** produce margen
**negativo** y por tanto banda desfavorable al ayudante. Que el objetivo **iguale** la CD ya es
salvación superada en 5e, así que el margen 0 cae del lado del fallo del enfoque; por eso la banda
«Éxito» exige margen **> 0** en salvaciones y `≥ 0` en (a) y (b) por ataque.

| Banda | Condición sobre el margen | Salvación (equivalente explícito) | Modo A (narrativo) | Modo B (propuesta) |
|---|---|---|---|---|
| Pifia | margen ≤ −5 | el objetivo supera la CD por ≥5 | complicación narrativa | sin token (o coste) |
| Fallo | margen < 0 (en salvación, ≤ 0) | el objetivo salva | sin ventaja | sin token |
| Éxito | margen ≥ 0 (en salvación, > 0) | el objetivo falla la salvación | ventaja menor | token de propuesta, tier bajo del rango ya permitido |
| Éxito crítico | margen ≥ +5 | el objetivo falla por ≥5 | ventaja clara | token de propuesta, tier alto **dentro** del mismo rango |

La clase (c) no consulta esta tabla: entrega la banda fija que declaró.

**El 1 y el 20 naturales no son banda por sí solos.** En dnd5e (reglas de 2014) el crítico y la pifia
automáticos son cosa de **tiradas de ataque**, no de pruebas de característica ni de salvaciones: un
20 natural en una prueba de Arcana no es un éxito garantizado. Convertirlos en pifia/crítico de
asistencia sería una regla nueva vendida como 5e. Por tanto:

- **Base:** las bandas salen **solo del margen** frente a CD/CA. Un 20 natural en una prueba de la
  clase (a) alcanza el crítico si el total llega a CD+5, y si no, no.
- **Regla opcional de la casa:** la tabla puede activar «1 natural → pifia / 20 natural → crítico» en
  pruebas de habilidad, **con gate del GM** y **declarado en la UI** junto al rango de éxito, porque
  cambia las probabilidades que el jugador está leyendo. Es opt-in explícito, nunca el comportamiento
  por defecto.
- En **(b) por ataque de conjuro**, el crítico natural del ataque **sí** es regla base de 5e y se
  respeta como tal; lo que no se hace es extrapolarlo a las demás clases.

Regla invariable: **incluso el crítico se queda dentro de lo que la orden del titular ya permitía.**
El grado de éxito elige *dónde* dentro de un rango autorizado, nunca abre un rango nuevo. Si un modo
mecánico exigiera un modificador inexistente hoy en `STATION_ACTIONS`, **eso es otro issue del puente**,
no algo que #309 arrastre de tapadillo.

Dos consecuencias que el motor hace cumplir con código, no con prosa:

- **El token se gasta una sola vez.** El consumo lleva `nonce` y estado explícito de gastados; un
  segundo consumo se rechaza aunque queden 119 segundos de vigencia. La vigencia caduca la ayuda no
  usada; lo que impide reutilizarla es el gasto. Y el `nonce` es **único dentro de la sesión**: abrir
  con uno que ya identifique una reserva viva, una propuesta viva o algo gastado se rechaza
  (`nonce-repetido`), porque una colisión cancelaría la asistencia de otro puesto al resolver.
- **Solo hay propuesta donde el tier puede morder.** El tier se aplica al parámetro continuo de la
  orden, desde la lectura actual del puesto hacia lo pedido: tier bajo se queda a mitad de camino,
  tier alto llega al objetivo, y ninguno cruza el tope del puente. Una orden **booleana**
  (`set_shields`) o **circular** (`set_target_heading`) no tiene ese margen —a mitad de camino entre
  dos rumbos no hay «menos ayuda», hay otro rumbo—, así que **no produce token** en vez de prometer un
  efecto que no existiría.
- **Sin lectura del puesto no hay ayuda, y ausencia no es cero.** El tier se mide *desde* el valor
  actual de la nave, así que sin telemetría no hay trayecto que partir. Ese caso sale por
  `sin-lectura`: la orden del titular va **exactamente** como la mandó y la propuesta **no se gasta**,
  esperando a que haya lectura. La distinción es de tipo, no de valor: `null` y `undefined` se
  reconocen como ausencia **antes** de cualquier coerción numérica, porque `Number(null)` es `0` y
  tratarlo como lectura convertía «no sé a qué está el reactor» en «está a cero» —con lo que una ayuda
  *exitosa* arrastraba la orden hacia abajo, que es el efecto contrario al que se ganó—.
  Mientras el cableado no hable con el puente (`leerBase: () => null` en `asistencia-wiring.mjs`), la
  asistencia está enchufada de extremo a extremo pero todavía no mueve ningún parámetro. Es
  deliberado: preferimos ayuda inerte a ayuda que empeora.

### dnd5e es enriquecimiento, no dependencia dura
El módulo debe seguir funcionando **sin dnd5e**. Esto es un **gate adicional**, no la ruta moderna del
smoke: la ruta moderna de #29 se ejercita **con dnd5e**, en la última versión estable de Foundry, y
registra en cada pasada la versión exacta de anfitrión y sistema (ver [FOUNDRY_GUI_SMOKE.md](FOUNDRY_GUI_SMOKE.md)).
La ruta clásica es v11.302 con dnd5e 2.3.1. El caso sin-dnd5e se prueba **aparte de ambas**, para que
un mundo con otro sistema no vea la asistencia rota. Por tanto:

- **Con actor dnd5e disponible** para el usuario: se ofrece el modo de resolución por habilidad
  (enfoques, rango de éxito, tirada real).
- **Sin dnd5e / sin actor**: se degrada limpiamente al **minijuego de destreza** base (temporización/
  precisión), que produce las **mismas bandas** de resultado. Los dos caminos comparten el mapeo
  banda→efecto, así que la autoridad y el balance no dependen del sistema de juego.
- El acoplamiento con dnd5e queda **aislado** en un adaptador de sistema (leer modificador de
  habilidad, competencia, CD, CA y CD de salvación del lanzador; lanzar la tirada de cada clase;
  consumir el recurso de (b)/(c)), detrás de una interfaz estable; nada del núcleo de asistencia
  importa `dnd5e` directamente. El fallback sin dnd5e cubre **solo la clase (a)**: sin hoja no hay
  hechizos ni recursos que gastar, así que (b) y (c) simplemente no se ofrecen.

## Frontera con el contrato de minijuegos (#308)

#309 **consume** el marco de #308, no forja el suyo. Pero la asistencia por habilidad tiene una forma
distinta a una mesa de póker y conviene delimitarlo:

- **Identidad, transporte y coordinador**: se reutiliza tal cual el patrón de #308/#237 — el actor se
  obtiene del **evento autenticado de Foundry** (cambios del documento `User`), **nunca** de un
  `userId` incluido por el cliente. La emisión final del token (Modo B) pasa por el **mismo relé
  identidad→GM→puente** que cualquier orden de puesto.
- **Aleatoriedad**: el reductor de #308 es determinista con semilla del coordinador y prohíbe
  `Math.random()`. Una **tirada de dnd5e no es determinista** y usa el motor de dados del sistema. Por
  eso la asistencia por habilidad **no es una “sesión de juego” del reductor de #308**: es una
  interacción corta cuyo **resultado (la banda)** es lo único que entra en el flujo. El registro de la
  tirada vive en el chat/dados de Foundry, no en el estado público de una sesión #308.
- **Estado efímero**: como en #308, tokens y resultados de asistencia son efímeros; no conceden
  créditos, experiencia ni recursos de nave, y no persisten mazos/semillas/secretos.
- **Estética y accesibilidad**: se hereda el contrato de #308 (pixel-art Neo Geo propio, teclado,
  foco visible, `aria-live`, `prefers-reduced-motion`, i18n ES/EN). El «rango de éxito» debe ser
  legible por texto, no solo por color.

## Autorización, concurrencia y anti-tedio

Responde a las preguntas del issue y a los comentarios de revisión.

1. **Quién autoriza** — el **titular del puesto asistido**, no «cualquiera ocioso». El ayudante juega/
   tira y produce una **propuesta**; el titular la **emite** bajo su identidad. En Modo A basta la
   adjudicación del GM. `captain/sensors/comms` pueden asistir, pero su ayuda solo rinde en Modo A.
2. **Legibilidad de responsabilidad** (comentario 1 de Odiseo) — al cerrar una crisis debe seguir
   claro **quién decidió y quién apoyó**. El token de propuesta y la emisión registran *asistente* y
   *titular emisor* por separado; la ayuda **amplifica** al especialista, no diluye su identidad.
3. **Valiosa bajo sobrecarga, no de serie** (comentarios 2 y 5 de Odiseo) — la asistencia se diseña
   para **gestionar exceso de carga o situaciones excepcionales**, nunca como paso normal del flujo.
   Criterio de balance: **ayudar a otro puesto nunca debe ser la vía más eficiente de progresar frente
   a desempeñar bien el propio**. Si una acción acaba requiriendo siempre ayudante para ser óptima, el
   diseño ha fallado y se recorta.
4. **Presupuesto de asistencia concurrente** (comentario 3 de Odiseo) — se limita la **ayuda
   simultánea** a un mismo puesto (p. ej. un asistente activo por puesto y ventana de tiempo), para no
   incentivar «todos ayudan siempre al ingeniero» ni crear efectos difíciles de equilibrar.
5. **Anti-tedio** — minijuegos/tiradas **cortos** y opcionales; sin peaje. El rango de éxito visible
   evita la frustración de tirar a ciegas.

## Rebanada mínima (cuando llegue Fase 4)

Un solo camino vertical, para validar el marco sin sobreconstruir. El **motor puro** de esta rebanada
ya existe y está probado —`bandas.mjs` (banda desde margen, con la inversión de la salvación y la
regla de la casa opt-in), `enfoques.mjs` (tareas, las tres clases, degradación sin ficha),
`probabilidad.mjs` (rango de éxito), `propuesta.mjs` (token efímero, presupuesto de concurrencia,
consumo solo por el titular), `temporizacion.mjs` (el reto de destreza determinista del camino
sin dnd5e) y `sesion.mjs` (el reductor que los ordena en el tiempo: reserva el hueco al **abrir**
—para que el presupuesto se cobre antes de que nadie gaste un espacio de conjuro—, cierra con la
banda venga del camino que venga, y entrega al titular la orden ya acotada) y `relevo.mjs` (la
costura con el relé de órdenes)—; la interfaz (`asistencia-ui.mjs`) también existe y está enganchada.

### Lo que ya está enchufado

El motor dejó de ser código muerto: `asistencia/catalogo.mjs` le da **contenido**,
`asistencia-wiring.mjs` lo **enchufa a Foundry** y `asistencia-ui.mjs` (sobre
`asistencia/vista.mjs`) es la ventana donde el asistente pulsa. El camino está completo de extremo
a extremo y es jugable en mesa, con cuatro minijuegos de destreza y lectura real de modificadores
dnd5e — ver [#500](https://github.com/EspacioKoop/espaciokooplagunak/issues/500).

- **El catálogo es contenido, no lógica.** Tres tareas base —estabilizar un sistema caliente
  (ingeniería, `set_system_coolant`), bordar una maniobra (pilotaje, `set_impulse`) y afinar un
  contacto dudoso (sensores, **narrativa**, porque sensores no está en la matriz de autoridad y no
  hay orden suya que prestar)—. Una mesa construye el suyo con `crearCatalogo([...TAREAS_BASE, ...])`
  sin que el motor se entere de que hay más de uno. Se valida al importar: una tarea rota se cae en
  carga y no en mesa. Una prueba comprueba que ninguna tarea proponga una acción fuera de
  `STATION_ACTIONS` — si esa prueba falla, el catálogo está pidiendo autoridad por la puerta de atrás.
- **El transporte de ida es el mismo que el de las órdenes.** El asistente escribe en un flag de su
  propio `User`; el GM lo recoge en `updateUser`, donde el documento que cambió **es** la identidad
  autenticada (#237). La respuesta sí va por socket dirigido, y eso no lo contradice: lo que viaja de
  vuelta es la oferta que el GM calculó, y un cliente que se invente un mensaje solo consigue
  pintarse una ventana bonita, porque la sesión vive en el GM.
- **La sesión vive en memoria del GM, a propósito.** Persistirla en ajustes de mundo la convertiría
  en dato de partida —recargar dejaría vivas propuestas de una crisis terminada— y escribiría en la
  base del mundo a cada pulsación. Si el GM recarga, las ayudas en vuelo se pierden: exactamente lo
  que ya le pasa a cualquier cosa que caduque en dos minutos, y la orden del titular sigue saliendo
  igual, sin mejorar y con aviso.
- **Dónde se cobra, y el único sitio donde se cobra.** `dispatchUserUpdate` acepta un `prepareOrder`
  que por defecto no toca nada; la asistencia se engancha ahí. No es una puerta de autoridad: el
  puesto ya se resolvió por identidad, la acción sigue pasando por `resolveStationOrder` y el puente
  revalida. Lo único que puede hacer quien se enganche es mover un número dentro de lo ya autorizado.
  Hay prueba de que un `prepareOrder` que devuelva basura **no** deja al titular sin su orden: la
  ayuda es sal, no peaje, ni siquiera ante un error de programación nuestro.
- **Quién puede ayudar.** Ni el titular del puesto a sí mismo —sería un rodeo para mejorar su propia
  orden, y convertiría la ayuda en el peaje que todo titular pagaría siempre— ni el GM, que arbitra.
  Lo demás lo decide el presupuesto de concurrencia dentro del motor.
- **Dos ajustes de mundo, cerrados por defecto.** Gastar hechizos o usos de clase (coste de campaña
  real: no se abre solo) y la regla de la casa del 1/20 natural en pruebas de habilidad (que **no**
  es la regla de 5e, y por eso no está cableada).

La interfaz ya existe: la ventana (`asistencia-ui.mjs`) donde el asistente elige enfoque, ve su
rango de éxito y juega el reto de destreza que le toque — temporización, secuencia, precisión o
puzzle, según lo que declare la tarea (`minijuegoDestreza` en el catálogo).

- **Tres puestos asistibles**: ingeniería (estabilizar sistema caliente, minijuego de precisión),
  pilotaje (bordar una maniobra, minijuego de secuencia) y sensores (afinar un contacto dudoso,
  narrativa). Una mesa amplía el catálogo con `crearCatalogo([...TAREAS_BASE, ...])` sin tocar el
  motor.
- **Un modo**: propuesta consumible (Modo B) que el titular gasta como una de sus órdenes ya
  autorizadas.
- **Una sola clase de enfoque cableada a Foundry**: la (a), prueba de habilidad/herramienta, con
  modificador real leído de la ficha (`ficha-dnd5e.mjs`) cuando el enfoque declara `habilidad`. El
  motor soporta en abstracto las clases (b) y (c), pero su cableado real a dnd5e sigue pendiente.
- **Cuatro minijuegos de destreza que comparten bandas**: temporización (reflejos), secuencia
  (memoria de orden), precisión (puntería sin reloj) y puzzle (deducción sobre un patrón siempre
  visible) — los cuatro producen las MISMAS bandas que una tirada de habilidad.
- Reutiliza relé (#237), matriz de puestos (#268) y marco de #308.

### Cómo se cobra la ayuda, en concreto (`relevo.mjs`)

La costura con el relé no abre un camino nuevo hacia el puente: se **cuelga del que ya había**, que es
lo que hace exigible ADR-0002 en vez de solo declararlo.

- El asistente deja su petición (`abrir` / `resolver`) en un flag de **su propio** documento `User`,
  hermano del de órdenes: no declara identidad porque el documento ya la autentica.
- El GM primario —y solo él, o dos coordinadores gastarían el mismo hueco del presupuesto— la aplica
  a la sesión. Eso **no emite nada**: produce una propuesta.
- El titular emite su orden de siempre. Si lleva el nonce de una propuesta viva **de su puesto**, el
  parámetro sale mejorado dentro del rango que la orden ya permitía; el campo de reclamación no viaja
  al puente, porque no es un parámetro suyo.
- La ayuda es para **una acción concreta**, no para el puesto entero: si el titular emite otra, la
  propuesta no se aplica ni se gasta. `set_system_power` y `set_system_coolant` están ambas
  autorizadas para ingeniería, así que ningún otro control las separa — sin esta comprobación, una
  ayuda de refrigerante se gastaba en una orden de potencia y la salida llevaba la acción de **la
  propuesta**: la decisión que el titular había autenticado se convertía en otra distinta, con
  parámetros acotados contra el margen de una acción que no era la suya.
- Si la ayuda caducó, ya se gastó, era de otro puesto o era de otra acción, **la orden sigue adelante
  sin mejorar**, con un aviso. Bloquearla convertiría la ayuda en peaje y haría que el titular pagara
  el error de otro.

Que este módulo no importe jamás un cliente del puente es una **prueba**, no una promesa
(`asistencia-relevo.test.mjs`).

## Naturaleza del cambio

**Documentación/diseño ahora.** Al construir en Fase 4: **solo módulo Foundry** mientras se quede en
narrativo o propuesta-consumible **sin orden nueva**. Se convierte en **cambio del puente** (nueva
entrada de whitelist o parámetro acotado) **solo** si un modo mecánico exige un modificador inexistente
hoy — y eso sería un **issue aparte**. **Nunca toca `src/` heredado: cero divergencia upstream.**

## Líneas rojas (cortar de raíz)

- Cualquier versión donde «ayudar» empuje efecto a un puesto **sin emisión de su titular**.
- Cualquier resultado que **no esté ya en `STATION_ACTIONS`** o que exceda el rango que la orden ya
  permitía (ni siquiera en crítico).
- Hacer de dnd5e una **dependencia dura** que rompa el objetivo sin-dnd5e del smoke.
- **Vender como regla de 5e algo que 5e no dice**: meter hechizos sin tirada en un `d20 vs CD`,
  declarar enfoques de clase (b) en tareas sin objetivo, o dar por base el 1/20 natural en pruebas de
  característica. Toda desviación de este tipo es **regla de la casa declarada y con gate del GM**.
- Convertir la asistencia en **peaje** obligatorio o en la vía más eficiente de progresar.
