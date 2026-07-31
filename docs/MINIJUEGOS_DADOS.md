# Dados de cubilete — reglas del segundo vertical (#413)

Actividad social de tripulación para viajes, descansos y escenas de cantina: un
juego de faroleo con dados escondidos bajo el cubilete. La inspiración declarada
es el género del *dado mentiroso*, popular mucho antes de que ninguna película lo
llevara a una taberna; las reglas, los nombres y el arte de esta mesa son
propios, y ni un solo término, ilustración o texto viene de una obra ajena.

Este documento cubre las reglas y el flujo de una ronda. El contrato de sesión
—identidad, época, revisión, nonces, lobby, espectadores, ausencias— es el común
a todos los minijuegos y vive en [MINIJUEGOS_FOUNDRY.md](MINIJUEGOS_FOUNDRY.md);
aquí no se repite.

## Qué se reutiliza y qué es nuevo

La razón de que el segundo vertical cueste un motor y no un sistema entero es que
lo común ya estaba fuera del póker:

| Pieza | Módulo | Estado |
|---|---|---|
| Sesión: identidad, época, revisión, nonces, lobby, espectadores, ausencias, cancelación segura | `minijuegos/sesion-motor.mjs` | se reutiliza **sin tocar** |
| Aleatoriedad determinista sembrada | `minijuegos/aleatorio.mjs` | se reutiliza sin tocar |
| Turnos de asientos automáticos | `minijuegos/turnos-automaticos.mjs` | se reutiliza; falta la política de dados |
| Transporte Foundry (flags de `User`, vistas dirigidas) | `minijuegos/adaptador-sesion.mjs` | se reutiliza |
| Reglas de la ronda | `minijuegos/dados-motor.mjs` | **nuevo** |
| Motor 3D retro (proyección, sombreado, época) | `retro3d.mjs` | se reutiliza **sin tocar** |
| Geometría del dado y orientación legible | `minijuegos/dados-3d.mjs` | **nuevo** |
| Política del jugador automático | pendiente | nuevo |
| Mesa y arte de cubilete | pendiente | nuevo |

El motor de dados es **hermano** del de póker, no una rama dentro de él: dos
juegos en un mismo reductor obligarían a cada regla a preguntar primero de qué
juego habla. Lo que comparten es la interfaz interna, no el código de reglas.

## Reglas de una ronda

- **Mesa:** de 2 a 6 jugadores. Cada uno empieza con **5 dados** de seis caras.
- **Tirada:** al abrir la ronda, cada jugador tira todos sus dados y solo él ve
  su cubilete.
- **Turnos:** por orden de asiento, saltando a quien se ha quedado sin dados. La
  ronda la abre el asiento que indique la mesa, y esa apertura rota entre rondas.
- **Apostar:** una apuesta es «hay al menos *N* dados con la cara *C*» contando
  **todos** los cubiletes de la mesa, no solo el propio.
  - Quien abre la ronda solo puede apostar.
  - Cada apuesta debe **superar** a la viva: más dados de cualquier cara, o los
    mismos dados de una cara más alta.
  - No se admite prometer más dados de los que hay sobre la mesa: eso no es un
    farol, es una apuesta que nadie puede ganar.
- **Dudar:** en vez de subir, se duda de la apuesta viva. Se destapan todos los
  cubiletes y se cuenta.
  - Si hay **al menos** lo prometido, la apuesta se sostiene y **pierde quien
    dudó**.
  - Si hay menos, era farol y **pierde quien apostó**.
- **Comodines:** los unos cuentan como cualquier cara. Cuando la apuesta es *de
  unos*, no se suman dos veces: valen solo los unos que hay. Es configurable por
  el anfitrión (`unosComodin`), porque sin comodines el juego es más aritmético y
  menos temerario, y hay mesas que lo prefieren.
- **Perder:** el perdedor de la ronda entrega **un dado**. Quien se queda a cero
  sigue **sentado y mirando el destape**, como en el póker: esta capa es social
  antes que competitiva.
- **Fin de la partida:** cuando solo queda un jugador con dados. Montar la ronda
  siguiente o dar la partida por terminada es decisión de la capa de mesa; el
  motor solo juega una ronda y devuelve quién sigue vivo.

## Flujo de una ronda

```text
lobby ──start──▶ tirada secreta ──▶ apuesta ──┬── apostar (supera) ──▶ turno siguiente
                                              └── dudar ──▶ destape ──▶ resultado
                                                              (alguien pierde un dado)
```

## Autoridad del estado y aleatoriedad

Idéntica al póker, y por las mismas razones:

- el estado autoritativo lo lleva el **GM coordinador**; los clientes proponen
  acciones cerradas y nunca escriben el estado del juego;
- toda la aleatoriedad entra por **semilla**, que solo conoce el coordinador: el
  motor no llama a `Math.random()` y una partida sembrada es reproducible de
  principio a fin;
- la identidad del actor la resuelve el adaptador desde el documento `User` que
  el servidor autorizó a escribir (#237); cualquier identidad que venga dentro
  del sobre se ignora por diseño;
- los cubiletes vivos **nunca** aparecen en el estado público, ni en registros ni
  en flags compartidos. Como en el póker, esto es **privacidad de interfaz**, no
  secreto criptográfico frente a un cliente con herramientas de desarrollo, y no
  debe venderse como otra cosa. El destape sí es público: es lo que hace el
  resultado comprobable para la mesa y para los espectadores.

## Los dados se ven en 3D retro, y se leen

Los dados se dibujan con el motor 3D de consola de #362 (`retro3d.mjs`), la misma
pieza que enseña los cascos: cubos de verdad, con sombreado plano, pocos tonos y
el aspecto de la época que elija la superficie —el temblor de vértices de la PSX
o la silueta limpia de la GameCube—.

**Un dado bonito girando es un dado ilegible.** Si la cara que vale cae de canto,
el jugador tiene que adivinar su propia tirada, y en una mesa de faroleo lo único
que no puede ser ambiguo es el número. La salida no es renunciar al volumen:

- la orientación de reposo **se calcula**, no se sortea. La cara del valor mira
  siempre a la cámara, y hay pruebas que lo fijan para los seis valores;
- se le añade una **inclinación corta y fija** que enseña dos caras vecinas: lo
  justo para que se lea como un objeto y no como un cuadrado pintado, sin que la
  cara del valor pierda área en pantalla;
- los puntos son **geometría**, cuadraditos despegados del cuerpo, no textura:
  una textura pediría un mapeado de UV que el motor no tiene, y un cuadradito
  ajustado a la rejilla es justo lo que hacía la consola que se imita;
- un dado solo sale de canto **si se pide** (`giro`), que es lo que permitirá
  animar la tirada y aterrizar en la orientación legible al pararse.

Ningún color se declara en el módulo de dados: cuerpo y tinta salen de
`paleta.mjs`, y la guardia de `paleta.test.mjs` lo comprueba.

## Abandono, reconexión y espectadores

Lo resuelve la capa de sesión, igual que en el póker: abandonar en partida marca
**ausente** y reserva el asiento, `return` lo recupera, y la pérdida definitiva
del coordinador cancela la ronda sin resultado en vez de reconstruir cubiletes
desde datos públicos. Los espectadores ven la apuesta viva, de quién es el turno,
cuántos dados hay en juego y el destape; ningún cubilete antes de ese destape.

## Sin apuestas reales

No hay dinero real, ni compras, ni recompensas que salgan de la mesa. Los dados
son efímeros y no representan nada fuera de la partida. Los ganchos narrativos
opcionales que pida el GM se resuelven fuera del motor y nunca convierten esto en
una economía.

## Pendiente

- Política del jugador automático para dados (`agente-automatico.mjs` es de
  póker; `turnos-automaticos.mjs` ya admite cualquier política inyectada).
- Mesa, cubilete y textos ES/EN. El dado ya tiene geometría; falta el lienzo que
  la pinta (como `retro3d-lienzo.mjs` hace con las naves) y la animación de la
  tirada, que rueda libre y aterriza en la orientación legible.
- Cableado de la mesa como sesión de tipo `dados` en `minijuegos-wiring.mjs`.
- Plan de pruebas multijugador real, que como en #308 espera a tener Foundry
  delante.
