# Inventario 3D del módulo Foundry

Qué geometría existe hoy, de qué está hecha, y qué le falta a cada caso. Existe
para **no reinventar la rueda**: antes de modelar nada nuevo o de traer un asset
de fuera (#571, #584, #590), se mira aquí si la pieza ya está o si ya está su
generador.

Todo es **procedural, cero binarios** (`CLAUDE.md`), y todo acaba en la misma
malla `{vertices, caras}` que consume `componerEscena` (`retro3d.mjs`).

## Generadores de forma: lo que YA sabemos dibujar

Antes de la lista de muebles, la lista de herramientas. Es donde más rueda
reinventada hay.

| Forma | Dónde vive hoy | Estado |
|---|---|---|
| `caja` | `cantina-escena.mjs:43`, `minijuegos/poker-3d.mjs:99`, `minijuegos/blackjack-3d.mjs:65` | **Triplicada.** La playa la importa de la cantina — un exterior dependiendo del bar de la nave |
| `disco` (prisma de N lados, extruido) | `poker-3d.mjs:133`, `blackjack-3d.mjs:98` | **Duplicada.** Es un prisma genérico disfrazado de ficha de póker |
| `prisma` (N lados, con conicidad) | `escena-primitivas.mjs` | Nuevo. **Es `disco` generalizado** — hay que unificarlos, no tener los dos |
| `esfera` facetada | `playa-escena.mjs` | Nuevo (planetas) |
| `anillo` inclinable | `playa-escena.mjs` | Nuevo (anillo planetario) |
| `losa` / `rampa` (cuadrilátero libre) | `playa-escena.mjs` | Nuevo (sombras, ladera) |
| `sector` circular en un plano | `playa-escena.mjs` (reloj) | Específico, pero generalizable |
| `fundir` mallas del mismo color | `nave-luminaria.mjs:45` | Útil y escondido en un módulo de lámparas |
| `mover`/`trasladar` malla | `poker-3d.mjs:125`, `nave-sala-caja.mjs:377` | Duplicada |

**Primer caso a resolver, y es de fontanería:** una sola casa para estas formas
(`escena-primitivas.mjs`, ya creado) y que los cinco módulos tiren de ahí. Con
una escena más, la copia de `caja` se vuelve cuatro.

## El problema de fondo: cuatro lados

Casi todo el mobiliario del módulo es una lista de cajas. Una caja es un prisma
de **cuatro lados**, y cuatro es el único número que no puede parecer redondo.
Por eso un poste de madera se lee como una viga, un conducto de reactor como un
pilar cuadrado y el pie de una mesa como un ladrillo.

No es «más polígonos, más realismo»: es que **faltaba la forma**. Un prisma de
ocho lados con algo de conicidad cuesta cuatro caras más y cambia la lectura por
completo. La columna «veredicto» de abajo es, casi siempre, esta decisión.

## Mobiliario de la nave — `nave-props.mjs`

Vocabulario compartido (#583). Cada prop es una lista de partes.

| Prop | Partes | Veredicto |
|---|---|---|
| `bancada` | 1 caja | **Correcto como caja.** Una bancada ES un bloque |
| `armario` | 1 caja | **Correcto.** Un armario cerrado es una caja |
| `registro` | 1 caja | **Correcto** |
| `conducto` | 1 caja de 3,8 m | **A prisma.** Un tubo de servicio cuadrado es lo que más delata el motor, y mide de suelo a techo: se ve entero |
| `silla` | 6 cajas | Se lee. Patas a prisma de 6 lados si sobra presupuesto |
| `taburete` | 3 cajas | **Pie a prisma.** Un taburete de pie cuadrado no existe |
| `mesa` | 3 cajas | **Pie a prisma.** Tablero y base se quedan |
| `soporte` | 4 cajas | **Montantes a prisma** |
| `barandilla` | 5 cajas | **Montantes y pasamanos a prisma.** Un pasamanos cuadrado no se agarra |
| `cana` | 3 cajas escalonadas | **A prisma cónico.** Una caña ES un cono; ahora son tres listones |

## Cantina — `cantina-escena.mjs`

28 piezas nombradas que se multiplican por bucles hasta las ~126 que cita el
código. Arte a mano de #423, y el más antiguo del módulo.

| Grupo | Piezas | Veredicto |
|---|---|---|
| Barra y canto | `barra`, `barraCanto`, `antepecho` | **Correcto.** Una barra es prismática |
| Mamparos, dinteles, vanos | `mamparoIzq/Der`, `dintel*`, `vanoEntrada` | **Correcto.** Es arquitectura |
| Mesas | `mesaIzq/Der` + sus pies | **Pies a prisma**, igual que la mesa de la nave |
| Gramola y tele | `gramola`, `gramolaLuz`, `tele*` | Correcto: son aparatos de chapa |
| Maceta, trapo, neón | sueltas | **Maceta a prisma.** Un tiesto cuadrado no es un tiesto |
| Goblin camarero | 7 piezas (cuerpo, cabeza, orejas, brazo, venda, bandeja) | **Caso aparte, ver abajo** |

## Consolas y luminarias

| Pieza | Dónde | Composición | Veredicto |
|---|---|---|---|
| Consola de puesto | `nave-consola.mjs` | 4 cajas (cuerpo, tapa, monitor, pantalla) | **Correcto.** Un pupitre de mando es chapa plegada |
| Luminaria de techo | `nave-luminaria.mjs` | mallas propias + `fundir` | **Correcto**, y con el único difusor emisivo del módulo |
| Muros, huecos, hojas de puerta, rodapié | `nave-sala-caja.mjs` | cajas y columnas | **Correcto.** Arquitectura |
| Piel pixelart de muro/puerta/objeto/suelo | `nave-piel-*.mjs` | cajas finas en rejilla | **Correcto.** Es relieve, no forma |

## Minijuegos

| Pieza | Dónde | Veredicto |
|---|---|---|
| Ficha de póker | `poker-3d.disco` | **Ya es un prisma de 10 lados.** Es el generador que hay que ascender, no reescribir |
| Carta | `poker-3d`/`blackjack-3d` | Correcto: una carta es una caja fina |
| Mesa de juego | ambos | Correcto |

## Playa — `playa-escena.mjs`

| Prop | Composición | Veredicto |
|---|---|---|
| `poste` de luz | 5 cajas | **A prisma cónico** — es el que peor se ve en las capturas |
| `manga` de viento | 4 cajas | **A cono truncado real** |
| `boya` | 3 cajas | **A prisma** |
| `cabina` de teléfono | 10 cajas, con cristales de otro color | **Correcto.** Una cabina es carpintería recta |
| `aerogenerador` | 4 cajas, aspas en cruz | Torre a prisma. Las aspas siguen en cruz hasta que haya rotación libre (#573/#556) |
| `roca` | 3 cajas desiguales | **Caso aparte, ver abajo** |
| `madera` de deriva | 3 cajas | A prisma de 6 lados |
| `matojo` | 6 cajas escalonadas | Correcto a esa escala |
| Terreno, mar, duna, rizos | franjas, rampas y cajas finas | Correcto |
| Planetas, anillo, sol | esfera / anillo / cuadrilátero | Correcto |
| Reloj varado | sectores en un plano | Correcto |

## Los dos casos que NO se arreglan con formas

**Roca.** Tres cajas desiguales no son una piedra: una piedra no tiene aristas
paralelas. Necesita un poliedro irregular con vértices desplazados por semilla —
o, si se decide, un escaneo decimado (#590). Es el mejor caso de prueba para la
vía de assets externos porque una roca no tiene procedencia cultural que
discutir.

**Figuras humanas** (goblin de la cantina, avatares de `cantina-avatar.mjs` que
reutiliza `nave-avatares-render.mjs`). Aquí el problema no es la forma, es que
una figura creíble no se compone de primitivas y punto. O se acepta la
convención low-poly deliberada que ya tiene, o entra por la vía de assets. **No
hay término medio que salga bien**, y añadir cajas solo produce muñecos.

## Cómo se usa este documento

1. ¿Existe ya la pieza? Búscala arriba.
2. ¿Existe ya su generador? Mira la primera tabla antes de escribir uno.
3. Si hay que mejorarla, el orden es: **forma correcta** (prisma en vez de caja)
   → **más partes** → y solo entonces plantearse un asset de fuera.
4. Un prop nuevo se declara en el vocabulario que le toque (`nave-props.mjs` para
   la nave, el suyo para cada escena), nunca suelto dentro de una escena.

Se actualiza en el mismo PR que añade o cambia geometría. Un inventario
desactualizado es peor que ninguno: manda modelar algo que ya existe.
