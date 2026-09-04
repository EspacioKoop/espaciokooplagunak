# Generador de NPC — motor (#676)

Una función: **semilla + valor de desafío → una ficha completa**. La misma
semilla da siempre el mismo NPC, así que un habitante de una sala se reconstruye
desde su id en cualquier cliente sin transmitir la ficha entera.

Este documento cubre el **motor**. La sala donde aparece, la conversación y
llevar la cuenta de a quién has conocido no están aquí y no están decididos: lo
último es el mismo reparto que [#598] dejó abierto para el bestiario, porque
*recordar* es del núcleo y no de una escena (`docs/FOUNDRY.md`).

## Las cuatro capas, y de dónde sale cada una

| Capa | Qué aporta | Referencia | Qué se importó |
|---|---|---|---|
| Ficha 5e | Atributos, modificadores, CA, PG, competencia | D&D 5e (2014) | **Texto y fórmulas.** SRD 5.1, CC-BY-4.0 |
| Afinidades | Seis grados por elemento: débil / neutral / resiste / nulo / absorbe / repele | Shin Megami Tensei, Persona | Solo la **mecánica** |
| Naturaleza y línea | Matriz de efectividad y tres etapas por línea | Pokémon | Solo la **mecánica** |
| Reparto de acciones | Acción / adicional / reacción / movimiento | Argon HUD | Solo la **forma del dato** |

### La línea que no se cruza

**Las mecánicas no se registran; los nombres y el arte sí.** De las tres últimas
referencias se toma cómo funciona algo y ni un solo nombre, icono o texto. Es la
misma disciplina que ya siguen las mesas de la cantina
([MINIJUEGOS_DADOS.md](MINIJUEGOS_DADOS.md)).

Con Argon HUD hay además un choque de licencias que zanja el asunto:
`theripper93/enhancedcombathud` es **GPL-3.0** y este árbol es **GPL-2.0** (ver
`LICENSE`). Son incompatibles: no se puede copiar, adaptar ni traducir código
suyo. Lo que sí se puede es **emitir la ficha en la forma que ese HUD consume**,
para que quien lo tenga instalado la vea repartida y quien no, vea la ficha
entera igual. Eso es interoperar por el dato, no derivar del código.

### Y va codificado, no comentado

Un párrafo como el anterior dura hasta que alguien amplíe las tablas un martes
por la tarde. `foundry-module/tests/npc-tablas.test.mjs` recorre **cada cadena
que el generador puede emitir** —tablas y trescientas fichas generadas— y falla
si aparece un término de esas obras.

No es teórico: la primera versión de la tabla de sílabas llevaba `"Mar"`, y de
ahí salían *Maranmir* y *Marasai*, que empiezan por el nombre de un demonio de la
escuela SMT. Revisar la lista de sílabas a ojo no lo habría visto. Por eso la
puerta mira los nombres **generados** y no solo las tablas.

## Qué hay en el árbol

| Pieza | Módulo | Estado |
|---|---|---|
| Aleatoriedad determinista sembrada | `minijuegos/aleatorio.mjs` | se reutiliza **sin tocar** |
| Tablas propias: sílabas, arquetipos, elementos, líneas | `npc-tablas.mjs` | nuevo |
| Motor: ficha, afinidades, efectividad, reparto | `npc-generador.mjs` | nuevo |
| Habitante pintado en la sala, conversación, memoria | — | **no entra todavía**, a propósito |

Ambos módulos son **puros**: ni Foundry, ni DOM, ni red, ni `Math.random()` —hay
una prueba que lo comprueba secuestrando `Math.random`—. Se ejecutan desde Node.

## La matemática 5e, y por qué es fórmula y no tabla

- **Modificador**: `floor((valor - 10) / 2)`, SRD 5.1.
- **Competencia por VD**: `+2` hasta VD 4 y `+1` más cada cuatro VD. Se escribe
  como fórmula porque una tabla de veintiún filas copiada a mano se equivoca en
  una y nadie lo ve; la prueba comprueba los cinco escalones.
- **PG**: media del dado de golpe de la talla más CON por dado, mínimo 1.
- Las características quedan acotadas entre **1 y 30**, como manda el SRD.

Los **elementos** no son un sistema paralelo: cada uno declara contra qué tipo de
daño del SRD se resuelve (`termico` → `fire`, `gravitico` → `force`…), así que la
mitad 5e de la ficha sigue siendo 5e de verdad y no una imitación con otros
nombres. La atribución viaja **dentro de la ficha** (`procedencia_reglas`), no en
un documento que nadie abre.

## Dos garantías del generador

- **Todo NPC tiene al menos una debilidad.** Sin hueco no hay nada que leer y la
  capa de afinidades sobra. Se comprueba sobre quinientas semillas, no sobre una
  afortunada.
- **La etapa la manda el desafío, no el azar.** Una criatura más crecida no puede
  ser menos peligrosa que su forma previa.

## La matriz de efectividad se deriva

Siete elementos por cuatro naturalezas son veintiocho casillas, y veintiocho
casillas escritas a mano son veintiocho sitios donde equivocarse. Cada elemento
declara una naturaleza `fuerte` (×2) y una `debil` (×0,5); el resto vale ×1.

Una prueba comprueba que `fuerte` y `debil` son **naturalezas** y no otros
elementos: escribir ahí el id de un elemento compila igual y rompe la matriz en
silencio. Esa prueba encontró justo ese fallo en la primera versión de la tabla.

Un elemento o una naturaleza desconocidos **fallan** en vez de valer 1: devolver
1 por lo desconocido convertiría una errata en un NPC inmune a nada, sin que
saltara ninguna alarma.

[#598]: https://github.com/EspacioKoop/espaciokooplagunak/issues/598
