# Lote C — Tripulación, roles y avería (el fallo de un puesto es material para otro)

Parte de docs/INSPIRACION_JUEGOS_LIBRES.md (issue #840).

- **Autor del análisis:** Hermes (consolidación), fuente verificada por lectura de
  wikis y del código del propio repo.
- **Fuente declarada:** documentación de diseño de Space Station 14 y Space Station
  13, y el código real de este repo (station-actions.mjs, CRISIS_MULTIPUESTO.md).
  **Leído por encima**, no jugado. Licencias verificadas contra los repositorios
  (no de memoria): SS14 = MIT (`space-wizards/space-station-14`, LICENSE.TXT);
  SS13 = AGPL-3.0 (`tgstation/tgstation`).
- **Fichero previsto en el issue:** `docs/inspiracion/lote-c-tripulacion.md`.
- **Estado:** borrador de primera pasada validado contra el código real del repo
  (ver ancla abajo).

La pregunta del lote (textual de #840): *cómo se hace que el fallo de un puesto sea
material para otro puesto en vez de derrota*. Toca #484 y la matriz de autoridad de
station-actions.mjs. El repo ya resuelve la mitad de la pregunta (la cadena de #484
existe); este lote confirma el patrón con los referentes directos y señala el
hueco: hacer que la *caída de un puesto* suspenda su autoridad y redistribuya su
carga, no solo que falle una acción concreta.

## Ancla en el código real (por qué esto no es invento)

- `foundry-module/scripts/station-actions.mjs` ya es la **matriz de autoridad por
  puesto**: contrato cerrado y congelado donde cada puesto solo puede emitir las
  órdenes que el puente autoriza (`isActionAllowed` / `resolveStationOrder`).
  «Un puesto ausente aquí no puede emitir ninguna orden operativa.» Eso es, punto
  por punto, el *job system* de SS13/SS14: tu rol decide qué puedes tocar.
- `docs/CRISIS_MULTIPUESTO.md` (#484) ya implementa la **cadena de fallo**: cada
  eslabón es precondición dura del siguiente y romper uno hace *imposible*, no
  *peor*, el resultado. Concretamente: Comunicaciones caídas → todo escaneo
  terminado se borra (Sensores estéril); Sensores ciego → Armas dispara a ciegas
  (1/3); Ingeniería baja → se sobrevive peor y más lento. **Ningún desenlace
  termina la guardia**: el fallo es *contenido*, no derrota. Es literalmente la
  regla de SS13/SS14 llevada a código.
- La cadena vive en `scripts/lagunak_crisis_scenario_utility.lua` (máquina de
  estados, parlamento, latch de identificación) y lee `/v1/state` vía
  `bridge/command_models.py`. **Cero núcleo C++** → standalone-first (ADR-0008).
  El lote C NO propone mover eso al motor; propone extender la cascada al estado
  de *autoridad* del puesto (el hueco que Lote D ya nombra: Integridad de puesto /
  Enlace).

## Space Station 14

1. **Juego y licencia:** Space Station 14 — **MIT** (verificado en
   `space-wizards/space-station-14`, `LICENSE.TXT`: «All code for the content
   repository is licensed under the MIT license»; los assets van aparte, CC-BY-SA).
2. **Mecánica:** tripulación en una nave con roles de autoridad por trabajo; las
   averías no son derrota instantánea sino que *transfieren la carga de trabajo a
   otros roles*, obligando a coordinar entre puestos con conocimiento parcial del
   sistema. El fallo de un subsistema es material para otro puesto.
3. **Problema nuestro:** es el referente directo de la premisa del lote. Confirma
   dos cosas que el repo ya tiene y que este lote cierra: (a) la matriz de
   autoridad = `station-actions.mjs`; (b) la cascada de fallos = #484. Y apunta al
   hueco: cuando un puesto cae (Integridad de puesto / Enlace del Lote D), su
   autoridad debe suspenderse y su carga redistribuirse a quien pueda asumirla
   (capitán/relay), igual que la cadena de #484 lo hace con acciones concretas.
4. **Coste:** Lua de escenario + puente (lee `/v1/state`). Cero núcleo C++ — la
   crisis ya vive en `lagunak_crisis_scenario_utility.lua`. ADR-0008,
   standalone-first.
5. **Veredicto:** `adoptar` el principio (fallo = contenido, no derrota; autoridad
   por rol + cascada). Tarjeta: `feat(crisis): al caer un puesto, suspender su
   autoridad y redistribuir su carga a otros puestos (extiende #484 y
   station-actions.mjs)`.

## Space Station 13 (tgstation)

1. **Juego y licencia:** Space Station 13 (tgstation) — **GNU AGPL-3.0** (verificado
   vía API de GitHub, repo `tgstation/tgstation`: «PST is licensed under GNU AGPL
   v3»).
2. **Mecánica:** sistema de trabajos con acciones atadas al rol (solo tu trabajo
   puede hacer X) y eventos de avería (atmosféricos, eléctricos) que se propagan
   entre sistemas y exigen que puestos distintos se hablen para resolverlos. El
   «fail» es cooperativo, no fin de partida.
3. **Problema nuestro:** el análogo del *job system* es literalmente `STATION_ACTIONS`
   en `station-actions.mjs` (contrato cerrado: un puesto ausente no emite ninguna
   orden). SS13 lleva el patrón a la mesa desde hace décadas y confirma que
   matriz de autoridad + cascada de fallos es robusto y jugable sin arte nuevo. Es
   el segundo punto de vista del mismo veredicto de SS14.
4. **Coste:** igual que SS14 (escenario Lua + puente; nada de núcleo C++).
5. **Veredicto:** `adoptar` como validación del patrón y del mapeo job-system →
   `STATION_ACTIONS`. Misma tarjeta `feat(crisis)` de SS14; SS13 aporta la
   evidencia de que el patrón escala a decenas de roles sin romper la cadena.

## Barotrauma (contraste — no libre)

1. **Juego y licencia:** Barotrauma — **propietario, no libre** (sin licencia de
   código abierto; se nombra en el issue solo como contraste).
2. **Mecánica:** submarino co-op con roles (ingeniero, timonel, artillero, médico)
   donde el fallo de uno cascada al resto y la presión/hull es un recurso que se
   agota. Diseño espejo del nuestro: roles en una nave, fallo en cascada.
3. **Problema nuestro:** el patrón ESPEJO del fork, pero es no libre → solo
   contraste cualitativo, **sin leer código** (regla del issue: «solo como
   contraste, sin leer código»). No aporta mecánica adoptable que SS13/SS14 no den
   ya como código abierto.
4. **Coste:** no aplica (no se adopta).
5. **Veredicto:** `descartado` — no libre; se usa únicamente para confirmar que el
   patrón «fallo de rol → cascada» es robusto y jugable sin arte nuevo.

## Descarte razonado (lo que NO entra)

- **Barotrauma como fuente** — no libre; vértalo arriba. `descartado`.
- **Simulación de presión / hull / atmósferas** (física de sistemas de SS13/Barotrauma)
  — exigiría simular flujos y ticks en núcleo C++, fuera de standalone-first
  (ADR-0008) y sin un issue nuestro abierto que lo pida. `descartado` por
  coste/alcance.
- **Rondas con revancha / modo antagonista** (rounds y traitor de SS13) — el fork es
  guardias continuas, no rondas que reinician; no entra. `descartado` por desajuste
  de alcance.
- **Observador/espectro al morir** (SS13) — no aplica a nuestro modelo de puestos
  persistentes con relevo (#752). `descartado`.
- **Traer el catálogo completo de trabajos de SS13** (decenas de roles) — el fork ya
  tiene su matriz cerrada en `STATION_ACTIONS`; importar la lista sería el fallo de
  «treinta estados» pero de puestos. `descartado` por solapamiento y sobre-dimensión.

## Síntesis del lote

Dos `adoptar` (SS14 como referente directo, SS13 como validación de mesa del
patrón) + un `descartado` por no-libre (Barotrauma, usado solo como contraste) +
cuatro descartes de mecánicas específicas que no caben en standalone-first. El lote
C adopta el **principio** — fallo = contenido, no derrota; autoridad por rol +
cascada — no una lista de trabajos. El repo ya lo tiene en #484 y en
`station-actions.mjs`; SS13/SS14 lo confirman y señalan el hueco que cierra con el
Lote D: cuando un puesto cae (Integridad de puesto / Enlace), su autoridad se
suspende y su carga se redistribuye. Todo Lua de escenario + puente, cero núcleo
C++, frontera #526 respetada (se describe el fallo observable, no se afirma una
causa interna).

> **Pendiente:** el índice final docs/INSPIRACION_JUEGOS_LIBRES.md (citado aquí en
> prosa a propósito, porque aún no existe) lo escribe quien cierre el último lote.
