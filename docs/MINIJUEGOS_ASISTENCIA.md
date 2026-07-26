# Asistencia entre puestos con minijuegos de habilidad

- Estado: **diseño previo a implementación** (docs-only)
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
Un enfoque de hechizo declara su **CD, tirada (de característica o de salvación del objetivo) y coste**,
y el «rango de éxito» los muestra antes de comprometerse, incluido el recurso que se gastará.

### «Ver el rango de éxito» antes de comprometerse
Al elegir un enfoque, la UI muestra el **rango de éxito previsto** para *esa* habilidad del personaje,
calculado del modificador total de su hoja frente a la CD, **antes** de tirar:

- probabilidad de cada **banda de resultado** (ver tiers abajo) con el `d20 + modificador` del actor;
- la CD y el modificador aplicado, en claro (no un número mágico);
- si el personaje tiene **competencia/pericia** en esa habilidad, se refleja en el modificador y por
  tanto en el rango mostrado.

Esto convierte la decisión en táctica de personaje: «con mi Arcana +7 tengo buena banda; con
Herramientas +2, no» — sin destripar el resultado, que sigue siendo una tirada real de dnd5e.

### De grados de éxito a efecto acotado
La tirada se resuelve con el **motor de dados de dnd5e/Foundry** (no con el reductor determinista de
#308; ver «Frontera con #308»). Su resultado se **cuantiza** en bandas y cada banda mapea a un efecto
**ya acotado**:

| Banda | Condición (ejemplo) | Modo A (narrativo) | Modo B (propuesta) |
|---|---|---|---|
| Pifia | fallo por ≥5 / nat 1 | complicación narrativa | sin token (o coste) |
| Fallo | < CD | sin ventaja | sin token |
| Éxito | ≥ CD | ventaja menor | token de propuesta, tier bajo del rango ya permitido |
| Éxito crítico | ≥ CD+5 / nat 20 | ventaja clara | token de propuesta, tier alto **dentro** del mismo rango |

Regla invariable: **incluso el crítico se queda dentro de lo que la orden del titular ya permitía.**
El grado de éxito elige *dónde* dentro de un rango autorizado, nunca abre un rango nuevo. Si un modo
mecánico exigiera un modificador inexistente hoy en `STATION_ACTIONS`, **eso es otro issue del puente**,
no algo que #309 arrastre de tapadillo.

### dnd5e es enriquecimiento, no dependencia dura
El módulo debe seguir funcionando sin dnd5e (objetivo «moderno» del smoke, #29). Por tanto:

- **Con actor dnd5e disponible** para el usuario: se ofrece el modo de resolución por habilidad
  (enfoques, rango de éxito, tirada real).
- **Sin dnd5e / sin actor**: se degrada limpiamente al **minijuego de destreza** base (temporización/
  precisión), que produce las **mismas bandas** de resultado. Los dos caminos comparten el mapeo
  banda→efecto, así que la autoridad y el balance no dependen del sistema de juego.
- El acoplamiento con dnd5e queda **aislado** en un adaptador de sistema (leer modificador de
  habilidad, competencia, CD, lanzar la tirada), detrás de una interfaz estable; nada del núcleo de
  asistencia importa `dnd5e` directamente.

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

Un solo camino vertical, para validar el marco sin sobreconstruir:

- **Un puesto asistible**: ingeniería (estabilizar sistema caliente).
- **Un modo**: propuesta consumible (Modo B) que el ingeniero gasta como su `set_system_coolant`.
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
- Convertir la asistencia en **peaje** obligatorio o en la vía más eficiente de progresar.
