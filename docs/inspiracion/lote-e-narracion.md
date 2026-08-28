# Lote E — Cómo se narra lo que pasó

Parte de docs/INSPIRACION_JUEGOS_LIBRES.md (issue #840); el índice lo escribe quien cierra el último lote.

- **Autor del análisis:** Hermes (consolidación).
- **Fuente declarada:** wikis y posts de diseño de cada proyecto (CrawlWiki +
  learndb para DCSS; sitio de Brogue y grogpod/RPS para Brogue CE; código y
  repo de Shattered Pixel Dungeon). **Leído por encima**, no jugado. Licencias
  verificadas contra el repo de cada uno (vía API de GitHub: `crawl/crawl`
  LICENSE = GPL-2.0-or-later; `tmewett/BrogueCE` = AGPL-3.0;
  `00-Evan/shattered-pixel-dungeon` = GPL-3.0).
- **Fichero previsto en el issue:** `docs/inspiracion/lote-e-narracion.md`.
- **Estado:** borrador de primera pasada, con fuente verificada. Cumple la
  regla de admisión del issue: cada entrada dice las cinco cosas y tiene
  veredicto; hay al menos un descarte razonado.

La pregunta del lote: de dónde sale el texto de un registro para que no suene a
máquina, y dónde está la frontera entre describir y afirmar una lectura (regla
de #526). Toca `event-journal.mjs` y `bitacora-nave.mjs`.

## Dónde estamos hoy (ancla real, leída del repo)

- `foundry-module/scripts/event-journal.mjs` recibe eventos del puente
  (llegada, reposición de buque, encuentro) y escribe **una página de diario por
  evento** con `game.i18n.format("LAGUNAK.Eventos…", {…})`. El texto es siempre
  la misma plantilla: «El buque X llegó a Y tras N s». Varia los *datos*, nunca
  las *palabras*. Acumula decenas de entradas idénticas en estructura → suena a
  máquina. Además valida forma y escapa HTML (no escribe nada cuya forma no
  haya validado), y deduplica por `eventId`.
- `foundry-module/scripts/bitacora-nave.mjs` anota el estado de la nave a petición
  del GM (callsign, posición, rumbo, casco, energía, escudos) con etiquetas
  localizadas. También plantilla fija, también solo hechos.

Conclusión del ancla: tenemos *registro de hechos*, no *narración*. El hueco que
ataque este lote es la **variación de prosa** y la **colapsación de duplicados**,
sin cruzar nunca la línea de #526 (el texto describe lo observable; no afirma
intención, moral ni lectura del GM).

## Dungeon Crawl: Stone Soup — verbos sorteados y puntuación de severidad

1. **Juego y licencia:** Dungeon Crawl: Stone Soup — **GPL-2.0-or-later**
   (verificada en `crawl/crawl` → LICENSE: «either version 2 of the License, or
   (at your option) any later version»).
2. **Mecánica:** un mensaje de combate no es una frase fija; elige un *verbo*
   entre varios («golpeas», «tallas», «rozas»…) por golpe, conjugado para el
   actor («golpeas al orco» / «el orco te golpea»), y codifica la magnitud del
   daño con la **puntuación** (`.` leve, `!` mayor, `!!` crítico — documentado en
   learndb: «if you hit something and the message ends with !…»). Los mensajes
   repetidos colapsan por canal para no inundar el log.
3. **Problema nuestro:** `event-journal.mjs` repite la misma plantilla por cada
   evento del puente. Una tabla de sinónimos por tipo de evento + un modificador
   de severidad (p.ej. margen de tiempo, diferencia de casco) daría prosa que no
   suena a máquina sin añadir arte ni núcleo. La conjugación «tú / la nave» ya la
   tenemos vía i18n.
4. **Coste:** puro/Node. Tabla de sinónimos + selección por `scenario_time`/
   magnitudes, dentro del descriptor `pagina` de `event-journal.mjs`. No toca
   núcleo C++ ni Lua de escenario; el diario sigue siendo standalone-first (ADR-0008).
5. **Veredicto:** `adoptar`. Tarjeta:
   `feat(bitacora): variación de prosa en el diario de eventos (sinónimos por tipo + severidad) sin tocar núcleo`.
   **Frontera #526:** los sinónimos y la severidad solo describen lo observable
   (distancia, daño de casco); nunca se introduce intención ni juicio del GM.

## Brogue CE — una línea vívida y tersa por evento

1. **Juego y licencia:** Brogue: Community Edition — **AGPL-3.0** (verificada en
   `tmewett/BrogueCE` → badge «AGPL-3.0 license»).
2. **Mecánica:** Brogue no genera prosa procedural enorme; destila cada
   monstruo, objeto y tipo de terreno en **una sola línea de sabor** tersa y
   evocadora, y dedica una línea permanente de la UI a esa frase (RPS: «there's
   an entire line of the UI that is permanently… flavor text»). La lección no es
   el catálogo, es el *principio*: una frase bien elegida por evento lee mejor
   que un párrafo de sistema.
3. **Problema nuestro:** nuestro diario anota hechos sin ninguna capa de
   «qué se lleva el lector». Una línea de resumen por entrada (no el String
   inglés de Brogue, sino el patrón: un titular de impacto localizado) elevaría
   la legibilidad del registro del puente sin coste de motor.
4. **Coste:** puro/Node. Un campo `titular` localizado por descriptor en
   `event-journal.mjs`; reusa la misma i18n que hoy. Cero binarios, cero núcleo.
5. **Veredicto:** `adoptar` (como *principio de formato*, no como Strings a
   importar). Tarjeta:
   `feat(bitacora): titular de impacto de una línea por entrada del diario, localizado`.
   **Frontera #526:** el titular resume el hecho, no lo interpreta; nunca «el
   capitán sostuvo la línea con valor» (eso sería afirmar una lectura no en el evento).

## Shattered Pixel Dunungeon — interpolación de valores y colapso de log

1. **Juego y licencia:** Shattered Pixel Dungeon — **GPL-3.0** (verificada en
   `00-Evan/shattered-pixel-dungeon` → LICENSE.txt, SPDX `GPL-3.0`).
2. **Mecánica:** el `GLog` produce mensajes cortos construidos por *strings
   estáticos con valores interpolados* («X hace Y de daño a Z», «recogas W») y
   colapsa entradas idénticas contiguas en «(nuevo) ×K». Es el patrón más barato
   de los tres: ni siquiera necesita sinónimos para dejar de sonar a máquina, sino
   *no repetir la misma línea entera* cuando el evento se acumula.
3. **Problema nuestro:** `event-journal.mjs` ya deduplica por `eventId`, pero dos
   eventos distintos con la misma plantilla se leen idénticos. El colapso
   «×K» de SPD (agrupar N llegadas a un mismo puerto en una línea) es exactamente
   la consecuencia diferida que el diario necesita cuando el puente emite a ráfaga.
4. **Coste:** puro/Node. Extender la deduplicación de `event-journal.mjs` para
   agrupar por (tipo + destino) y mostrar conteo. Mismo alcance que hoy.
5. **Veredicto:** `adoptar`. Tarjeta:
   `feat(bitacora): agrupar eventos iguales contiguos del puente en una línea con conteo`.
   **Frontera #526:** el conteo es un hecho; no infiere por qué se repiten.

## Descarte razonado

- **Traer el catálogo de prosa de Brogue o SPD cosido al repo** → `descartado`.
  Son Strings de autoría inglesa a mano, no datos reutilizables: copiarlos sería
  #568 (procedencia de assets/texto) y no resuelve el problema, que es el
  *mecanismo* (variación + colapso), no el contenido. Lo reutilizable es el
  principio, ya volcado en los tres `adoptar` de arriba. Fuera de alcance de #840.

## Lo que el lote E no resuelve

De dónde sale el *contenido* narrativo quando el GM escribe a mano
(`bitacora-nave.mjs` lo deja en prosa libre del GM). Eso es autoría humana, no
mecánica que robar; este lote solo ataca la **capa automática** del diario de
eventos del puente.

## Resumen del lote

Tres `adoptar` (DCSS sinónimos+severidad, Brogue principio de titular, SPD
colapso ×K) + un descarte razonado (no importar Strings ajenos). Sin solapamiento
con B (misiones) ni G (SRD/fuentes): aquí el foco es la *prosa del registro*, no
la generación de contenido ni las reglas de rol. Todos cumplen ADR-0008
(puro/Node, standalone-first, cero arte, cero núcleo).

> **Pendiente:** confirmación con fuente de primera mano de la puntuación de
> severidad de DCSS (learndb la cita; no se leyó el `attack.cc` del repo). Lo
> aquí escrito es de wiki/dev posts, no de partida. No cambia el veredicto.
