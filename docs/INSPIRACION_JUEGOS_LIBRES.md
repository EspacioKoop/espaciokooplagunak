# Inspiración en juegos libres — mecánicas de rol que robar barato

> **Issue de origen:** [#840](https://github.com/VaroTv7/espaciokooplagunak/issues/840).
> **Qué es:** un catálogo de *mecánicas de rol* ya jugadas por alguien, de las que podemos
> robar la idea barato para el fork standalone-first. Una entrada por juego estudiado.
> **Qué NO es:** una declaración de dependencias ni de código ajeno. Eso es
> [ECOSISTEMA_OPEN_SOURCE.md](ECOSISTEMA_OPEN_SOURCE.md) (issue [#568](https://github.com/VaroTv7/espaciokooplagunak/issues/568)),
> que cataloga *de qué depender/copiar*. Aquí se lee el juego, no su código: una idea no
> tiene licencia, un fichero sí.

## Reglas que mandan (no son gusto)

- **ADR-0008 (standalone-first):** cero arte nuevo, cero binarios, cero motor nuevo. El objetivo
  es que lo adoptado viva como datos/estado/texto derivado, jugable aunque Foundry desaparezca.
  Los adoptar que hoy solo existen como script del módulo (`event-journal.mjs`,
  `station-actions.mjs`, `npc-generador.mjs`, un pintor) lo incumplen hasta portar su estado
  canónico al núcleo — ver columna **Standalone** de la tabla.
- **Frontera #526:** el texto describe lo *observable*; nunca afirma intención, moral ni una
  lectura no en el evento. Por eso ningún estado de personaje es *Moral* (interno), y *Enlace*
  no es estado de personaje sino telemetría de la conexión (anexo de salud de puesto).
- **Dónde vive la autoridad de campaña (#766 persistencia, #767 bestiario, #213 atlas):** en el
  **núcleo C++** del simulador, no en el módulo de Foundry ni en Lua de escenario. Toda entrada
  que "recuerde" entre sesiones se etiqueta como núcleo.
- **Licencia verificada en el repo, no de memoria** (el API de GitHub a veces no autodetecta el
  fichero: Angband usa `copying.txt`, Cataclysm: DDA es CC-BY-SA que GitHub marca "Other").
  GPL-3.0 se *lee y aprende*, nunca se copia código (este repo es GPL-2.0).

## Cómo está ordenado

Por **coste ascendente** (lo más standalone-first primero): `puro/Node` → `puro/Node + núcleo`
(autoridad de oferta/persistencia) → `Lua de escenario + puente` → `núcleo C++` (campaña).
Pero el issue pide priorizar por **riqueza narrativa / coste**, no solo por coste: la columna
**Riqueza (1–5)** de la tabla rápida puntúa cuánto paga cada mecánica narrativamente, así el
lector pesca primero las victorias baratas que más valen (p.ej. SS14 tripulación o WN Faction
Turns: coste medio/alto pero riqueza 5). El árbol de abajo agrupa por coste y, dentro de cada
banda, lidera lo de mayor riqueza.

## Tabla rápida

Ordenada por **coste ascendente** (lo más standalone-first primero) y con una columna
**Riqueza (1–5)** para que el lector pesque las victorias que más pagan narrativamente sin
leer el árbol: la prioridad del issue es *menor coste, mayor riqueza*. Escala de riqueza:
1 = solo prosa/texto; 3 = resuelve una interacción concreta; 5 = reescribe la autoridad de
campaña o hace que el mundo reaccione sin el jugador.

La columna **Standalone** es honesta: `sí` = funciona aunque Foundry desaparezca (vive en
núcleo/escenario o es dato); `solo Foundry` = la mecánica adoptada hoy solo existe como script
del módulo de Foundry (`event-journal.mjs`, `station-actions.mjs`, `npc-generador.mjs` o un
pintor del módulo) y habría que portar su estado canónico al núcleo para ser standalone-first
de verdad.

| # | Juego (licencia) | Mecánica robada | Coste | Riqueza (1–5) | Standalone | Veredicto | Toca |
|---|---|---|---|---|---|---|---|
| 1 | DCSS (GPL-2.0+) | verbos sorteados + severidad en diario | puro/Node | 2 | solo Foundry (`event-journal.mjs`) | adoptar | `event-journal.mjs` |
| 2 | Brogue CE (AGPL-3.0) | titular de impacto de 1 línea | puro/Node | 2 | solo Foundry (`event-journal.mjs`) | adoptar | `event-journal.mjs` |
| 3 | Shattered Pixel Dungeon (GPL-3.0) | colapso ×K de eventos | puro/Node | 2 | solo Foundry (`event-journal.mjs`) | adoptar | `event-journal.mjs` |
| 4 | Cataclysm: DDA (CC-BY-SA-3.0) | estados corporales legibles | puro/Node + núcleo | 4 | solo Foundry (representación hoy en `station-actions.mjs`; estado canónico propuesto en núcleo) | adoptar | `station-actions.mjs`, #484 |
| 5 | Veloren (GPL-3.0) | buffs/debuffs legibles | puro/Node + núcleo | 3 | solo Foundry (representación hoy en `station-actions.mjs`; estado canónico propuesto en núcleo) | adoptar | `station-actions.mjs` |
| 6 | Wesnoth (GPL-2.0) | misión como datos + editor | puro/Node | 2 | sí (datos, cimiento) | cimiento | `contenido-externo/`, #540 |
| 7 | SRD 5.1 (CC-BY-4.0) | tablas de reacción de actitud | puro/Node | 3 | solo Foundry (`npc-generador.mjs`) | adoptar | `npc-generador.mjs` |
| 8 | Forged in the Dark (CC BY 3.0) | clocks de progreso legibles | puro/Node | 4 | solo Foundry (pintor de arco en el módulo) | adoptar | #213, #484 |
| 9 | Angband (GPL-2.0) | bestiario que se aprende | puro/Node + núcleo | 4 | sí (registro persistente en núcleo, #767) | adoptar | #767 |
| 10 | Endless Sky (GPL-3.0) | misión declarativa + sorteo | puro/Node + núcleo | 3 | sí (autoridad de oferta en núcleo, #766) | adoptar | #766, #484 |
| 11 | Naev (GPL-3.0 / CC-BY-SA) | tablón filtra + plantillas GM | Lua escenario + núcleo | 3 | sí (escenario + núcleo) | adoptar | `contenido-externo/`, #766 |
| 12 | Worlds Without Number (libre) | Faction Turns (mundo reactivo) | puro/Node + núcleo | 5 | sí (resuelve en núcleo, #766) | adoptar | #213, #767 |
| 13 | Space Station 14 (MIT) | tripulación/roles + avería cascada | Lua escenario + puente | 5 | sí (escenario + puente; sin VTT) | adoptar | #484, `station-actions.mjs` |
| 14 | Space Station 13 (AGPL-3.0) | job system + cascada (validación) | Lua escenario + puente | 4 | sí (escenario + puente; sin VTT) | adoptar | #484, `station-actions.mjs` |
| 15 | Endless Sky (GPL-3.0) | reputación por facción persistente | núcleo C++ | 5 | sí (núcleo C++, #766/#767) | adoptar | #766, #767 |
| 16 | FreeOrion (GPL-2.0) | matriz de relaciones entre imperios | núcleo C++ | 4 | sí (núcleo C++, #213/#767) | adoptar | #213, #767 |
| 17 | Ironsworn / Starforged (CC BY 4.0) | *Ask the Oracle*: d100 con tabla graduada + prompt oracles (hecho sin GM) | puro/Node | 3 | solo Foundry (`npc-generador.mjs`, `asistencia/`) | adoptar | #766, #767, #213, #526 |
| 18 | Kenney (CC0) | assets / game kits (placeholders sin riesgo) | — (datos de arte) | 1 | sí (CC0, sin atribución) | adoptar (fuente assets) | #618, #568 |
| 19 | Beyond the Spozak (CC0) | setting sci-fi en dominio público (nombres/facciones/sistemas) | puro/Node (datos) | 2 | sí (CC0, sin atribución) | adoptar (fuente setting) | #213, #767 |

**16 mecánicas de 15 juegos.** Endless Sky ocupa dos filas (10 y 15) porque aporta dos mecánicas
distintas a costes distintos, y por eso los dos números no coinciden: #840 cuenta *una entrada por
juego estudiado*, así que la unidad de cobertura es el **juego** y el detalle interno puede traer
más de una mecánica. Las filas se mantienen separadas para no romper el orden por coste —una es
`puro/Node + núcleo` y la otra `núcleo C++`—, pero cuentan como un solo juego:

```text
Endless Sky (GPL-3.0)
  • misión declarativa + sorteo      → fila 10, puro/Node + núcleo
  • reputación por facción           → fila 15, núcleo C++
```

Detalle y descartes en el fichero de cada lote:
[A](inspiracion/lote-a-reputacion-facciones.md), [B](inspiracion/lote-b-misiones.md),
[C](inspiracion/lote-c-tripulacion.md), [E](inspiracion/lote-e-narracion.md),
[F](inspiracion/lote-f-barrido.md), [G](inspiracion/lote-g-otras-fuentes.md) — **enlazados,
no citados en prosa**: un índice cuyos enlaces son texto plano pasa `tools/refs-rotas.py` diga lo
que diga, así que citarlos así no protegía nada, solo apagaba el gate. `lote-d-estados.md` no
aparece porque no está en `main` todavía (#847) — y esa ausencia ahora la vigila el gate.

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

> **No consolidado:** esta sección resume el Lote D, que sigue abierto en #847. Se mantiene aquí
> para no perder el trabajo, pero no cuenta para la aceptación de #840 ni se prioriza en firme
> hasta que su PR esté en `main`.

## Subconjunto reutilizable — cinco estados de **personaje** (de Lote D, #847)

Cinco estados de **personaje** (no de salud de puesto): cada uno es *etiqueta observable +
efecto legible + quién lo produce*, nunca lectura interna. El estado canónico y sus efectos
viven en el escenario Lua o el núcleo; el módulo Foundry solo los **representa** (ADR-0008).
Los dos que hoy no tienen productor nativo entran `bloqueado` y no inventan penalización.

| # | Estado (personaje) | Observable (lo que ve otro puesto) | Efecto legible | Quién lo produce hoy |
|---|--------------------|-----------------------------------|----------------|----------------------|
| 1 | **Herida** | atendida / sin atender, tras un impacto | el escenario decide qué le cierra a esa persona | el escenario (el daño ya es de la simulación) |
| 2 | **Exposición** | vacío, atmósfera, radiación en la sala | condición con caducidad y recuperación | el escenario; `bloqueado` mientras el estado de sala no se publique |
| 3 | **Aturdimiento** | tras impacto o maniobra brusca | condición corta que caduca sola | el escenario (impactos y maniobras ya existen) |
| 4 | **Fatiga** | decaimiento sostenido a lo largo de la guardia | efecto **por decidir por quien tenga la autoridad**; este lote NO propone latencia ni bajar acciones | **nadie hoy** → `bloqueado`, solo como etiqueta legible |
| 5 | **Atención / Enfoque** | atendiendo / distraído / saturado | lo lee otro puesto y decide (pedir relevo); no concede ni quita nada por sí solo | lo declara la propia persona o el GM; es lectura, no regla |

**Anexo — salud de puesto (no son estados de personaje):** Integridad de puesto (estado y
decisión en el escenario Lua, #484), Carga de órdenes (lo sabe el puente), y Enlace (telemetría
de la conexión, ya diagnosticada en `diagnostico-conexion.mjs`). Estas tres se leen bien en el
**Lote C**; aquí no compiten por las cinco plazas.

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
- **Moral (CDDA):** estado interno/subjetivo; afirmarlo violaría #526. No tiene sustituto entre
  los cinco estados de personaje (la primera pasada lo había sustituido por *Enlace*, pero
  *Enlace* es telemetría de la conexión, no estado de personaje — vive en el anexo de salud de
  puesto). `descartado` por su propio motivo. (Lote D, #847)
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

## Priorización por riqueza narrativa / coste

El criterio de salida de #840 pide **ordenar** los `adoptar`, y una columna no es un orden: la tabla
de arriba va por coste porque así se pescan las victorias baratas, y aquí manda qué historia compra
cada euro. Se lee por bloques; **dentro de un bloque no hay orden**, porque decir cuál de dos
`riqueza 4 / puro/Node` va primero sería inventar una precisión que la escala no tiene.

**Primero — riqueza alta al coste más bajo (mucha historia, casi gratis):**

1. **Clocks legibles** (FitD) — riqueza 4, `puro/Node`. El progreso deja de ser invisible para toda
   la mesa con un modelo puro y un pintor de arco. La mejor relación del documento.

**Después — riqueza alta con núcleo de campaña, que es donde el fork no tiene nada todavía:**

2. **Faction Turns** (Worlds Without Number) — riqueza 5, `puro/Node + núcleo`, standalone sí.
3. **Tripulación/roles + avería en cascada** (Space Station 14) — riqueza 5, `Lua + puente`.
4. **Reputación por facción** (Endless Sky) — riqueza 5, `núcleo C++`. La más cara de las de
   riqueza 5, y aun así prioritaria: es literalmente *recordar a quién has conocido* (#213/#767).
5. **Bestiario que se aprende** (Angband) — riqueza 4, `puro/Node + núcleo`, #767.
6. **Estados corporales legibles** (Cataclysm: DDA) — riqueza 4, `puro/Node + núcleo`.
   **Pendiente del Lote D (#847)**: no se prioriza en firme hasta que su lote esté en `main`.
7. **Job system como validación** (Space Station 13) — riqueza 4, `Lua + puente`. Su valor es la
   evidencia de mesa de que el patrón de SS14 escala, no una mecánica nueva.
8. **Matriz de relaciones** (FreeOrion) — riqueza 4, `núcleo C++`. Extiende la reputación de vector
   a matriz y **no se abre antes que ella**.

**Luego — riqueza media, mejora cómo se cuenta o se resuelve lo que ya pasa:**

9. **Tablas de reacción de actitud** (SRD 5.1) — riqueza 3, `puro/Node`.
10. **Misión declarativa + sorteo** (Endless Sky) — riqueza 3, `puro/Node + núcleo`.
11. **Tablón que filtra + plantillas** (Naev) — riqueza 3, `Lua escenario + núcleo`.
12. **Buffs/debuffs legibles** (Veloren) — riqueza 3, `puro/Node + núcleo`. **Pendiente de #847.**

**Al final — riqueza baja: legibilidad, barato y conviene, pero no cuenta historia por sí solo:**

13. **Verbos sorteados + severidad** (DCSS) — riqueza 2, `puro/Node`.
14. **Titular de impacto** (Brogue CE) — riqueza 2, `puro/Node`.
15. **Colapso ×K** (Shattered Pixel Dungeon) — riqueza 2, `puro/Node`.
16. **Misión como datos + editor** (Wesnoth) — riqueza 2, `puro/Node`, `cimiento`: se escribe y se
    declara huérfano hasta que el editor del GM lo consuma.

La escala es **ordinal y gruesa a propósito**. No se dividen riqueza y coste para sacar un número:
un cociente parecería una medida, y esto es un juicio de diseño con dos ejes declarados.

---

## Aceptación del issue #840

- Mecánicas completas: **19** (≥8 ✓), de **17 juegos/fuentes** estudiados — Endless Sky aporta
  dos; Ironsworn, Kenney (CC0) y Beyond the Spozak (CC0) añadidos en esta pasada. Descartes
  razonados: **13** (≥2 ✓). De esos números, **dos mecánicas y dos descartes son del Lote D**,
  que sigue abierto (#847): hasta que se mergee, el recuento firme es 17 mecánicas de 15
  juegos/fuentes y 11 descartes, que ya cumple los mínimos del issue por sí solo.
- Cada entrada declara fuente y licencia verificada en su lote (la verificación está en el
  fichero de cada lote, no aquí de memoria). Corrección de esta pasada: Forged in the Dark es
  **CC BY 3.0** (no 4.0, como decía la pasada anterior heredada de #845).
- Toda adopción respeta la frontera #526 y el objetivo ADR-0008 (standalone-first), pero la
  columna **Standalone** de la tabla dice la verdad: 7 de 19 adoptar viven hoy solo como script
  del módulo de Foundry (`event-journal.mjs`, `station-actions.mjs`, `npc-generador.mjs` o un
  pintor) y no son standalone-first hasta portar su estado canónico al núcleo. Las dos fuentes
  **CC0** (Kenney assets, Beyond the Spozak setting) son dominio público real y no dependen de
  Foundry ni de atribución: son standalone por definición de licencia.
- Ordenado por **coste ascendente** en la tabla y **priorizado** por riqueza narrativa / coste en
  su propia sección, que es lo que pide el criterio de salida: una columna puntúa, no prioriza.
- Revalidado contra `main` tras rebasear esta rama: los lotes **A (#849), B (#843), C (#848),
  E (#846), G (#845)** ya están mergeados en `main`; el **Lote D (#847)** está en revisión y su
  subconjunto de cinco estados (arriba) queda marcado como **no consolidado** hasta que se mergee:
  se mantiene escrito para no perder el trabajo, pero no cuenta para la aceptación ni se prioriza
  en firme. Los ficheros `lote-*.md` van **enlazados**, así que el gate de rutas los vigila de
  verdad.
- Enlazado desde `README.md` (sección Recursos) y desde `ECOSISTEMA_OPEN_SOURCE.md` (#568): este
  documento estudia *qué mecánica robar*; el de #568 estudia *de qué depender*.

> **Pendiente para cerrar #840:** mergear el Lote D (#847). Los lotes A/B/C/E/G ya están en
> `main`; este índice es el que cierra el issue y ya apunta a ellos en prosa.
