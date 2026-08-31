# Crisis multipuesto: la emboscada de ecos

Issue [#484](https://github.com/VaroTv7/espaciokooplagunak/issues/484), frente 5 de la Etapa B
(coordinación en [#479](https://github.com/VaroTv7/espaciokooplagunak/issues/479)).

Este documento es el criterio de aceptación del issue puesto por escrito: **qué puesto hace qué y
por qué es necesario, no solo deseable**.

## El problema que resuelve

El criterio de salida de la Etapa B pide un encuentro que exija coordinación real entre tres o más
puestos. El modo fácil de fingirlo es repartir cuatro tareas independientes y llamarlo cooperación:
sensores escanea *lo suyo*, ingeniería repara *lo suyo*, armas dispara *lo suyo*. Eso no es
coordinar; es jugar solos en la misma sala, y se supera aunque tres de los cuatro no se hablen.

Aquí la dependencia es una **cadena**: cada eslabón es precondición dura del siguiente, y romper uno
no degrada el resultado, lo hace imposible.

## Qué pasa en la mesa

El GM introduce el arquetipo `ambush` desde Foundry. Aparecen **tres contactos con el mismo casco
civil** (`Personnel Freighter 1`), misma descripción sin escanear, baliza de socorro activa. Dos
llevan supervivientes. El tercero es un **buque trampa**: baterías ocultas tras la carga. Nace
**neutral**, no hostil, y ese no es un detalle cosmético — la IA de EmptyEpsilon dispara a un enemigo
en rango aunque su orden sea `idle`, así que un asaltante hostil desde el principio se delataría solo
al acercarse la nave y el trabajo de sensores dejaría de existir. El disfraz es también de facción, y
cae de una sola vez al revelarse.

- **Comunicaciones — sostiene el parlamento.** Los tres comparten el jammer del asaltante. Mientras
  no haya un canal abierto con alguno de ellos, **todo escaneo terminado se borra**. Escanear sin
  comunicaciones no es lento: es estéril. Hay 4 s de gracia al cerrarse el canal, suficiente para
  perdonar un cierre accidental de ventana y demasiado poco para sustituir al puesto.
- **Sensores — identifica.** Los tres son indistinguibles hasta que un escaneo **se completa
  durante el parlamento** (complejidad 3, profundidad 2 en el asaltante: dos escaneos completos, o
  sea tiempo real de canal sostenido). Solo entonces el escenario anuncia qué indicativo es el
  trampa.
- **Armas — ejecuta sobre el blanco correcto.** Sin identificación solo puede elegir a ciegas, 1 de
  3. Y destruir un señuelo no es un tiro fallado: **rompe el parlamento para siempre** (los otros
  dos cortan la señal), lanza al asaltante al ataque y cuenta como baja civil.
- **Ingeniería — cuarto puesto, y no es un eslabón.** El escaneo completo revela la frecuencia de
  escudos del asaltante, que ingeniería puede contrarrestar (`set_shield_frequency`), además de su
  trabajo nativo de sostener escudos y energía bajo fuego. **No se le cuelga una condición de
  victoria a propósito**: la ventaja de frecuencia depende del ajuste de servidor
  `use_beam_shield_frequencies`, que el anfitrión puede apagar en la pantalla de selección de nave.
  Construir la cadena sobre algo que puede no existir en la mesa sería una necesidad de mentira.
  Es recompensa de la cadena, no eslabón de ella.

## Fallar uno cambia el resultado, y en esta dirección

| Puesto que falla | Consecuencia |
|---|---|
| Comunicaciones | No hay identificación **posible** en toda la crisis. Sensores puede escanear indefinidamente. |
| Sensores | Armas solo puede disparar a ciegas: 1/3 de acertar, 2/3 de matar civiles y endurecer la crisis. |
| Armas | La identificación no detiene a nadie: el asaltante sigue disparando. |
| Ingeniería | Se sobrevive peor y más lento. No impide resolver. |

## Desenlaces

El escenario los distingue y los anuncia; **ninguno termina la guardia** — la crisis es un encuentro
dentro de la misión, no la misión:

- `resuelta` — buque trampa destruido, los dos civiles enteros. Es el único éxito.
- `con_bajas` — buque trampa destruido, al menos un civil perdido. Se sobrevive; se resolvió mal.
- `perdida` — la nave del jugador se pierde.

## Dónde vive

- `scripts/lagunak_crisis_scenario_utility.lua` — la crisis entera: máquina de estados, interferencia,
  parlamento, latch de identificación y desenlaces. Es una **utilidad reutilizable**, no parte del
  escenario 90: cualquier escenario puede requerirla y montarla desde su catálogo de encuentros.
- `scripts/scenario_90_lagunak_primera_guardia.lua` — el cableado: despacha `ambush` en
  `lagunakSpawnEncounter` y avanza las crisis vivas en `update`.
- `bridge/command_models.py` — `ambush` como un valor más de `EncounterArchetype`.
- `foundry-module/lang/{es,en}.json` — la etiqueta del selector. El módulo no hardcodea arquetipos:
  los lee de `/v1/encounters`, así que no necesitó ni una línea de JavaScript.

## Complicaciones adjudicadas por el GM

Una pifia de asistencia puede convertirse en una consecuencia real sin depender de Foundry. La
utilidad expone un catálogo cerrado en la consola Lua nativa:

```lua
lagunakCrisisComplicaciones()
```

Durante `scenario_90`, el GM aplica una de las opciones a una crisis activa:

```lua
crisisActivas[1]:aplicarComplicacion("reactor_sobrecalentado")
crisisActivas[1]:aplicarComplicacion("margen_parlamento_reducido")
```

La primera añade calor real al reactor, acotado por la simulación. La segunda reduce de cuatro a un
segundo el margen que conserva el parlamento al cerrarse el canal. Un identificador desconocido o
una crisis ya terminada se rechazan sin efectos. La elección corresponde al GM: una pifia no dispara
una consecuencia aleatoria ni concede a Foundry autoridad para mutar la simulación.

## Lo que esta crisis NO abre

No añade ninguna orden nueva al puente ni a la matriz de autoridad. Las cuatro acciones que la
resuelven —`send_comm_message`, `scan_object`, `set_weapon_target`/`fire_tube` y
`set_shield_frequency`— ya estaban en `station-actions.mjs`, verificadas por los verticales de
agencia #462–#465. Y `ambush` sigue siendo un nombre de un catálogo cerrado: ni coordenadas ni
definición de objeto desde el cliente (ADR-0002). Que una crisis coordinada no haya necesitado
abrir un solo campo nuevo hacia el puente es el resultado que interesa conservar.

## Estado

Suites del puente (pytest) y del módulo (Node) en verde en local. Sintaxis Lua verificada con
`luac -p` sobre todo `scripts/` (0 fallos) — en local con Lua 5.5, mientras que el job `LuaTest` de
CI usa 5.3: es esa segunda pasada la que vale como registro. **Falta el playtest
con personas**, que es [#467](https://github.com/VaroTv7/espaciokooplagunak/issues/467) y puede usar
esta crisis como su escenario de prueba: hasta entonces, la cadena está demostrada en el código y no
en la mesa.
