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

- #460 — verificar y documentar pantallas nativas restantes (bloquea #462–#465);
  en revisión (PR #469).
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
- #467 — playtest del vertical de agencia de Etapa B (depende de #460–#466;
  #460 sigue en revisión).

Este grafo valida el criterio de salida de agencia, pero no cierra por sí solo
toda la Etapa B. Sus otros frentes están trazados en #479: #480 (navegación
operacional — **satisfecho**, ver
[`VERIFICACION-NAVEGACION-Y-AUTOMATIZACION.md`](VERIFICACION-NAVEGACION-Y-AUTOMATIZACION.md)
y [`SESION-NAVEGACION-OPERACIONAL.md`](SESION-NAVEGACION-OPERACIONAL.md):
`set_target_heading`/`set_impulse`/`set_warp` ya son una decisión exclusiva
del puesto que cambia el resultado de un encuentro), #481 (automatización de
puestos vacíos — **verificado: no existe automatización nativa**, sistema sin
tripulación queda congelado en su último valor; pendiente de diseño propio si
se decide construirla, ver
[`VERIFICACION-NAVEGACION-Y-AUTOMATIZACION.md`](VERIFICACION-NAVEGACION-Y-AUTOMATIZACION.md)),
#482 (alarmas compartidas por dependencia entre sistemas), #483 (guardias y
relevo) y #484 (crisis que exijan coordinación entre al menos tres puestos,
depende de #462–#465). Antes de declarar la etapa completada deben quedar
todos trazados y satisfechos.

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

## Prioridad vigente

La **etapa A** es la única prioridad de producto hasta completar un playtest
público reproducible y standalone del trayecto completo. Después se decide, con
partidas jugadas y no por adelantado, si el siguiente cuello de botella está en
puestos, persistencia de nave o contenido de misión.
