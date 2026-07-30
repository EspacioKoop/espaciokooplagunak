# Asistencia entre puestos con minijuegos de habilidad

- Estado: **diseño fijado; motor puro implementado y probado, sin interfaz ni cableado**
  (`foundry-module/scripts/asistencia/`, suite `foundry-module/tests/asistencia-*.test.mjs`).
  Nada de esto está integrado todavía en la interfaz del módulo ni conectado al relé: no hay
  asistencia jugable en mesa.
- Issue: [#309](https://github.com/VaroTv7/espaciokooplagunak/issues/309)
- Fase: **4** (experiencia cooperativa). No forma parte del criterio de salida de Fase 3.
- Depende de: contrato de minijuegos [#308](https://github.com/VaroTv7/espaciokooplagunak/issues/308)
  ([MINIJUEGOS_FOUNDRY.md](MINIJUEGOS_FOUNDRY.md)), identidad no falsificable
  [#237](https://github.com/VaroTv7/espaciokooplagunak/issues/237), permisos por puesto
  [#268](https://github.com/VaroTv7/espaciokooplagunak/issues/268),
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
`probabilidad.mjs` (rango de éxito) y `propuesta.mjs` (token efímero, presupuesto de concurrencia,
consumo solo por el titular)—; lo que **no** existe es interfaz, minijuego de destreza real ni
cableado con el relé, y esa parte sigue siendo Fase 4:

- **Un puesto asistible**: ingeniería (estabilizar sistema caliente).
- **Un modo**: propuesta consumible (Modo B) que el ingeniero gasta como su `set_system_coolant`.
- **Una sola clase de enfoque**: la (a), prueba de habilidad/herramienta, sin recursos que consumir.
  Las clases (b) y (c) llegan después, cuando el camino base esté validado.
- **Dos caminos de resolución que comparten bandas**: tirada de habilidad dnd5e (con «rango de éxito»)
  **y** minijuego de temporización de fallback.
- Reutiliza relé (#237), matriz de puestos (#268) y marco de #308.

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
