# Lote F — Barrido del resto de la lista (bobeff) y cierre de #840

Parte de docs/INSPIRACION_JUEGOS_LIBRES.md (issue #840); este lote escribe el índice final que compila A–G.

- **Autor del análisis:** Hermes (consolidación + barrido).
- **Fuente declarada:** la lista de bobeff/open-source-games, y los repositorios `Angband/Angband`
  y `freeorion/freeorion`. **Leído por encima**, no jugado. Licencias verificadas contra fuentes
  primarias (el API de GitHub no autodetecta el fichero en ninguno de los dos).
- **Fichero previsto en el issue:** `docs/inspiracion/lote-f-barrido.md`.
- **Estado:** barrido real de la lista de bobeff hecho en esta sesión; dos entradas nuevas no
  cubiertas por A–E,G, más el índice que cierra el issue.

La pregunta del lote: barrer la lista de bobeff por candidatos que A–E,G no cubran ya. Conclusión
del barrido: los candidatos fuertes (simuladores espaciales, roguelikes, TTRPGs libres) ya están en
A–E,G; lo que queda o es redundante (otro space-sim = A, otro roguelike = D/E, otra TTRPG = G) o
demasiado pesado para standalone-first (4X, economía de transporte). Este lote aporta dos entradas
distintas y escribe el índice final.

## Angband — bestiario que se aprende por avistamiento (#767)

1. **Juego y licencia:** Angband — **GPL-2.0** (verificada vía `copying.txt`; el API de GitHub
   devuelve 404 porque el fichero no se llama `LICENSE` — confirmado en la documentación oficial
   de Angband y en la lista de videojuegos OSS de Wikipedia).
2. **Mecánica:** el juego mantiene un *monster recall*: cada vez que encuentras una criatura,
   registra sus propiedades (resistencias, capacidades, botín) y el conocimiento se acumula
   partida a partida; el bestiario se rellena según vas avistando, no de golpe. Es conocimiento
   del mundo que persiste y crece con el uso.
3. **Problema nuestro:** #767 (Registro de Avistamientos y Bestiario Local) es literalmente esto.
   La mecánica a robar: el bestiario es una estructura *aprendida* — no empiezas con todo sabido;
   los avistamientos se acumulan y persisten. Toca `npc-generador.mjs` (deriva texto del modelo) y
   #766 (persistencia).
4. **Coste:** puro/Node para el texto de recall (como los estados de Lote D o la prosa de Lote E) y
   su derivación; **núcleo C++** para el registro persistente de avistamientos (autoridad de
   campaña, ADR-0008). El módulo Foundry solo proyecta lo aprendido; no lo posee.
5. **Veredicto:** `adoptar`. Tarjeta:
   `feat(bestiario): registro de avistamientos que se aprende por encuentro y persiste (#767), con texto de recall en puro/Node`.
   **Frontera #526:** el recall describe propiedades observadas, no inventa lore del monstruo.

## FreeOrion — matriz de relaciones entre imperios (#213/#767)

1. **Juego y licencia:** FreeOrion — **GPL-2.0** (verificada vía el repo y LibreGameWiki: «The
   game's source code is licensed under the GPL v2»).
2. **Mecánica:** FreeOrion lleva una relación bilateral entre *cada par* de imperios (no solo
   jugador↔facción): cada par tiene un valor de relación, tratados (no-agresión, alianza) y
   actitudes de la IA. La galaxia reacciona a través de esa matriz. Esto extiende el Lote A
   (escalar de reputación jugador→facción) a relaciones facción↔facción: una **matriz**, no un vector.
3. **Problema nuestro:** #213 (mundo que recuerda) y #767. Una matriz persistente de relaciones
   entre facciones es autoridad de campaña (núcleo). Distinta del escalar de A en que modela
   diplomacia entre terceros, no solo la del jugador.
4. **Coste:** **núcleo C++** (matriz persistente de relaciones — autoridad de campaña, ADR-0008);
   puro/Node para el texto diplomático.
5. **Veredicto:** `adoptar` (como patrón de diseño). Tarjeta:
   `feat(campana): matriz de relaciones facción-a-facción persistente + tratados (#213/#767, ADR-0008)`.
   **Frontera #526:** las relaciones son estado observable.

## Descarte 1 — bucle 4X completo (FreeCiv / FreeCol: árbol de tecnología + conquista)

1. **De dónde sale:** FreeCiv (GPL-2.0) / FreeCol (GPL-3.0), referentes de 4X en la lista de bobeff.
2. **Por qué no:** el bucle 4X (eXplore/eXpand/eXploit/eXterminate) es un juego de estrategia entero;
   árbol de tecnología + ciudades + conquista son demasiado pesados para el alcance standalone-first
   de un simulador de puente cooperativo. El árbol de tecnología como progresión de campaña podría
   ser un `cimiento` aparte, pero el bucle completo queda fuera de #840. **`descartado`**.

## Descarte 2 — simulación de economía de transporte (OpenTTD / Simutrans)

1. **De dónde sale:** OpenTTD / Simutrans (GPL-2.0) en la lista de bobeff.
2. **Por qué no:** igual que Pioneer/Oolite en el Lote B — resolver equilibrio de precios/rutas
   exige una economía persistente que es territorio de núcleo (#766) y no aporta «trabajo que
   aparece solo». **`descartado`** para #840 (estudio aparte si algún día queremos precios
   contextuales).

## Resultado del barrido

La lista de bobeff se barrió de verdad en esta sesión. Los candidatos fuertes (simuladores
espaciales, roguelikes, TTRPGs libres) ya están cubiertos por A–E,G. Lo no cubierto o es redundante
(otro space-sim = A, otro roguelike = D/E, otra TTRPG = G) o demasiado pesado (4X, economía). Este
lote cierra #840 aportando las dos entradas distintas de arriba y escribiendo el índice final
`docs/INSPIRACION_JUEGOS_LIBRES.md` que compila A–G (16 entradas, 13 descartes).

> **Pendiente:** el índice ya existe y cierra el issue; solo falta la revisión humana y el merge de
> los PRs de lotes (A #849, B #843, C #848, D #847, E #846, G #845, F #850) para que los ficheros
> `lote-*.md` enlazados en prosa dejen de ser referencias a ramas y pasen a estar en `main`.
