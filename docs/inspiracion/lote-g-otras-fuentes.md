# Lote G — Otras fuentes, no solo la lista de bobeff

**Issue:** #840 · **Lote:** G · **Fichero:** docs/inspiracion/lote-g-otras-fuentes.md

**Fuente declarada:** la lista de bobeff ya la barre el Lote F; este lote va a las fuentes
que el issue admite aparte — [osgameclones](https://osgameclones.com/),
[LibreGameWiki](https://libregamewiki.org/), el catálogo de [F-Droid](https://f-droid.org/)
para juegos de texto, los devlogs / post-mortems de diseño, y los SRD de TTRPG libres
(SRD 5.1 ya usado en `npc-generador.mjs`, más Worlds Without Number, Forged in the Dark,
Cairn y Mausritter). **Leído por encima** desde sitios oficiales y SRDs; no he jugado a
ninguno salvo lo que indico. Lo que digo de sus mecánicas viene de su documentación de
diseño, no de partidas propias.

**Licencias (estado de verificación honesto):**

- **SRD 5.1** — **CC-BY-4.0** ✔ (confirmado en `CLAUDE.md` y `npc-generador.mjs`).
- **Forged in the Dark SRD** — **CC-BY-4.0** (el SRD de Blades in the Dark se publicó bajo
  licencia CC; por verificar el texto exacto en bladesinthedark.com/forged-dark antes de
  reusar texto). Una idea no tiene licencia: aquí se estudia la mecánica de *clock*.
- **Worlds Without Number SRD** — documento libre / abierto (el SRD se publica como tal;
  la licencia exacta del texto por confirmar en la fuente oficial antes de reusar contenido).
  La mecánica de *Faction Turns* se estudia como diseño, no se copia texto.
- **Cairn SRD** / **Mausritter** — ambos se distribuyen como SRD libre (Cairn bajo una
  licencia de SRD abierta; Mausritter bajo CC-BY-4.0); por verificar el texto exacto.
  Entran aquí como **descartes**, así que la licencia no bloquea nada.

Regla del issue que manda: se lee el juego, no su código; una idea no tiene licencia, un
fichero sí. Ninguna entrada de este lote trae código, datos ni arte ajenos.

---

## La pregunta de este lote

> ¿Hay en estas otras fuentes mecánicas que los lotes A–F no cubran, y que toquen un
> problema nuestro ya abierto?

Cantera admitida: osgameclones, awesome-gamedev, LibreGameWiki, F-Droid (text games),
devlogs / post-mortems, y SRD de TTRPG libres. El barrido se hizo de verdad en esta
sesión (no es la primera pasada a ciegas): el resultado es **tres adoptar** (uno ya
iniciado en la primera pasada) y **tres descartes razonados**, más una fuente que aporta
como evidencia para el Lote E.

## Entradas

### 1. Worlds Without Number — Faction Turns (mundo reactivo de campaña)

1. **Juego y licencia:** Worlds Without Number (Kevin Crawford, Sine Nomine). El SRD se
   publica como documento libre/abierto; licencia exacta del texto por verificar en la
   fuente oficial. La mecánica se estudia como diseño.
2. **Mecánica:** un *Faction Turn* resuelve, con un puñado de estadísticas por facción
   (fuerza, recursos, objetivos) y una tirada, «qué pasó en el mundo mientras los
   jugadores no miraban». Las facciones actúan en paralelo hacia sus metas; el resultado
   se difunde al árbitro como estado, no como guion. Es la forma más elegante conocida de
   «mundo que reacciona solo» (citado así en varias reseñas de diseño).
3. **Problema nuestro:** #213 (atlas / mundo que recuerda) y #767 (bestiario / recordar a
   quién has conocido). Es exactamente la «consecuencia diferida» que el Lote A
   (Endless Sky) resuelve a nivel de *misión*, pero subido al nivel de *campaña*: el
   árbitro no autoría a mano cada repercusión, las facciones la generan. Toca el núcleo
   (#766 persistencia), no la escena.
4. **Coste:** puro/Node para el resolvedor de turno de facción (estado + tabla de
   probabilidad + difusión), viviendo con #766. Cero arte, cero binario.
5. **Veredicto:** `adoptar`. Tarjeta: `feat(campana): faction-turns — mundo reactivo
   resuelto por estado y tablas, no por guion`. Emparentado con A (misma consecuencia
   diferida) y con #767; la diferencia es el alcance (campaña, no misión).

### 2. Forged in the Dark SRD — Clocks (progreso y posición legibles)

1. **Juego y licencia:** Forged in the Dark (SRD de Blades in the Dark, Evil Hat).
   **CC-BY-4.0** (por verificar el texto exacto en bladesinthedark.com/forged-dark).
2. **Mecánica:** un *clock* es un círculo dividido en segmentos que se van rellenando
   conforme avanza una tarea, amenaza o progreso; *position* y *effect* resumen el estado
   de una acción en tres niveles legibles (controlled/risky/desperate, great/standard/poor).
   Todo el estado es visible y cuantificable sin narración adjunta.
3. **Problema nuestro:** #213 (seguimiento de misión / avance de la crisis) y la matriz de
   autoridad de `station-actions.mjs`. Un *clock* es el primitivo de «progreso legible»
   que le falta al museo y a la crisis multipuesto (#484): en vez de un contador opaco,
   la tripulación ve cuánto falta y qué tan precipitado está. Puro estado, dibujable con
   el pintor de lienzo existente.
4. **Coste:** puro/Node (un clock es un entero + N segmentos) y un pintor de arco; vive en
   el módulo Foundry, sin tocar C++ ni traer arte.
5. **Veredicto:** `adoptar`. Tarjeta: `feat(estado): clocks legibles — progreso/amenaza
   como segmentos de un círculo, sin texto que afirme una lectura` (regla de #526:
   lo que se pinta es estado confirmado, no una lectura inventada).

### 3. SRD 5.1 — Tablas de reacción de actitud (continuación de la primera pasada)

1. **Juego y licencia:** SRD 5.1 — **CC-BY-4.0** ✔ (ya fijado en `CLAUDE.md` y usado en
   `npc-generador.mjs`).
2. **Mecánica:** tirada de actitud inicial (Hostil / Indiferente / Amistoso) modificada
   por contexto y acciones del jugador; resuelve la interacción social con una tabla, no
   con una simulación completa.
3. **Problema nuestro:** `npc-generador.mjs`, que ya usa el SRD 5.1. Ofrece resolución
   social barata (tablas de probabilidad + modificadores + texto condicional).
4. **Coste:** puro/Node. Ya parcialmente cubierto por `npc-generador.mjs`.
5. **Veredicto:** `adoptar` (continuado de la primera pasada). Tarjeta: terminar de sacar
   la tabla de reacciones de actitud y modificadores contextuales en el generador existente.
   ADR-0008: puramente de estado/texto, jugable sin Foundry.

### 4. osgameclones — catálogo de remakes (cantera, no entrada)

1. **Fuente y licencia:** [osgameclones.com](https://osgameclones.com/) — «list of open
   source clones and remakes of popular old-school games»; cada entrada enlaza al repo
   original (licencia variada según el juego clonado).
2. **Mecánica:** no aporta una mecánica propia; es un índice de *juegos ya jugados* por la
   comunidad (remakes de SimCity, X-COM, etc.).
3. **Problema nuestro:** barrido real hecho en esta sesión — **ninguna entrada de
   osgameclones toca un issue nuestro abierto que A–F no cubran ya**. Su valor es de
   cantera («mecánicas ya jugadas»), no de fuente de entradas nuevas para este fork.
4. **Coste:** — (no se implementa).
5. **Veredicto:** `descartado` como proveedor de entradas. Queda como cantera útil para
   cuando un issue nuevo necesite «cómo lo resolvió el remake de X», pero no aporta
   entrada propia a #840.

### 5. Cairn — inventario por slots (estado legible)

1. **Fuente y licencia:** Cairn SRD (Yochai Gal) — SRD libre; licencia exacta por verificar.
2. **Mecánica:** 10 slots de inventario (mochila de 6, una mano, dos slots…); la fatiga
   resta slots. Estado del personaje como capacidad finita y visible.
3. **Problema nuestro:** patrón de «estado legible por capacidad finita» potente, pero
   **nuestra tripulación de puente no porta equipo**: no hay dónde colgar un inventario sin
   inventar carga que el juego no tiene. Relevancia baja para un simulador de puente.
4. **Coste:** puro/Node si algún día hubiera carga; hoy no aplica.
5. **Veredicto:** `descartado`. Queda como `cimiento` si algún día existe carga/suministros
   en la nave (tocaría al núcleo, no a la escena). No se fuerza aquí.

### 6. Mausritter — fuente de luz / durabilidad (descartado, misma razón)

1. **Fuente y licencia:** Mausritter — **CC-BY-4.0** (por verificar el texto exacto).
2. **Mecánica:** antorcha con X turnos de luz, objetos con durabilidad; un *countdown*
   legible del equipo.
3. **Problema nuestro:** mismo problema que Cairn — requiere inventario/equipo que el
   puente no modela. El patrón (countdown legible) ya lo resuelve mejor el *clock* de FitD
   (entrada 2) sin necesitar equipo.
4. **Coste:** — (cubierto por mejor entrada).
5. **Veredicto:** `descartado` a favor de la entrada 2 (FitD clocks), que da el mismo
   beneficio de estado-legible-countdown sin el requisito de inventario.

### 7. F-Droid / Interactive Fiction — aventura de texto sin arte (evidencia para Lote E)

1. **Fuente y licencia:** F-Droid aloja intérpretes de ficción interactiva (p.ej.
   *Fabularium*, *Text Fiction* — Z-Machine) y hay roguelikes de texto (estilo *Path of
   Adventure*) que corren sin arte ni binarios.
2. **Mecánica:** un juego entero puede ser texto puro y seguir siendo rico; la riqueza
   sale de sinónimos y tablas de texto, no de sprites.
3. **Problema nuestro:** refuerza el enfoque del **Lote E** (cómo se narra lo que pasó en
   `event-journal.mjs` / `bitacora-nave.mjs`): la narrativa sin arte es exactamente lo que
   el fork ya sabe hacer barato. No es una entrada nueva, es evidencia de que el Lote E
   apunta bien.
4. **Coste:** — (aporta a la argumentación de E, no implementa).
5. **Veredicto:** `cantera` / evidencia. Se registra aquí para que el autor del Lote E no
   tenga que volver a buscarla; no compite por una entrada propia.

## Lo que el lote G **no** resuelve

- De dónde sale el *contenido* de facción (qué quieren, con qué recursos): eso es el atlas
  (#213) y el catálogo de facciones. Sin catálogo, el *Faction Turn* no tiene con qué
  instanciarse.
- El *clock* de FitD necesita decidir qué barras del módulo se vuelven clocks (crisis,
  reparación, misión) — eso es diseño de superficie, no de este lote.
- Las licencias exactas de WN/FitD/Cairn/Mausritter quedan por confirmar en la fuente
  oficial antes de reusar texto; la mecánica (idea) ya se estudió y no necesita esa
  confirmación para el diseño.

## Resumen del lote

- **3 adoptar:** WN *Faction Turns* (#213/#767, nivel campaña), FitD *Clocks* (#213/#484,
  progreso legible), SRD 5.1 reacciones (continuación en `npc-generador.mjs`).
- **3 descartes razonados:** osgameclones (cantera, no entrada), Cairn (sin inventario en
  el puente), Mausritter (cubierto por FitD clocks).
- **1 cantera/evidencia:** F-Droid / IF como respaldo del Lote E.
- Todos los adoptar son puro/Node o estado, cero arte, y **jugables si Foundry desaparece**
  (ADR-0008): viven en el núcleo o en el módulo como estado, no dependen de la proyección
  VTT. Ninguno toca C++ ni trae binarios.

El barrido de osgameclones / LibreGameWiki / F-Droid se hizo de verdad en esta sesión; la
conclusión es que aportan como cantera y como evidencia de Lote E, pero no entradas que
A–F no cubran, salvo las dos mecánicas de TTRPG (WN, FitD) que sí son nuevas aquí.
