# Roadmap de producto — sucesor espiritual cooperativo

Versión versionada y revisable de la dirección de producto acordada en el issue
[#219](https://github.com/VaroTv7/espaciokooplagunak/issues/219). El issue sigue
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
| IA de puestos vacíos | Debe ser competente: un puesto sin jugador no puede hundir la sesión, pero tampoco decide por la tripulación |
| Divergencia de upstream | Permitida cuando aporte mejora tangible, siguiendo [UPSTREAM.md](UPSTREAM.md) y con su propio ADR |

Pendientes de acordar entre Varo y Eloy: límite inicial de expediciones
(narrativo en Foundry frente a vista táctica propia), equilibrio entre campaña
escrita y generación procedural, y reparto de la progresión entre nave,
tripulación y campaña.

## Etapas

Cada etapa tiene un **criterio de salida** técnico y una **métrica de éxito** de
experiencia. La etapa no está terminada hasta cumplir ambos: que las piezas
técnicas existan no basta.

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
(crisis que exijan coordinación entre al menos tres puestos — **en revisión**,
PR abierto: el arquetipo `ambush`, la emboscada de ecos, es el caso concreto del
criterio de salida de la etapa; qué puesto hace qué y por qué es necesario está
en [`CRISIS_MULTIPUESTO.md`](CRISIS_MULTIPUESTO.md), y su playtest con personas
sigue siendo #467). Antes de declarar la etapa completada deben
quedar todos trazados y satisfechos.

**Estado a 2026-08-08**: de los dos grafos de la etapa, #484 está en revisión y
con eso no quedaría nada más que se cierre escribiendo código. Los otros dos no
se pueden cerrar así — #467 (playtest con 3+ personas, que puede usar la crisis
de #484 como su escenario de prueba) y #512 (decisión de
producto sobre qué comportamiento adoptar para los puestos sin tripulación, que
#481 dejó trazada al verificar que hoy no hay automatización nativa alguna).

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

## El frente paralelo: espacios andables y catálogo de contenido

Hay una cadena de trabajo que no aparece en las etapas de arriba y que ha crecido
mucho: el motor de escenas del módulo de Foundry (`retro3d`), los espacios por
los que se anda dentro de la nave, el kit de escenas de #589 y el catálogo de
assets con procedencia (#571, #590, #598). Dejarla sin mencionar haría que este
documento describiera un proyecto que ya no es el que hay.

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

Medido el 2026-08-20, para que la regla de arriba no se lea como si ya se
cumpliera:

- **La mesa todavía no visita nada de esto.** La playa (#587) y la sala del museo
  (#598) no cuelgan de ninguna puerta de la nave —su lista de puertas está
  vacía—, así que las abre el GM desde la barra de escena y nadie más las pisa.
  Cada pieza que se les añada la ve una sola persona. Es la deuda que hay que
  pagar antes de meter más contenido, no después.
- **Hay 18 mallas 3D en el árbol y el museo enseña 3.** Todas con procedencia
  verificada (escaneos de vaciados del *Statens Museum for Kunst*, CC0 1.0). Lo
  que falta no es licencia ni código: es la **cartela** de cada pieza, que es
  trabajo humano y no escala con el código. Ya lo decía #590 y sigue siendo el
  cuello de botella real de este frente.
- **La textura de muro tiene puerta de CI y el horizonte no.** Los tres PNG del
  horizonte son deterministas, pero su generador no admite `--check`, así que
  nada impide que el binario del árbol se separe de su fuente.

## Prioridad vigente

La **etapa A** es la única prioridad de producto hasta completar un playtest
público reproducible y standalone del trayecto completo. Después se decide, con
partidas jugadas y no por adelantado, si el siguiente cuello de botella está en
puestos, persistencia de nave o contenido de misión.
