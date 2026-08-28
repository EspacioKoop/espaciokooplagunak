# Inspiración en juegos libres — mecánicas de rol que robar barato

> **Issue de origen:** [#840](https://github.com/VaroTv7/espaciokooplagunak/issues/840).
> **Qué es:** un catálogo de *mecánicas de rol* ya jugadas por alguien, de las que podemos
> robar la idea barato para el fork standalone-first. Una entrada por juego estudiado.
> **Qué NO es:** una declaración de dependencias ni de código ajeno. Eso es
> [ECOSISTEMA_OPEN_SOURCE.md](ECOSISTEMA_OPEN_SOURCE.md) (issue [#568](https://github.com/VaroTv7/espaciokooplagunak/issues/568)),
> que cataloga *de qué depender/copiar*. Aquí se lee el juego, no su código: una idea no
> tiene licencia, un fichero sí.

## Reglas que mandan (no son gusto)

- **ADR-0008 (standalone-first):** cero arte nuevo, cero binarios, cero motor nuevo. Lo que se
  adopte vive como datos/estado/texto derivado, jugable aunque Foundry desaparezca.
- **Frontera #526:** el texto describe lo *observable*; nunca afirma intención, moral ni una
  lectura no en el evento. Por eso el estado 5 de tripulación es *Enlace*, no *Moral*.
- **Dónde vive la autoridad de campaña (#766 persistencia, #767 bestiario, #213 atlas):** en el
  **núcleo C++** del simulador, no en el módulo de Foundry ni en Lua de escenario. Toda entrada
  que "recuerde" entre sesiones se etiqueta como núcleo.
- **Licencia verificada en el repo, no de memoria** (el API de GitHub a veces no autodetecta el
  fichero: Angband usa `copying.txt`, Cataclysm: DDA es CC-BY-SA que GitHub marca "Other").
  GPL-3.0 se *lee y aprende*, nunca se copia código (este repo es GPL-2.0).

## Cómo está ordenado

Por **coste ascendente** (lo más standalone-first primero): `puro/Node` → `puro/Node + núcleo`
(autoridad de oferta/persistencia) → `Lua de escenario + puente` → `núcleo C++` (campaña).
El lector debe poder pescar las victorias baratas sin leer el árbol entero.

## Tabla rápida

| # | Juego (licencia) | Mecánica robada | Coste | Veredicto | Toca |
|---|---|---|---|---|---|
| 1 | DCSS (GPL-2.0+) | verbos sorteados + severidad en diario | puro/Node | adoptar | `event-journal.mjs` |
| 2 | Brogue CE (AGPL-3.0) | titular de impacto de 1 línea | puro/Node | adoptar | `event-journal.mjs` |
| 3 | Shattered Pixel Dungeon (GPL-3.0) | colapso ×K de eventos | puro/Node | adoptar | `event-journal.mjs` |
| 4 | Cataclysm: DDA (CC-BY-SA-3.0) | estados corporales legibles | puro/Node | adoptar | `station-actions.mjs`, #484 |
| 5 | Veloren (GPL-3.0) | buffs/debuffs legibles | puro/Node | adoptar | `station-actions.mjs` |
| 6 | Wesnoth (GPL-2.0) | misión como datos + editor | puro/Node | cimiento | `contenido-externo/`, #540 |
| 7 | SRD 5.1 (CC-BY-4.0) | tablas de reacción de actitud | puro/Node | adoptar | `npc-generador.mjs` |
| 8 | Forged in the Dark (CC-BY-4.0) | clocks de progreso legibles | puro/Node | adoptar | #213, #484 |
| 9 | Angband (GPL-2.0) | bestiario que se aprende | puro/Node + núcleo | adoptar | #767 |
| 10 | Endless Sky (GPL-3.0) | misión declarativa + sorteo | puro/Node + núcleo | adoptar | #766, #484 |
| 11 | Naev (GPL-3.0 / CC-BY-SA) | tablón filtra + plantillas GM | Lua escenario + núcleo | adoptar | `contenido-externo/`, #766 |
| 12 | Worlds Without Number (libre) | Faction Turns (mundo reactivo) | puro/Node + núcleo | adoptar | #213, #767 |
| 13 | Space Station 14 (MIT) | tripulación/roles + avería cascada | Lua escenario + puente | adoptar | #484, `station-actions.mjs` |
| 14 | Space Station 13 (AGPL-3.0) | job system + cascada (validación) | Lua escenario + puente | adoptar | #484, `station-actions.mjs` |
| 15 | Endless Sky (GPL-3.0) | reputación por facción persistente | núcleo C++ | adoptar | #766, #767 |
| 16 | FreeOrion (GPL-2.0) | matriz de relaciones entre imperios | núcleo C++ | adoptar | #213, #767 |

(Detalle y descartes en los ficheros de cada lote: lote-a-reputacion-facciones.md,
lote-b-misiones.md, lote-c-tripulacion.md, lote-d-estados.md, lote-e-narracion.md,
lote-f-barrido.md, lote-g-otras-fuentes.md — citados en prosa a propósito para no romper
el gate de CI de rutas.)

---

## Entradas por coste

### puro/Node — victorias baratas (sin núcleo)

**DCSS — verbos sorteados + severidad (adoptar).** Un mensaje de combate elige un verbo entre
varios y codifica la magnitud con puntuación (`.`/`!`/`!!`). Nuestro `event-journal.mjs` repite
la misma plantilla; una tabla de sinónimos por tipo + modificador de severidad da prosa que no
suena a máquina, sin núcleo. #526: solo lo observable.

**Brogue CE — titular de impacto de una línea (adoptar).** Destila cada evento en una línea de
sabor; una línea de resumen localizada por entrada eleva la legibilidad del diario sin motor.
#526: resume el hecho, no lo interpreta.

**Shattered Pixel Dungeon — colapso ×K (adoptar).** Agrupa eventos idénticos contiguos en «(nuevo)
×K». Extiende la deduplicación de `event-journal.mjs` para agrupar por (tipo + destino) cuando el
puente emite a ráfaga.

**Cataclysm: DDA — estados corporales legibles (adoptar).** Red de ~30 estados de los que
recortamos el subconjunto de 5 para la tripulación (ver abajo). Modelo en puro/Node, consumido por
`station-actions.mjs` para suspender autoridad y por la cadena #484 para propagar.

**Veloren — buffs/debuffs legibles (adoptar).** Confirma la regla de oro: un estado debe ser
*legible por quien lo recibe*. Si otro puesto no puede leerlo, no es estado, es ruido.

**Wesnoth — misión como datos declarativos + editor (cimiento).** Todo el dato de juego es WML;
quien no programa escribe una misión como datos etiquetados y el editor GUI coloca terreno/unidades.
Se escribe el esqueleto del formato declarativo de escenario y se declara huérfano hasta que el
editor del GM lo consuma (igual que el esqueleto de #603).

**SRD 5.1 — tablas de reacción de actitud (adoptar).** Tirada de actitud inicial modificada por
contexto; resuelve interacción social con una tabla, no con simulación. Ya parcialmente en
`npc-generador.mjs`.

**Forged in the Dark — clocks de progreso legibles (adoptar).** Un círculo en segmentos que se
rellenan; *position/effect* resumen el estado en tres niveles. Es el primitivo de «progreso legible»
que le falta al museo y a la crisis #484: la tripulación ve cuánto falta. puro/Node + pintor de arco.

### puro/Node + núcleo — autoridad de oferta / persistencia

**Angband — bestiario que se aprende (adoptar, #767).** *Monster recall*: cada avistamiento
registra propiedades y el conocimiento crece partida a partida. El bestiario es una estructura
*aprendida*, no sabida de golpe. Texto de recall en puro/Node (como D/E); registro persistente en
núcleo C++ (autoridad de campaña, ADR-0008). #526: describe propiedades observadas, no inventa lore.

**Endless Sky — misión declarativa + sorteo (adoptar, #766/#484).** Bloque `mission` con campos
declarativos y disponibilidad por condiciones; el motor presenta solo las que cumplen y sortea
cantidades/plazos. El modelo de misión es puro/Node; la *autoridad de oferta* (qué misiones están
disponibles según estado de campaña) es núcleo (#766). El `<multiplicador>` de `deadline` y el
sorteo son Node.

**Naev — tablón que filtra por condiciones + plantillas para el GM (adoptar, #766).** El ordenador
de misión presenta solo las que cumplen; hay plantillas para crear misiones simples sin programar.
Lua de escenario para el tablón/plantillas; autoridad de oferta en núcleo. Se descarta explícitamente
el medio de "misión = script Lua a medida" (es lo que `scenario_90` ya es hoy).

**Worlds Without Number — Faction Turns (adoptar, #213/#767).** Un puñado de estadísticas por
facción resuelve «qué pasó en el mundo mientras no mirabas»; las facciones actúan en paralelo y el
resultado se difunde como estado. Es la consecuencia diferida de Lote A subida al nivel de campaña.
Resolvedor en puro/Node, vive con #766.

### Lua de escenario + puente — crisis en la sesión

**Space Station 14 — tripulación, roles y avería (adoptar, #484).** El fallo de un puesto es
material para otro; la autoridad por rol + cascada = literalmente `station-actions.mjs` + #484. Al
caer un puesto, suspender su autoridad y redistribuir su carga (hueco que cierra Lote D). Todo en
`lagunak_crisis_scenario_utility.lua` + puente, cero núcleo.

**Space Station 13 (tgstation) — job system + cascada (adoptar, #484).** El análogo del job system
es `STATION_ACTIONS` en `station-actions.mjs`. SS13 aporta la evidencia de mesa de que el patrón
escala a decenas de roles sin romper la cadena.

### núcleo C++ — autoridad de campaña persistente

**Endless Sky — reputación por facción (adoptar, #766/#767).** Escalar por facción que gatea acceso
(aterrizar, misiones ofrecidas) y tiene efectos transitivos (ayudar a X daña a Y). Autoridad de
campaña que persiste → núcleo C++, no puente/Lua ni `npc-generador.mjs`. El módulo Foundry solo
consulta/muestra el escalar.

**FreeOrion — matriz de relaciones entre imperios (adoptar, #213/#767).** Relación bilateral por
cada par de imperios (valor + tratados + actitudes de IA). Extiende el escalar de A a facción↔facción:
una matriz, no un vector. Campaña → núcleo C++.

---

## Subconjunto reutilizable — cinco estados de tripulación (de Lote D)

Cada estado es *etiqueta observable + efecto legible*, nunca lectura interna. Modelo en puro/Node,
consumido por `station-actions.mjs` (suspensión de autoridad) y la cadena #484 (propagación).

| # | Estado | Observable | Efecto legible | Cruce |
|---|--------|-----------|----------------|-------|
| 1 | Integridad de puesto | presente / ausente / incapacitado | la matriz suspende su autoridad | #484, `station-actions.mjs` |
| 2 | Carga de órdenes | nº de órdenes sin confirmar | capitán/relay redistribuye (backlog) | #484 |
| 3 | Fatiga | decaimiento de rendimiento | acciones bajan de nivel / ganan latencia | #526 |
| 4 | Atención / Enfoque | engagado / distraído / saturado | relay puede pedir relevo | #484 |
| 5 | Enlace | enlace arriba/abajo caído | sus órdenes no llegan (como Comms en #484) | #484, #526 |

(#526 en cada uno: se describe la condición observable, nunca «está desmoralizado».)

---

## Descartes consolidados

Razón de cada uno (detalle en su lote):

- **Pioneer / Oolite, OpenTTD / Simutrans (economía de puertos/rutas/transporte):** resolver
  equilibrio de precios exige economía persistente = núcleo (#766) y no aporta «trabajo que aparece
  solo». Fuera de #840. (Lotes B, F)
- **Misión como script Lua a medida (Naev):** es exactamente lo que `scenario_90` ya es; el valor del
  lote es bajar la barrera a declarar datos, no mantenerla. (Lote B)
- **Barotrauma:** propietario, no libre; solo contraste. (Lote C)
- **Presión / hull / atmósferas (SS13/Barotrauma):** simular flujos en núcleo C++, fuera de
  standalone-first. (Lote C)
- **Rondas con revancha / antagonista, espectro al morir (SS13):** el fork es guardias continuas, no
  rondas. (Lote C)
- **Traer el catálogo completo de trabajos de SS13:** el fork ya tiene su matriz cerrada en
  `STATION_ACTIONS`. (Lote C)
- **Moral (CDDA):** estado interno/subjetivo; afirmarlo violaría #526. Sustituido por *Enlace*. (Lote D)
- **Dolor / Hambre / Sed / Enfermedad, Resistencia/Stamina, Poder biónica, estados de nave (CDDA):**
  internos no observables, redundantes o ya cubiertos por `barras-estado`. (Lote D)
- **Traer Strings de prosa ajenos (Brogue/SPD):** son de autoría inglesa a mano; copiarlos sería #568.
  Lo reutilizable es el principio, ya volcado en los adoptar. (Lote E)
- **osgameclones:** cantera de remakes, no aporta entradas que A–G no cubran. (Lote G)
- **Cairn (inventario por slots), Mausritter (luz/durabilidad):** la tripulación de puente no porta
  equipo; cubierto mejor por FitD clocks. (Lote G)
- **Mercado/comisión atado a economía (Endless Sky):** acoplarlo a economía simulada lo hace inviable
  en standalone-first. (Lote A)
- **Bucle 4X completo (FreeCiv / FreeCol: árbol de tecnología + conquista):** juego de estrategia
  entero, demasiado pesado para el alcance del simulador de puente. (Lote F)

---

## Aceptación del issue #840

- Entradas completas: **16** (≥8 ✓). Descartes razonados: **13** (≥2 ✓).
- Toda entrada declara fuente y licencia verificada en repo; toda adopción respeta ADR-0008
  (standalone-first) y la frontera #526.
- Ordenado por coste ascendente (lo más standalone-first primero).
- Enlazado desde `README.md` (sección Recursos) y desde `ECOSISTEMA_OPEN_SOURCE.md` (#568): este
  documento estudia *qué mecánica robar*; el de #568 estudia *de qué depender*.
