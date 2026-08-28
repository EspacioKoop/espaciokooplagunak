# Lote D — Estados de personaje legibles (el subconjunto de cinco para un puente)

Parte de docs/INSPIRACION_JUEGOS_LIBRES.md (issue #840).

- **Autor del análisis:** Hermes (consolidación), fuente verificada por lectura de
  wikis y del código de referencia del repo.
- **Fuente declarada:** wiki de diseño de Cataclysm: DDA y de Veloren, y el propio
  LICENSE de cada repo. **Leído por encima**, no jugado. Licencias verificadas
  contra los repositorios (no de memoria).
- **Fichero previsto en el issue:** `docs/inspiracion/lote-d-estados.md`.
- **Estado:** borrador de primera pasada validado contra el código real del repo
  (ver ancla abajo).

La pregunta del lote (textual de #840): *cuál es el subconjunto de cinco estados
que sirve en un puente, y qué se descarta*. Cataclysm: DDA tiene una red de
~30 estados corporales/morales/fatiga; devolverlos todos sería no haber hecho el
trabajo. El recorte se guía por dos ejes duros del repo:

1. **Legibilidad (#484).** El fallo de un puesto tiene que ser *material para otro
   puesto* (cadena de la crisis multipuesto). Un estado que solo existe internamente
   no propaga nada.
2. **Frontera #526.** El estado describe lo **observable**; no se afirma una lectura
   interna/moral no observable. Por eso *moral* queda fuera y la sustituye *Enlace*.

## Ancla en el código real (por qué esto no es invento)

- `foundry-module/scripts/station-actions.mjs` ya es la **matriz de autoridad por
  puesto**: declara qué órdenes puede emitir cada puesto y las despacha al puente.
  Es el *qué puede hacer* un puesto. Este lote propone la capa complementaria: *en
  qué estado legible está el puesto*, para que la matriz pueda suspender autoridad
  cuando el puesto cae.
- `docs/CRISIS_MULTIPUESTO.md` (#484) define que el fallo de un eslabón cambia el
  resultado para los demás. Los 5 estados de abajo son justo la interfaz legible que
  la cadena necesita para detectar «este puesto acaba de caer».
- `foundry-module/scripts/npc-generador.mjs` ya deriva texto de un modelo de
  condición SRD; los estados del puente se enchufan en esa misma derivación de texto
  (describir lo observable, no afirmar lo interno — #526).

## Cataclysm: DDA

1. **Juego y licencia:** Cataclysm: DDA — **CC-BY-SA-3.0** (verificado en
   `LICENSE.txt` del repo `CleverRaven/Cataclysm-DDA`: «Creative Commons
   Attribution-ShareAlike 3.0 Unported»).
2. **Mecánica:** red de estados corporales/morales/fatiga con efectos *legibles*
   sobre la actuación del personaje, no un número de PV oculto. El jugador ve
   «aturdido», «agotado», «distraído» y actúa en consecuencia.
3. **Problema nuestro:** aporta la *taxonomía* de la que recortamos el subconjunto
   de 5 para la tripulación del puente. Cruza con #484 (el fallo de un puesto debe
   ser material para otro) y con `station-actions.mjs` (cuando un puesto cae, su
   autoridad se suspende — el estado es el gatillo).
4. **Coste:** puro/Node (modelo de estado de tripulación) + Lua de escenario para
   superficie en el HUD del puente. Cero núcleo C++, cero arte (ADR-0008,
   standalone-first).
5. **Veredicto:** `adoptar` como catálogo de origen del subconjunto. Tarjeta:
   `feat(estado-tripulacion): modelo de 5 estados legibles en puro/Node, consumido
   por station-actions.mjs para suspender autoridad y por la cadena de #484 para
   propagar`.

## Veloren

1. **Juego y licencia:** Veloren — **GPL-3.0** (verificado vía API de GitHub, repo
   `veloren/veloren`).
2. **Mecánica:** condiciones de personaje derivadas de combate/entorno, mostradas
   como buffs/debuffs *legibles* (nombre + efecto observable), no como número
   oculto detrás de la UI.
3. **Problema nuestro:** confirma la regla de oro de este lote — un estado debe ser
   *legible por quien lo recibe*, no solo existir internamente. Es exactamente la
   interfaz de #484: Atención/Enfoque y Enlace son estados que otro puesto puede
   leer y sobre los que decidir.
4. **Coste:** puro/Node (el estado es datos + texto derivado, igual que
   `npc-generador.mjs` ya deriva texto de una condición SRD). Cero núcleo.
5. **Veredicto:** `adoptar` como segundo punto de vista (legibilidad sobre
   existencia). Misma tarjeta `feat(estado-tripulacion)`; Veloren aporta la regla
   «si otro puesto no puede leerlo, no es estado, es ruido».

## Síntesis — el subconjunto de cinco estados para un puesto

Cada estado es una **etiqueta observable + un efecto legible**, nunca una lectura
interna. Se modelan como datos en puro/Node y se consumen en `station-actions.mjs`
(suspensión de autoridad) y en la cadena #484 (propagación).

| # | Estado | Observable (lo que ve otro puesto) | Efecto legible | Cruce |
|---|--------|-----------------------------------|----------------|-------|
| 1 | **Integridad de puesto** | presente / ausente / incapacitado | la matriz suspende su autoridad; relay lo ve caer | #484, `station-actions.mjs` |
| 2 | **Carga de órdenes** | nº de órdenes sin confirmar en cola | capitán/relay redistribuye; visible como backlog | #484 |
| 3 | **Fatiga** | decaimiento de rendimiento (no el «cansancio») | sus acciones bajan de nivel / ganan latencia | #526 (describe el decaimiento) |
| 4 | **Atención / Enfoque** | engagado / distraído / saturado | acciones marcadas; relay puede pedir relevo | #484 |
| 5 | **Enlace** | enlace al puente/otros puestos arriba/abajo | si cae, sus órdenes no llegan (como Comms en #484) | #484, #526 |

**Frontera #526 en cada uno:** se describe la condición observable (la cola, el
decaimiento, el enlace caído), nunca se afirma una lectura interna («está
desmoralizado», «sufre»). Por eso el estado 5 es *Enlace* y no *Moral*.

## Descarte razonado (lo que NO entra)

De la red de ~30 estados de CDDA, se descartan estos y por qué:

- **Moral** — estado interno/subjetivo; afirmarlo en el puente sería inventar una
  lectura → viola #526. Sustituido por *Enlace* (lo observable). `descartado`.
- **Dolor / Hambre / Sed / Enfermedad** — estados corporales internos no observables
  desde la conducta del puente en nuestro alcance; modelarlos exigiría simular el
  cuerpo (núcleo C++, fuera de standalone-first). `descartado`.
- **Resistencia / Stamina** — se funde con *Fatiga*; tener ambos es el fallo de
  «treinta estados». `descartado` por redundancia.
- **Poder de biónica** — recurso sci-fi sin analogía en nuestro modelo de tripulación.
  `descartado` (fuera de alcance).
- **Estados de sistema de nave** (casco, escudos, energía) — ya cubiertos por
  `barras-estado` / el `/v1/state` de la nave; no son de tripulación. `descartado`
  por solapamiento (viven en otro módulo).

## Resumen del lote

Dos `adoptar` (Cataclysm: DDA como taxonomía, Veloren como regla de legibilidad) +
un subconjunto de **cinco** estados cerrado + cinco descartes razonados. Todo
puro/Node y Lua de escenario, standalone-first (ADR-0008), frontera #526 respetada
en cada veredicto.

> **Pendiente:** el índice final docs/INSPIRACION_JUEGOS_LIBRES.md (citado aquí en
> prosa a propósito, porque aún no existe) lo escribe quien cierre el último lote.
