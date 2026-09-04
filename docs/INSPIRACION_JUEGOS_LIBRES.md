# Inspiración en juegos libres — mecánicas de rol que robar barato

> **Issue de origen:** [#840](https://github.com/EspacioKoop/espaciokooplagunak/issues/840).
> **Qué es:** un catálogo de *mecánicas de rol* ya jugadas por alguien, de las que podemos
> robar la idea barato para el fork standalone-first. Una entrada por juego estudiado.
> **Qué NO es:** una declaración de dependencias ni de código ajeno. Eso es
> [ECOSISTEMA_OPEN_SOURCE.md](ECOSISTEMA_OPEN_SOURCE.md) (issue [#568](https://github.com/EspacioKoop/espaciokooplagunak/issues/568)),
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

Por **coste ascendente** (lo más standalone-first primero): `puro/Node` → `puro/Node + escenario`
(estado canónico nativo, representación en el módulo) → `puro/Node + núcleo`
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
| 4 | Cataclysm: DDA (CC-BY-SA-3.0) | estados corporales legibles | puro/Node + escenario | 4 | sí (estado canónico en escenario/núcleo, #847; el módulo representa) | adoptar | #484, `station-actions.mjs` (proyección) |
| 5 | Veloren (GPL-3.0) | buffs/debuffs legibles | puro/Node + escenario | 3 | sí (estado canónico en escenario/núcleo, #847; el módulo representa) | adoptar | #484, `station-actions.mjs` (proyección) |
| 6 | Wesnoth (GPL-2.0) | misión como datos + editor | puro/Node | 2 | sí (datos, cimiento) | cimiento | `contenido-externo/`, #540 |
| 7 | SRD 5.1 (CC-BY-4.0) | tablas de reacción de actitud | puro/Node | 3 | solo Foundry (`npc-generador.mjs`) | adoptar | `npc-generador.mjs` |
| 8 | Forged in the Dark (CC BY 3.0) | clocks de progreso legibles | puro/Node | 4 | solo Foundry (pintor de arco en el módulo) | adoptar | #213, #484 |
| 9 | Angband (GPL-2.0) | bestiario que se aprende | puro/Node + núcleo | 4 | sí (registro persistente en núcleo, #767) | adoptar | #767 |
| 10 | Endless Sky (GPL-3.0) | misión declarativa + sorteo | puro/Node + núcleo | 3 | sí (autoridad de oferta en núcleo, #766) | adoptar | #766, #484 |
| 11 | Naev (GPL-3.0 / CC-BY-SA) | tablón filtra + plantillas GM | Lua escenario + núcleo | 3 | sí (escenario + núcleo) | adoptar | `contenido-externo/`, #766 |
| 12 | Worlds Without Number (CC0) | Faction Turns (mundo reactivo) | núcleo | 5 | sí (resolvedor y estado en núcleo, #845/#766) | adoptar | #213, #767 |
| 13 | Space Station 14 (MIT) | tripulación/roles + avería cascada | Lua escenario + puente | 5 | sí (escenario + puente; sin VTT) | adoptar | #484, `station-actions.mjs` |
| 14 | Space Station 13 (AGPL-3.0) | job system + cascada (validación) | Lua escenario + puente | 4 | sí (escenario + puente; sin VTT) | adoptar | #484, `station-actions.mjs` |
| 15 | Endless Sky (GPL-3.0) | reputación por facción (sin transitividad, #849) | núcleo C++ | 5 | sí (núcleo C++, #766/#767) | adoptar | #766, #767 |
| 16 | FreeOrion (GPL-2.0) | matriz de relaciones entre imperios | núcleo C++ | 4 | sí (núcleo C++, #213/#767) | adoptar | #213, #767 |

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
[C](inspiracion/lote-c-tripulacion.md), [D](inspiracion/lote-d-estados.md),
[E](inspiracion/lote-e-narracion.md), [F](inspiracion/lote-f-barrido.md),
[G](inspiracion/lote-g-otras-fuentes.md) — **enlazados, no citados en prosa**: un índice cuyos
enlaces son texto plano pasa `tools/refs-rotas.py` diga lo que diga, así que citarlos así no
protegía nada, solo apagaba el gate. Los siete están en `main`, y el gate vigila que sigan ahí.

---

## Entradas por coste

### puro/Node — victorias baratas (sin núcleo)

> Las dos entradas de estados (CDDA, Veloren) están aquí por lo que cuesta la **representación**,
> que es puro/Node. Su estado canónico y sus efectos **no** son de Node: viven en el escenario Lua
> o el núcleo (#847).

**DCSS — verbos sorteados + severidad (adoptar).** Un mensaje de combate elige un verbo entre
varios y codifica la magnitud con puntuación (`.`/`!`/`!!`). Nuestro `event-journal.mjs` repite
la misma plantilla; una tabla de sinónimos por tipo + modificador de severidad da prosa que no
suena a máquina, sin núcleo. #526: solo lo observable.

**Brogue CE — titular de impacto de una línea (adoptar).** Destila cada evento en una línea de
sabor; una línea de resumen localizada por entrada eleva la legibilidad del diario sin motor.
#526: resume el hecho, no lo interpreta.

**Shattered Pixel Dungeon — colapso ×K (adoptar, con condición dura).** Agrupa eventos idénticos
contiguos en «(nuevo) ×K». Entra como **agregado visual separado** del registro autoritativo: la
página por `eventId` de `event-journal.mjs` y su deduplicación siguen intactas, y la vista agrupada
las resume conservando la lista completa de los `eventId` que agrega. Agrupar por `(tipo + destino)`
en una sola página rompería la correspondencia 1:1 que hace el diario auditable e idempotente —al
reentregar una ráfaga ya no habría con qué saber qué falta—. Si una implementación no puede
conservar todos los IDs, no se hace (#846).

**Cataclysm: DDA — estados corporales legibles (adoptar).** Red de ~30 estados de los que
recortamos el subconjunto de 5 para la tripulación (ver abajo). El **estado canónico y sus efectos
viven en el escenario Lua o el núcleo**; el puente los publica y el módulo los **representa**
(#847). Un modelo de estados que viviera en Node y `station-actions.mjs` desaparecería al quitar
Foundry y se llevaría por delante el efecto que dice tener. La cadena #484 propaga.

**Veloren — buffs/debuffs legibles (adoptar).** Confirma la regla de oro: un estado debe ser
*legible por quien lo recibe*. Si otro puesto no puede leerlo, no es estado, es ruido. Como en CDDA,
la **representación** es puro/Node y el estado canónico con su caducidad es del escenario (#847).

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
**Resolvedor y estado viven en el núcleo** (#766, ADR-0008): «Node» no equivale a standalone-first,
y un mundo que reacciona entre sesiones es autoridad de campaña (#845). El módulo solo lo muestra.

### Lua de escenario + puente — crisis en la sesión

**Space Station 14 — tripulación, roles y avería (adoptar, #484).** El fallo de un puesto es
material para otro. La **autoridad reside en el escenario Lua y el puente**; `station-actions.mjs`
es su **proyección** en el adaptador opcional de Foundry —declara qué órdenes ofrece cada puesto de
las que el puente ya autoriza— y no es donde reside la autoridad (#848): si Foundry desaparece,
manda el escenario. Al caer un puesto, suspender su autoridad y redistribuir su carga (hueco que
cierra Lote D). Todo en `lagunak_crisis_scenario_utility.lua` + puente, cero núcleo.

**Space Station 13 (tgstation) — job system + cascada (adoptar, #484).** El análogo del job system
es la matriz de autoridad del escenario, cuya proyección visible es `STATION_ACTIONS` en
`station-actions.mjs` (#848). SS13 aporta la evidencia de mesa de que el patrón escala a decenas de
roles sin romper la cadena.

### núcleo C++ — autoridad de campaña persistente

**Endless Sky — reputación por facción (adoptar, #766/#767).** Escalar por facción que gatea acceso
(aterrizar, misiones ofrecidas). Se adopta **qué mueve la relación** —qué actos la suben y la bajan,
y con qué peso—, **no la transitividad**: la propagación automática (ayudar a X daña a Y) queda
`descartada` en #849, porque en una mesa con GM la consecuencia aparecería sin que nadie la hubiera
decidido y le quitaría al GM lo único que este proyecto le reserva entero. En su lugar, la relación
entre facciones se **declara** en el atlas y se le **avisa** al GM, que decide. Autoridad de campaña
que persiste → núcleo C++, no puente/Lua ni `npc-generador.mjs`. El módulo Foundry solo
consulta/muestra el escalar.

**FreeOrion — matriz de relaciones entre imperios (adoptar, #213/#767).** Relación bilateral por
cada par de imperios (valor + tratados + actitudes de IA). Extiende el escalar de A a facción↔facción:
una matriz, no un vector. Campaña → núcleo C++.

---

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
6. **Estados corporales legibles** (Cataclysm: DDA) — riqueza 4, `puro/Node + escenario`.
   Su estado canónico y sus efectos viven en el escenario Lua o el núcleo (#847); el módulo lo
   representa.
7. **Job system como validación** (Space Station 13) — riqueza 4, `Lua + puente`. Su valor es la
   evidencia de mesa de que el patrón de SS14 escala, no una mecánica nueva.
8. **Matriz de relaciones** (FreeOrion) — riqueza 4, `núcleo C++`. Extiende la reputación de vector
   a matriz y **no se abre antes que ella**.

**Luego — riqueza media, mejora cómo se cuenta o se resuelve lo que ya pasa:**

9. **Tablas de reacción de actitud** (SRD 5.1) — riqueza 3, `puro/Node`.
10. **Misión declarativa + sorteo** (Endless Sky) — riqueza 3, `puro/Node + núcleo`.
11. **Tablón que filtra + plantillas** (Naev) — riqueza 3, `Lua escenario + núcleo`.
12. **Buffs/debuffs legibles** (Veloren) — riqueza 3, `puro/Node + escenario`. Estado canónico
    en escenario/núcleo (#847); el módulo lo representa.

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

- Mecánicas completas: **16** (≥8 ✓), de **15 juegos** estudiados — Endless Sky aporta dos, por eso
  los dos números no coinciden. Descartes razonados: **13** (≥2 ✓). El recuento sale de la tabla
  rápida y de la lista de descartes de este mismo documento; si una de las dos cambia, este número
  cambia con ella.
- Este índice **consolida solo los lotes fusionados en `main`** (A #849, B #843, C #848, D #847,
  E #846, F, G #845) y no reabre ninguna decisión ya cerrada en ellos. En concreto, y porque una
  pasada anterior de este documento las había contradicho: el colapso ×K de SPD conserva la página
  por `eventId` y agrupa solo la vista (#846); el estado canónico de los estados de personaje vive
  en el escenario o el núcleo y el módulo lo representa (#847); `station-actions.mjs` es la
  **proyección** de la matriz de autoridad, no su sede (#848); la reputación de Endless Sky se
  adopta **sin transitividad** (#849); y el resolvedor de los *Faction Turns* vive en el núcleo,
  no en Node (#845).
- Cada entrada declara fuente y licencia verificada en su lote (la verificación está en el
  fichero de cada lote, no aquí de memoria). Corrección de esta pasada: Forged in the Dark es
  **CC BY 3.0** (no 4.0, como decía la pasada anterior heredada de #845).
- Toda adopción respeta la frontera #526 y el objetivo ADR-0008 (standalone-first), pero la
  columna **Standalone** de la tabla dice la verdad: **5 de 16** adoptar viven hoy solo como script
  del módulo de Foundry (`event-journal.mjs`, `npc-generador.mjs` o un pintor de arco) y no son
  standalone-first hasta portar su estado canónico al núcleo.
- Ordenado por **coste ascendente** en la tabla y **priorizado** por riqueza narrativa / coste en
  su propia sección, que es lo que pide el criterio de salida: una columna puntúa, no prioriza.
- **Alcance:** aquí solo entran *mecánicas de rol* de juegos libres, que es el criterio de #840.
  Las fuentes de **assets** y de **setting** (Kenney, Beyond the Spozak) no son mecánicas y
  pertenecen a #568 / #213; ampliar el barrido con fuentes nuevas tampoco es de este cierre. Se
  tramitan en su alcance propio, no aquí.
- Los ficheros `lote-*.md` van **enlazados**, no citados en prosa, así que el gate de rutas los
  vigila de verdad.
- Enlazado desde `README.md` (sección Recursos) y desde `ECOSISTEMA_OPEN_SOURCE.md` (#568): este
  documento estudia *qué mecánica robar*; el de #568 estudia *de qué depender*.

Con los siete lotes en `main` y este índice, **#840 queda cerrado**.
